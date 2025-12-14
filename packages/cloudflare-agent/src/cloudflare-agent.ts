/**
 * Cloudflare Durable Object Agent with direct LLM integration
 *
 * This is the primary agent implementation using a loop-based architecture:
 * - Direct LLM calls via chat() with optional MCP tool support
 * - Real-time progress tracking via StepProgressTracker
 * - State persistence via Durable Object storage
 * - Platform-agnostic transport layer for Telegram/GitHub
 *
 * @example
 * ```typescript
 * export const TelegramAgent = createCloudflareChatAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   systemPrompt: 'You are a helpful assistant.',
 *   transport: telegramTransport,
 *   mcpServers: [{ name: 'memory', url: 'https://memory.example.com' }],
 * });
 * ```
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@duyetbot/hono-middleware';
import { type AgentStep, type Classification } from '@duyetbot/observability';
import type { Tool, ToolInput } from '@duyetbot/types';
import { Agent, type AgentNamespace, type Connection } from 'agents';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { D1MessagePersistence, D1ObservabilityAdapter } from './adapters/index.js';
import { callbackHandlers, parseCallbackData } from './callbacks/index.js';
import type { CallbackContext } from './callbacks/types.js';
import {
  type CommandContext,
  handleBuiltinCommand,
  transformSlashCommand,
} from './commands/index.js';
import { formatWithEmbeddedHistory } from './format.js';
import { trimHistory } from './history.js';
import { MCPInitializer } from './mcp/mcp-initializer.js';
import type { ParsedInput, Transport, TransportHooks } from './transport.js';
import type { LLMProvider, Message, OpenAITool } from './types.js';
import { debugContextToAgentSteps } from './workflow/debug-footer.js';
import {
  handleWorkflowComplete as handleWorkflowCompleteLogic,
  handleWorkflowProgress as handleWorkflowProgressLogic,
} from './workflow/index.js';
import { StepProgressTracker } from './workflow/step-tracker.js';
import type { QuotedContext } from './workflow/types.js';

/**
 * MCP server configuration for connecting to external MCP servers
 */
export interface MCPServerConnection {
  /** Unique name for this MCP server connection */
  name: string;
  /** URL of the MCP server (SSE endpoint) */
  url: string;
  /** Function to get authorization header value from env */
  getAuthHeader?: (env: Record<string, unknown>) => string | undefined;
}

/**
 * Active workflow execution tracking
 */
/** Progress update entry for workflow execution */
export interface WorkflowProgressEntry {
  type: string;
  iteration: number;
  message: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  durationMs?: number;
  timestamp: number;
  parallelTools?: Array<{
    id: string;
    name: string;
    argsStr: string;
    result?: {
      status: 'completed' | 'error';
      summary: string;
      durationMs?: number;
    };
  }>;
  toolCallId?: string;
}

export interface ActiveWorkflowExecution {
  /** Workflow instance ID from Cloudflare */
  workflowId: string;
  /** Our execution ID for correlation */
  executionId: string;
  /** Timestamp when workflow was spawned */
  startedAt: number;
  /** Last progress update received */
  lastProgress?: WorkflowProgressEntry;
  /** Accumulated progress history for display */
  progressHistory?: WorkflowProgressEntry[];
  /** Message ID for editing progress (MessageRef = string | number) */
  messageId: number;
  /** Platform for transport reconstruction */
  platform: 'telegram' | 'github';
  /** Chat ID for transport reconstruction */
  chatId: string;
}

/**
 * State persisted in Durable Object
 */
export interface CloudflareAgentState {
  messages: Message[];
  userId?: string | number;
  chatId?: string | number;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
  /**
   * Request IDs for deduplication (rolling window)
   */
  processedRequestIds?: string[];
  /**
   * Active workflow executions (Workflow-based AgenticLoop)
   * Maps executionId -> workflow metadata for progress tracking
   */
  activeWorkflows?: Record<string, ActiveWorkflowExecution>;
}

/**
 * Router configuration for feature flag-based routing
 */

/**
 * Target for scheduling routing to specialized agents
 * Used by scheduleRouting to specify where and how to send responses
 */

/**
 * Configuration for CloudflareChatAgent
 *
 * @template TEnv - Environment type with bindings
 * @template TContext - Platform-specific context type for transport
 */
export interface CloudflareAgentConfig<TEnv, TContext = unknown> {
  /** Function to create LLM provider from env */
  createProvider: (env: TEnv) => LLMProvider;
  /** System prompt - static string or function that receives env for dynamic configuration */
  systemPrompt: string | ((env: TEnv) => string);
  /** Welcome message for /start command */
  welcomeMessage?: string;
  /** Help message for /help command */
  helpMessage?: string;
  /** Maximum messages in history (default: 100) */
  maxHistory?: number;
  /** Transport layer for platform-specific messaging (optional for backward compatibility) */
  transport?: Transport<TContext>;
  /** Lifecycle hooks for handle() method */
  hooks?: TransportHooks<TContext>;
  /** MCP servers to connect to for tool capabilities */
  mcpServers?: MCPServerConnection[];
  /** Built-in tools from @duyetbot/tools */
  tools?: Tool[];
  /** Thinking messages to rotate while processing */
  thinkingMessages?: string[];
  /** Interval in ms to rotate thinking messages (default: 5000) */
  thinkingRotationInterval?: number;
  /** Maximum tool call iterations per message (default: 5) */
  maxToolIterations?: number;
  /** Maximum number of tools to expose to LLM (default: unlimited) */
  maxTools?: number;
}

// Re-export types for backward compatibility
export type { MemoryServiceBinding } from './service-binding-adapter.js';

/**
 * Interface for the CloudflareChatAgent class methods
 * This defines all public methods added by createCloudflareChatAgent
 */
export interface CloudflareChatAgentMethods<TContext = unknown> {
  initMcp(): Promise<void>;
  getMcpTools(): OpenAITool[];
  init(userId?: string | number, chatId?: string | number): Promise<void>;
  chat(
    userMessage: string,
    stepTracker?: StepProgressTracker,
    quotedContext?: QuotedContext,
    eventId?: string
  ): Promise<string>;
  clearHistory(): Promise<string>;
  getWelcome(): string;
  getHelp(): string;
  getMessageCount(): number;
  setMetadata(metadata: Record<string, unknown>): void;
  getMetadata(): Record<string, unknown> | undefined;
  /** @deprecated Use handleBuiltinCommand instead */
  handleCommand(text: string): Promise<string>;
  /**
   * Handle built-in commands, returns null for unknown commands
   * @param text - Command text (e.g., "/debug", "/help")
   * @param options - Optional context for admin commands (isAdmin, username, parseMode)
   */
  handleBuiltinCommand(
    text: string,
    options?: { isAdmin?: boolean; username?: string; parseMode?: 'HTML' | 'MarkdownV2' }
  ): Promise<string | null>;
  /** Transform slash command to natural language for LLM */
  transformSlashCommand(text: string): string;
  handle(ctx: TContext): Promise<void>;
  /**
   * Receive a callback query from Telegram inline keyboard button press
   */
  receiveCallback(context: CallbackContext): Promise<{ text?: string }>;
}

/**
 * Type for the CloudflareChatAgent class constructor
 * Extends typeof Agent to maintain compatibility with AgentNamespace
 */
export type CloudflareChatAgentClass<TEnv, TContext = unknown> = typeof Agent<
  TEnv,
  CloudflareAgentState
> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, CloudflareAgentState>>
  ): Agent<TEnv, CloudflareAgentState> & CloudflareChatAgentMethods<TContext>;
};

/**
 * Create a Cloudflare Durable Object Agent class with direct LLM integration
 *
 * @example
 * ```typescript
 * import { StepProgressTracker } from './workflow/step-tracker.js';
import { type DebugContext, debugContextToAgentSteps } from './workflow/debug-footer.js';
import type { AgentStep, Classification } from '@duyetbot/observability';
import type { QuotedContext } from './workflow/types.js';
 *
 * export const TelegramAgent = createCloudflareChatAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   systemPrompt: 'You are a helpful assistant.',
 *   welcomeMessage: 'Hello!',
 *   helpMessage: 'Commands: /start, /help, /clear',
 * });
 * ```
 */
export function createCloudflareChatAgent<TEnv, TContext = unknown>(
  config: CloudflareAgentConfig<TEnv, TContext>
): CloudflareChatAgentClass<TEnv, TContext> {
  const maxHistory = config.maxHistory ?? 100;
  const maxToolIterations = config.maxToolIterations ?? 5;
  const maxTools = config.maxTools; // undefined = unlimited
  const transport = config.transport;
  const hooks = config.hooks;
  const mcpServers = config.mcpServers ?? [];
  const builtinTools = config.tools ?? [];
  // Batch config for future use (alarm scheduling, etc.)
  // const batchConfig: BatchConfig = {
  //   ...DEFAULT_BATCH_CONFIG,
  //   ...config.batchConfig,
  // };

  // Convert built-in tools to OpenAI format
  const builtinToolsOpenAI: OpenAITool[] = builtinTools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.inputSchema) as Record<string, unknown>,
    },
  }));

  // Create a map for quick lookup of built-in tools by name
  const builtinToolMap = new Map<string, Tool>(builtinTools.map((tool) => [tool.name, tool]));

  // The class has all the methods defined in CloudflareChatAgentMethods, but we cast to unknown first to avoid strict type checks
  const AgentClass = class CloudflareChatAgent extends Agent<TEnv, CloudflareAgentState> {
    override initialState: CloudflareAgentState = {
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    /**
     * Flag to indicate if MCP has been initialized
     */
    private _mcpInitialized = false;
    private _processing = false;

    // Adapters (optional - only initialized if D1 binding exists)
    private messagePersistence: D1MessagePersistence | null = null;
    private observabilityAdapter: D1ObservabilityAdapter | null = null;

    private mcpInitializer!: MCPInitializer<TEnv>;

    constructor(state: DurableObjectState, env: TEnv) {
      super(state, env);

      // Check for D1 binding (may be named DB or OBSERVABILITY_DB depending on app)
      const envWithDb = this.env as unknown as { DB?: D1Database; OBSERVABILITY_DB?: D1Database };
      const db = envWithDb.DB ?? envWithDb.OBSERVABILITY_DB;

      // Initialize adapters only if D1 is available
      if (db) {
        this.messagePersistence = new D1MessagePersistence(db);
        this.observabilityAdapter = new D1ObservabilityAdapter(db);
      } else {
        logger.debug('[CloudflareAgent] No D1 binding found, persistence disabled');
      }

      // Initialize MCP
      this.mcpInitializer = new MCPInitializer<TEnv>(
        this,
        config.mcpServers || [],
        () => (this as unknown as { env: TEnv }).env
      );
    }

    /**
     * Get platform type from router config
     */

    /**
     * Helper to get command context
     */

    /**
     * Initialize MCP servers
     */
    async initMcp(): Promise<void> {
      await this.mcpInitializer.initialize(this._mcpInitialized);
      this._mcpInitialized = true;
    }

    /**
     * Get all registered MCP tools
     */
    getMcpTools(): OpenAITool[] {
      // @ts-expect-error - access internal map
      const toolsMap = this.mcpServers as Map<string, any>;
      // If mcpServers is not a Map (agent SDK internal implementation detail), return empty
      if (!toolsMap || typeof toolsMap.entries !== 'function') {
        return [];
      }

      const tools: OpenAITool[] = [];
      for (const [_, server] of toolsMap.entries()) {
        if (server.tools) {
          tools.push(...(server.tools as OpenAITool[]));
        }
      }
      return tools;
    }

    /**
     * Called when state is updated from any source
     */
    override onStateUpdate(state: CloudflareAgentState, source: 'server' | Connection) {
      logger.info(`[CloudflareAgent] State updated: ${JSON.stringify(state)}, Source: ${source}`);
    }

    /**
     * Initialize the agent with user/chat ID
     */
    async init(userId?: string | number, chatId?: string | number): Promise<void> {
      // Update state with IDs if provided
      if (userId !== undefined || chatId !== undefined) {
        this.setState({
          ...this.state,
          ...(userId !== undefined && { userId }),
          ...(chatId !== undefined && { chatId }),
          updatedAt: Date.now(),
        });
      }

      // Initialize MCP if configured
      if (mcpServers.length > 0) {
        await this.initMcp();
      }

      // Load history from D1 if state is empty
      if (this.state.messages.length === 0) {
        // Load from D1 if persistence is available
        if (this.messagePersistence) {
          const sessionId = {
            platform: String(this.state.metadata?.platform ?? 'api'),
            userId: String(this.state.userId ?? 'unknown'),
            chatId: String(this.state.chatId ?? 'unknown'),
          };
          const loadedMessages = await this.messagePersistence.loadMessages(sessionId, maxHistory);
          if (loadedMessages.length > 0) {
            this.setState({
              ...this.state,
              messages: loadedMessages,
              updatedAt: Date.now(),
            });
          }
        }
      }
    }

    /**
     * Chat with the LLM directly, with optional MCP tool support
     * @param userMessage - The user's message
     * @param stepTracker - Optional step progress tracker for real-time UI updates
     * @param quotedContext - Optional quoted message context (when user replied to a message)
     * @param eventId - Optional event ID for D1 correlation
     */
    async chat(
      userMessage: string,
      stepTracker?: StepProgressTracker,
      quotedContext?: QuotedContext,
      eventId?: string
    ): Promise<string> {
      // Trim history if it exceeds maxHistory (handles bloated state from older versions)
      if (this.state.messages.length > maxHistory) {
        logger.info(
          `[CloudflareAgent][CHAT] Trimming bloated history: ${this.state.messages.length} -> ${maxHistory}`
        );
        const trimmedMessages = trimHistory(this.state.messages, maxHistory);
        this.setState({
          ...this.state,
          messages: trimmedMessages,
          updatedAt: Date.now(),
        });
      }

      // Emit thinking step
      await stepTracker?.addStep({ type: 'thinking', iteration: 0 });

      // Initialize MCP connections if configured
      await this.initMcp();

      // Get LLM provider from environment bindings
      // Note: Type assertion needed due to TypeScript limitation with anonymous class inheritance
      const llmProvider = config.createProvider((this as unknown as { env: TEnv }).env);

      // Get available tools from MCP servers and merge with built-in tools
      const mcpTools = this.getMcpTools();
      const allTools = [...builtinToolsOpenAI, ...mcpTools];

      // Deduplicate tools by name (keep first occurrence)
      const seenNames = new Set<string>();
      let deduplicatedTools = allTools.filter((tool) => {
        const name = tool.function.name;
        if (seenNames.has(name)) {
          logger.info(`[CloudflareAgent][TOOLS] Skipping duplicate tool: ${name}`);
          return false;
        }
        seenNames.add(name);
        return true;
      });

      // Apply maxTools limit if configured
      if (maxTools !== undefined && deduplicatedTools.length > maxTools) {
        logger.info(
          `[CloudflareAgent][TOOLS] Limiting tools from ${deduplicatedTools.length} to ${maxTools}`
        );
        deduplicatedTools = deduplicatedTools.slice(0, maxTools);
      }

      const tools = deduplicatedTools;
      const hasTools = tools.length > 0;

      // Resolve systemPrompt (supports both string and function forms)
      const env = (this as unknown as { env: TEnv }).env;
      const resolvedSystemPrompt =
        typeof config.systemPrompt === 'function' ? config.systemPrompt(env) : config.systemPrompt;

      // Build messages with history embedded in user message (XML format)
      // This embeds conversation history directly in the prompt for AI Gateway compatibility
      const llmMessages = formatWithEmbeddedHistory(
        this.state.messages,
        resolvedSystemPrompt,
        userMessage,
        quotedContext
      );

      // Call LLM with tools if available
      let response = await llmProvider.chat(llmMessages, hasTools ? tools : undefined);

      // Track token usage and model from LLM response
      if (response.usage) {
        stepTracker?.addTokenUsage(response.usage);
      }
      if (response.model) {
        stepTracker?.setModel(response.model);
      }

      // Handle tool calls (up to maxToolIterations)
      let iterations = 0;

      // Track tool conversation for iterations (separate from embedded history)
      const toolConversation: Array<{
        role: 'user' | 'assistant';
        content: string;
      }> = [];

      while (
        response.toolCalls &&
        response.toolCalls.length > 0 &&
        iterations < maxToolIterations
      ) {
        iterations++;
        logger.info(
          `[CloudflareAgent][MCP] Processing ${response.toolCalls.length} tool calls (iteration ${iterations})`
        );

        // Add assistant message with tool calls to tool conversation
        toolConversation.push({
          role: 'assistant' as const,
          content: response.content || '',
        });

        // Execute each tool call (built-in or MCP)
        for (const toolCall of response.toolCalls) {
          // Emit tool start step
          await stepTracker?.addStep({
            type: 'tool_start',
            toolName: toolCall.name,
            iteration: iterations,
          });

          try {
            const toolArgs = JSON.parse(toolCall.arguments);
            let resultText: string;

            // Check if it's a built-in tool first
            const builtinTool = builtinToolMap.get(toolCall.name);
            if (builtinTool) {
              logger.info(`[CloudflareAgent][TOOL] Calling built-in tool: ${toolCall.name}`);

              // Execute built-in tool
              const toolInput: ToolInput = {
                content: toolArgs,
              };
              const result = await builtinTool.execute(toolInput);

              // Format result
              resultText =
                typeof result.content === 'string'
                  ? result.content
                  : JSON.stringify(result.content);

              if (result.status === 'error' && result.error) {
                resultText = `Error: ${result.error.message}`;
              }
            } else {
              // Parse tool name to get server ID (format: serverId__toolName)
              const [serverId, ...toolNameParts] = toolCall.name.split('__');
              const toolName = toolNameParts.join('__') || toolCall.name;

              logger.info(`[CloudflareAgent][MCP] Calling tool: ${toolName} on server ${serverId}`);

              const result = (await this.mcp.callTool({
                serverId: serverId || '',
                name: toolName,
                arguments: toolArgs,
              })) as { content: Array<{ type: string; text?: string }> };

              // Format MCP result
              resultText = result.content
                .map((c) => (c.type === 'text' ? c.text : JSON.stringify(c)))
                .join('\n');
            }

            // Emit tool complete step
            await stepTracker?.addStep({
              type: 'tool_complete',
              toolName: toolCall.name,
              result: resultText,
              iteration: iterations,
            });

            // Use 'user' role with tool context for compatibility
            toolConversation.push({
              role: 'user' as const,
              content: `[Tool Result for ${toolCall.name}]: ${resultText}`,
            });
          } catch (error) {
            logger.error(`[CloudflareAgent][TOOL] Tool call failed: ${error}`);

            // Emit tool error step
            const errorMessage = error instanceof Error ? error.message : String(error);
            await stepTracker?.addStep({
              type: 'tool_error',
              toolName: toolCall.name,
              error: errorMessage,
              iteration: iterations,
            });

            // Use 'user' role with error context for compatibility
            toolConversation.push({
              role: 'user' as const,
              content: `[Tool Error for ${toolCall.name}]: ${errorMessage}`,
            });
          }
        }

        // Rebuild messages with embedded history + tool conversation
        // Combine: system prompt + embedded history with user message + tool turns
        const toolMessages = [...llmMessages, ...toolConversation];

        // Emit LLM iteration step (show iteration progress for multi-turn conversations)
        await stepTracker?.addStep({
          type: 'llm_iteration',
          iteration: iterations,
          maxIterations: maxToolIterations,
        });

        // Continue conversation with tool results
        response = await llmProvider.chat(toolMessages, hasTools ? tools : undefined);

        // Track token usage and model from follow-up LLM calls
        if (response.usage) {
          stepTracker?.addTokenUsage(response.usage);
        }
        if (response.model) {
          stepTracker?.setModel(response.model);
        }
      }

      // Emit preparing step before finalizing
      await stepTracker?.addStep({ type: 'preparing', iteration: 0 });

      const assistantContent = response.content;

      // Update state with new messages (trimmed)
      const newMessages = trimHistory(
        [
          ...this.state.messages,
          { role: 'user' as const, content: userMessage },
          { role: 'assistant' as const, content: assistantContent },
        ],
        maxHistory
      );

      this.setState({
        ...this.state,
        messages: newMessages,
        updatedAt: Date.now(),
      });

      // Persist messages to D1 (fire-and-forget)
      if (this.messagePersistence) {
        const persistenceSessionId = {
          platform: String(this.state.metadata?.platform ?? 'api'),
          userId: String(this.state.userId ?? 'unknown'),
          chatId: String(this.state.chatId ?? 'unknown'),
        };
        this.messagePersistence.persistMessages(persistenceSessionId, newMessages, eventId);
      }

      // Capture assistant response to analytics (append-only, never deleted)
      // Fire-and-forget pattern - don't block on analytics capture

      return assistantContent;
    }

    /**
     * Clear conversation history.
     * Clears DO state but preserves D1 messages as archive.
     * The /clear command and response are persisted via persistCommand()
     * in handle(), so D1 maintains full audit trail.
     */
    async clearHistory(): Promise<string> {
      const messageCount = this.state.messages.length;

      // Clear DO state (but keep D1 messages as archive)
      this.setState({
        ...this.state,
        messages: [],
        updatedAt: Date.now(),
      });

      // Note: D1 messages are NOT deleted - they serve as archive
      // The /clear command itself is persisted via persistCommand() in handle()
      logger.debug('[CloudflareAgent][CLEAR] DO state cleared', {
        platform: this.state.metadata?.platform ?? 'api',
        userId: this.state.userId,
        chatId: this.state.chatId,
        archivedMessages: messageCount,
      });

      return `🧹 Conversation cleared. ${messageCount} messages archived.`;
    }

    /**
     * Get welcome message
     */
    getWelcome(): string {
      return config.welcomeMessage ?? 'Hello! How can I help you?';
    }

    /**
     * Get help message
     */
    getHelp(): string {
      return config.helpMessage ?? 'Commands: /start, /help, /clear';
    }

    /**
     * Get message count
     */
    getMessageCount(): number {
      return this.state.messages.length;
    }

    /**
     * Set metadata
     */
    setMetadata(metadata: Record<string, unknown>): void {
      this.setState({
        ...this.state,
        metadata: { ...this.state.metadata, ...metadata },
        updatedAt: Date.now(),
      });
    }

    /**
     * Get metadata
     */
    getMetadata(): Record<string, unknown> | undefined {
      return this.state.metadata;
    }

    /**
     * Handle built-in commands, returns null for unknown commands
     * @param text - Command text (e.g., "/debug", "/help")
     * @param options - Optional context for admin commands (isAdmin, username, parseMode)
     */
    async handleBuiltinCommand(
      text: string,
      options?: { isAdmin?: boolean; username?: string; parseMode?: 'HTML' | 'MarkdownV2' }
    ): Promise<string | null> {
      const commandContext = this.getCommandContext(text, options);
      return handleBuiltinCommand(text, commandContext);
    }

    /** Transform slash command to natural language for LLM */
    transformSlashCommand(text: string): string {
      return transformSlashCommand(text);
    }

    /**
     * Record a stage transition in the active batch
     */

    /**
     * Handle incoming message context
     * Routes to command handler or chat, then sends response via transport
     *
     * @param ctx - Platform-specific context
     * @throws Error if transport is not configured
     */
    // Clean up any debris before handle if necessary
    async handle(ctx: TContext): Promise<void> {
      logger.info(`[CloudflareAgent][HANDLE] Starting handle (${JSON.stringify(ctx)}`);

      if (!transport) {
        throw new Error('Transport not configured. Pass transport in config to use handle().');
      }

      const input = transport.parseContext(ctx);
      logger.info(`[CloudflareAgent][HANDLE] Parsed input: ${JSON.stringify(input)}`);

      // Deduplicate requests using requestId from metadata
      const requestId = input.metadata?.requestId as string | undefined;
      if (requestId) {
        const lastRequestId = this.state.metadata?.lastRequestId as string | undefined;
        if (lastRequestId === requestId) {
          logger.info(`[CloudflareAgent][HANDLE] Duplicate request ${requestId}, skipping`);
          return;
        }
      }

      // Prevent concurrent processing (Telegram may send retries)
      if (this._processing) {
        logger.info('[CloudflareAgent][HANDLE] Already processing, skipping duplicate request');
        return;
      }
      this._processing = true;

      // Store requestId to prevent future duplicates
      if (requestId) {
        this.setState({
          ...this.state,
          metadata: { ...this.state.metadata, lastRequestId: requestId },
          updatedAt: Date.now(),
        });
      }

      // Initialize state with user/chat context
      await this.init(input.userId, input.chatId);

      // Track message reference for error handling
      let messageRef: string | number | undefined;
      let stepTracker: StepProgressTracker | undefined;

      // Extract eventId from metadata for D1 correlation (outside try for error handling)
      const eventId = input.metadata?.eventId as string | undefined;

      // Track start time for observability duration
      const handleStartTime = Date.now();

      try {
        // Call beforeHandle hook
        if (hooks?.beforeHandle) {
          await hooks.beforeHandle(ctx);
        }

        let response = '';
        let chatMessage: string = input.text;

        // Extract quoted context from metadata (if user replied to a message)
        const quotedUsername = input.metadata?.quotedUsername as string | undefined;
        const quotedContext: QuotedContext | undefined = input.metadata?.quotedText
          ? {
              text: input.metadata.quotedText as string,
              ...(quotedUsername && { username: quotedUsername }),
            }
          : undefined;

        // Route: Built-in Command, Dynamic Command, or Chat
        if (input.text.startsWith('/')) {
          // Try built-in commands first (/start, /help, /clear, /debug)
          // Extract admin context from transport context if available
          const ctxWithAdmin = ctx as unknown as {
            isAdmin?: boolean;
            username?: string;
            parseMode?: 'HTML' | 'MarkdownV2';
          };
          const adminOptions: {
            isAdmin?: boolean;
            username?: string;
            parseMode?: 'HTML' | 'MarkdownV2';
          } = {};
          if (ctxWithAdmin.isAdmin !== undefined) {
            adminOptions.isAdmin = ctxWithAdmin.isAdmin;
          }
          const effectiveUsername = ctxWithAdmin.username ?? input.username;
          if (effectiveUsername !== undefined) {
            adminOptions.username = effectiveUsername;
          }
          if (ctxWithAdmin.parseMode !== undefined) {
            adminOptions.parseMode = ctxWithAdmin.parseMode;
          }
          if (ctxWithAdmin.parseMode !== undefined) {
            adminOptions.parseMode = ctxWithAdmin.parseMode;
          }

          // Use command module function directly
          const context = this.getCommandContext(input.text, adminOptions); // Pass adminOptions here
          const builtinResponse = await handleBuiltinCommand(input.text, context);

          if (builtinResponse !== null) {
            // Built-in command handled - send response directly
            response = builtinResponse;
            await transport.send(ctx, response);

            // Persist command to D1 (fire-and-forget)
            if (this.messagePersistence) {
              const commandSessionId = {
                platform: String(this.state.metadata?.platform ?? 'api'),
                userId: String(this.state.userId ?? 'unknown'),
                chatId: String(this.state.chatId ?? 'unknown'),
              };

              this.messagePersistence.persistCommand(
                commandSessionId,
                input.text,
                builtinResponse,
                eventId
              );
            }

            // Update observability for command
            if (eventId && this.observabilityAdapter) {
              this.observabilityAdapter.upsertEvent({
                eventId,
                status: 'success',
                completedAt: Date.now(),
                durationMs: Date.now() - handleStartTime,
                responseText: builtinResponse,
              });
            }
          } else {
            // Unknown command - transform to chat message for tools/MCP/LLM
            // e.g., "/translate hello" → "translate: hello"
            // Use command module function directly
            chatMessage = transformSlashCommand(input.text);
            logger.info(
              `[CloudflareAgent][HANDLE] Dynamic command: "${input.text}" → "${chatMessage}"`
            );

            // Fall through to chat processing below
            response = ''; // Will be set in chat block
          }
        }

        // Process with chat if not a built-in command
        if (!input.text.startsWith('/') || chatMessage !== input.text) {
          // Send typing indicator
          if (transport.typing) {
            await transport.typing(ctx);
          }

          // Send initial thinking message
          messageRef = await transport.send(ctx, '[~] Thinking...');

          // Create step progress tracker for real-time step visibility
          if (transport.edit) {
            stepTracker = new StepProgressTracker(
              async (message) => {
                try {
                  // Update context with progressive debug info for footer display
                  // This enables the transport to show debug footer during loading
                  const ctxWithDebug = ctx as unknown as {
                    debugContext?: unknown;
                  };
                  if (stepTracker) {
                    ctxWithDebug.debugContext = stepTracker.getDebugContext();
                  }
                  await transport.edit!(ctx, messageRef!, message);
                } catch (err) {
                  logger.error(`[CloudflareAgent][STEP] Edit failed: ${err}`);
                }
              },
              {
                rotationInterval: config.thinkingRotationInterval ?? 5000,
              }
            );
          }

          // Process with LLM - must await to keep DO alive
          // Note: Worker may timeout on long LLM calls, but DO continues
          try {
            // Direct chat calls only - routing removed
            logger.info('[CloudflareAgent][HANDLE] Processing via chat()');
            response = await this.chat(chatMessage, stepTracker, quotedContext, eventId);
          } finally {
            // Stop step tracker (stops any rotation timers)
            stepTracker?.destroy();
          }

          // Edit thinking message with actual response
          if (transport.edit) {
            try {
              // Update context with final debug info before sending
              const ctxWithDebug = ctx as unknown as {
                debugContext?: unknown;
              };
              if (stepTracker) {
                ctxWithDebug.debugContext = stepTracker.getDebugContext();
              }

              logger.info(`[CloudflareAgent][HANDLE] Editing final response: ${response}`);
              await transport.edit(ctx, messageRef, response);
            } catch (editError) {
              // Fallback: send new message if edit fails (e.g., message deleted)
              logger.error(
                `[CloudflareAgent][HANDLE] Edit failed, sending new message: ${editError}`
              );

              // Set debug context for fallback send too
              const ctxWithDebug = ctx as unknown as {
                debugContext?: unknown;
              };
              if (stepTracker) {
                ctxWithDebug.debugContext = stepTracker.getDebugContext();
              }

              await transport.send(ctx, response);
            }
          } else {
            // Transport doesn't support edit, send new message
            // Set debug context here too
            const ctxWithDebug = ctx as unknown as {
              debugContext?: unknown;
            };
            if (stepTracker) {
              ctxWithDebug.debugContext = stepTracker.getDebugContext();
            }

            await transport.send(ctx, response);
          }
        }

        // Call afterHandle hook (for command responses)
        if (hooks?.afterHandle) {
          await hooks.afterHandle(ctx, response);
        }

        // Capture debug context for observability
        const debugContext = stepTracker?.getDebugContext();

        // Update observability for this event with full data (fire-and-forget)
        if (eventId) {
          let classification: Classification | undefined;
          let agents: AgentStep[] | undefined;
          let inputTokens = 0;
          let outputTokens = 0;
          let totalTokens = 0;
          let cachedTokens = 0;
          let model: string | undefined;

          const completedAt = Date.now();
          const durationMs = completedAt - handleStartTime;

          if (debugContext) {
            agents = debugContextToAgentSteps(debugContext);

            // Extract tokens from stepTracker
            const usage = stepTracker?.getTokenUsage();
            if (usage) {
              inputTokens = usage.input;
              outputTokens = usage.output;
              totalTokens = usage.total;
              cachedTokens = usage.cached ?? 0;
            }
            if (stepTracker?.getModel()) {
              model = stepTracker.getModel();
            }
          }

          this.observabilityAdapter?.upsertEvent({
            eventId,
            status: 'success',
            completedAt,
            durationMs,
            responseText: response,
            ...(classification && { classification }),
            ...(agents && agents.length > 0 && { agents: agents as AgentStep[] }),
            ...(inputTokens > 0 && { inputTokens }),
            ...(outputTokens > 0 && { outputTokens }),
            ...(totalTokens > 0 && { totalTokens }),
            ...(cachedTokens > 0 && { cachedTokens }),
            // ...(reasoningTokens > 0 && { reasoningTokens }),
            ...(model && { model }),
          });
        }
      } catch (error) {
        // Stop step tracker if still running
        stepTracker?.destroy();
        logger.error(`[CloudflareAgent][HANDLE] Error: ${error}`);

        // Edit thinking message to show error (if we have a message to edit)
        if (messageRef && transport.edit) {
          const errorMessage = '[error] Sorry, an error occurred. Please try again later.';
          try {
            await transport.edit(ctx, messageRef, errorMessage);
          } catch {
            // Fallback: send new message if edit fails
            await transport.send(ctx, errorMessage);
          }
        }

        // Call onError hook for logging/custom handling
        if (hooks?.onError) {
          await hooks.onError(ctx, error as Error, messageRef);
        } else if (!messageRef) {
          // No message to edit and no hook - rethrow
          throw error;
        }

        if (eventId && this.observabilityAdapter) {
          this.observabilityAdapter.upsertEvent({
            eventId,
            status: 'error',
            completedAt: Date.now(),
            durationMs: Date.now() - handleStartTime,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorType: error instanceof Error ? error.name : 'UnknownError',
          });
        }
      } finally {
        // Always reset processing flag
        this._processing = false;
      }
    }

    // ============================================
    // RPC Methods
    // ============================================

    /**
     * Receive a message directly via ParsedInput (RPC-friendly)
     *
     * This method processes messages asynchronously and sends responses
     * via the transport layer (if configured). The caller (webhook) returns
     * immediately while the DO continues processing.
     */
    async receiveMessage(
      input: ParsedInput
    ): Promise<{ traceId: string; queued: boolean; batchId?: string }> {
      const traceId = (input.metadata?.traceId as string) || crypto.randomUUID();
      const eventIdRaw = input.metadata?.eventId;
      const eventId = typeof eventIdRaw === 'string' ? eventIdRaw : undefined;

      // Note: In the new architecture, we process immediately (no batch queue)
      // But we wrap in a non-blocking promise to mimic "queued" behavior for RPC caller
      // The caller (webhook) expects to return immediately.

      // We start processing asynchronously
      (async () => {
        try {
          logger.info('[CloudflareAgent][RPC] receiveMessage started', {
            hasTransport: !!transport,
            hasBotToken: !!input.metadata?.botToken,
            userId: input.userId,
            chatId: input.chatId,
            platform: input.metadata?.platform,
          });

          await this.init(input.userId, input.chatId);

          // Store platform in metadata for persistence session ID
          if (input.metadata?.platform) {
            this.setMetadata({ platform: input.metadata.platform });
          }

          // Construct quoted context if present
          const quotedContext: QuotedContext | undefined = input.metadata?.quotedText
            ? {
                text: String(input.metadata.quotedText),
                ...(input.metadata.quotedUsername
                  ? { username: String(input.metadata.quotedUsername) }
                  : {}),
              }
            : undefined;

          // Reconstruct transport context from metadata (platform-specific)
          // This allows sending responses back to the user
          let messageRef: string | number | undefined;
          let stepTracker: StepProgressTracker | undefined;

          if (transport && input.metadata?.botToken) {
            logger.info('[CloudflareAgent][RPC] Transport available, will send response');
            // Reconstruct platform context for transport operations
            const ctx = {
              token: input.metadata.botToken as string,
              chatId: Number(input.chatId),
              userId: Number(input.userId),
              username: input.username,
              text: input.text,
              startTime: (input.metadata.startTime as number) || Date.now(),
              adminUsername: input.metadata.adminUsername as string | undefined,
              isAdmin: (input.metadata.isAdmin as boolean) || false,
              parseMode: input.metadata.parseMode as 'HTML' | 'MarkdownV2' | undefined,
              messageId: Number(input.messageRef) || 0,
              replyToMessageId: input.replyTo ? Number(input.replyTo) : undefined,
              requestId: input.metadata.requestId as string | undefined,
            } as TContext;

            // Send typing indicator
            if (transport.typing) {
              await transport.typing(ctx);
            }

            // Send initial thinking message
            logger.info('[CloudflareAgent][RPC] Sending thinking message');
            messageRef = await transport.send(ctx, '[~] Thinking...');
            logger.info('[CloudflareAgent][RPC] Thinking message sent', { messageRef });

            // Create step progress tracker for real-time step visibility
            if (transport.edit && messageRef !== undefined) {
              stepTracker = new StepProgressTracker(
                async (message) => {
                  try {
                    // Update context with progressive debug info for footer display
                    const ctxWithDebug = ctx as unknown as { debugContext?: unknown };
                    if (stepTracker) {
                      ctxWithDebug.debugContext = stepTracker.getDebugContext();
                    }
                    await transport.edit!(ctx, messageRef!, message);
                  } catch (err) {
                    logger.error(`[CloudflareAgent][RPC] Edit failed: ${err}`);
                  }
                },
                {
                  rotationInterval: config.thinkingRotationInterval ?? 5000,
                }
              );
            }

            try {
              // Call chat to get LLM response
              logger.info('[CloudflareAgent][RPC] Calling chat()');
              const response = await this.chat(input.text, stepTracker, quotedContext, eventId);
              logger.info('[CloudflareAgent][RPC] Chat completed', {
                responseLength: response?.length,
              });

              // Update context with final debug info before sending
              const ctxWithDebug = ctx as unknown as { debugContext?: unknown };
              if (stepTracker) {
                ctxWithDebug.debugContext = stepTracker.getDebugContext();
              }

              // Edit thinking message with actual response
              if (transport.edit && messageRef !== undefined) {
                try {
                  logger.info('[CloudflareAgent][RPC] Editing final response', { messageRef });
                  await transport.edit(ctx, messageRef, response);
                  logger.info('[CloudflareAgent][RPC] Final response sent via edit');
                } catch (editError) {
                  // Fallback: send new message if edit fails
                  logger.error(`[CloudflareAgent][RPC] Edit failed, sending new: ${editError}`);
                  await transport.send(ctx, response);
                  logger.info('[CloudflareAgent][RPC] Final response sent via send (fallback)');
                }
              } else {
                // No edit support, send as new message
                logger.info('[CloudflareAgent][RPC] No edit support, sending new message');
                await transport.send(ctx, response);
                logger.info('[CloudflareAgent][RPC] Final response sent via send');
              }
            } finally {
              stepTracker?.destroy();
            }
          } else {
            // No transport or token - just process (useful for testing or API calls)
            logger.warn('[CloudflareAgent][RPC] No transport/token - response not sent to user', {
              hasTransport: !!transport,
              hasBotToken: !!input.metadata?.botToken,
            });
            await this.chat(input.text, undefined, quotedContext, eventId);
          }
        } catch (err) {
          logger.error(`[CloudflareAgent][RPC] receiveMessage failed: ${err}`);
        }
      })();

      return { traceId, queued: true };
    }

    // ============================================
    // Callback Query Handling (Telegram Inline Buttons)
    // ============================================

    /**
     * Receive a callback query from Telegram inline keyboard button press (RPC method)
     * Parses the callback data and routes to the appropriate handler
     */
    async receiveCallback(context: CallbackContext): Promise<{ text?: string }> {
      // Parse the callback data
      const parsed = parseCallbackData(context.data);

      if (!parsed) {
        logger.warn('[CloudflareAgent] Invalid callback data', {
          callbackQueryId: context.callbackQueryId,
          data: context.data,
        });
        return {};
      }

      // Get the handler for this action
      const handler = callbackHandlers[parsed.action];
      if (!handler) {
        logger.warn('[CloudflareAgent] No handler for callback action', {
          action: parsed.action,
          callbackQueryId: context.callbackQueryId,
        });
        return {};
      }

      // Execute the handler
      try {
        const result = await handler(context, parsed.payload);

        logger.debug('[CloudflareAgent] Callback handled', {
          action: parsed.action,
          success: result.success,
          callbackQueryId: context.callbackQueryId,
        });

        // Return text only if message is defined
        const response: { text?: string } = {};
        if (result.message !== undefined) {
          response.text = result.message;
        }
        return response;
      } catch (err) {
        logger.error('[CloudflareAgent] Callback handler error', {
          action: parsed.action,
          error: err instanceof Error ? err.message : String(err),
          callbackQueryId: context.callbackQueryId,
        });
        return {};
      }
    }

    // ============================================
    // Workflow Progress Endpoints (HTTP)
    // ============================================

    /**
     * Override fetch to handle internal workflow endpoints BEFORE the partyserver SDK's
     * fetch handler runs. The SDK expects x-partykit-room headers, but our internal
     * workflow callbacks don't set these headers.
     *
     * Internal endpoints:
     * - POST /workflow-progress: Receive progress updates from AgenticLoopWorkflow
     * - POST /workflow-complete: Receive completion notification from workflow
     */
    override async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);

      // Handle internal workflow endpoints before partyserver SDK
      if (
        (url.pathname === '/workflow-progress' || url.pathname === '/workflow-complete') &&
        request.method === 'POST'
      ) {
        // Process internally without partyserver headers
        return this.handleWorkflowCallback(request);
      }

      // Pass to parent's fetch for normal websocket/request handling
      return super.fetch(request);
    }

    /**
     * Handle workflow progress updates
     *
     * Accumulates progress updates and formats them in Claude Code style.
     * Delegates to the shared workflow logic.
     */
    private async handleWorkflowProgress(request: Request): Promise<Response> {
      return handleWorkflowProgressLogic(request, {
        env: (this as unknown as { env: TEnv }).env as Record<string, unknown>,
        state: this.state,
        setState: (s) => this.setState({ ...this.state, ...s }),
        ...(transport && { transport }),
      });
    }

    /**
     * Handle workflow completion notification
     * delegates to shared logic
     */
    private async handleWorkflowComplete(request: Request): Promise<Response> {
      const env = (this as unknown as { env: TEnv }).env as Record<string, unknown>;
      return handleWorkflowCompleteLogic(request, {
        env,
        state: this.state,
        setState: (s) => this.setState({ ...this.state, ...s }),
        ...(transport && { transport }),
        adminConfig: {
          adminUserIds: new Set(), // TODO: Load from env if needed
          adminUsernames: new Set(
            [
              (env as unknown as { TELEGRAM_ADMIN?: string }).TELEGRAM_ADMIN,
              (env as unknown as { GITHUB_ADMIN?: string }).GITHUB_ADMIN,
            ].filter(Boolean) as string[]
          ),
        },
      });
    }

    /**
     * Handle internal workflow endpoints
     */
    private async handleWorkflowCallback(request: Request): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname === '/workflow-progress') {
        return this.handleWorkflowProgress(request);
      }
      if (url.pathname === '/workflow-complete') {
        return this.handleWorkflowComplete(request);
      }
      return new Response('Not found', { status: 404 });
    }

    /**
     * Get command context for command handlers
     */
    private getCommandContext(
      _text: string,
      options?: { isAdmin?: boolean; username?: string; parseMode?: 'HTML' | 'MarkdownV2' }
    ): CommandContext {
      // Unused but kept for structure if needed later
      // const env = (this as unknown as { env: TEnv }).env;
      return {
        isAdmin: options?.isAdmin ?? false,
        username: options?.username,
        parseMode: options?.parseMode,
        state: this.state,
        setState: (s: Partial<CloudflareAgentState>) => this.setState({ ...this.state, ...s }),
        resetMcp: () => {
          this._mcpInitialized = false;
        },
        config: {
          welcomeMessage: this.state.metadata?.platform === 'telegram' ? 'Hello!' : undefined,
          mcpServers,
          tools: builtinTools,
        },
      } as unknown as CommandContext;
    }
  };

  return AgentClass as unknown as CloudflareChatAgentClass<TEnv, TContext>;
}

/**
 * Type helper for agent namespaces
 * Use this for the Env interface to get proper typing for agent stubs
 */
export type CloudflareChatAgentNamespace<TEnv, TContext = unknown> = AgentNamespace<
  Agent<TEnv, CloudflareAgentState> & CloudflareChatAgentMethods<TContext>
>;

/**
 * Type-safe helper to get a CloudflareChatAgent by name
 *
 * Uses the properly typed DO stub pattern - no type assertions needed.
 *
 * @example
 * ```typescript
 * const agent = getChatAgent(env.TelegramAgent, agentId);
 * await agent.handle(ctx); // Fully typed!
 * ```
 */
// Using any to avoid deep type instantiation recursion errors with intersection types
// and branding issues. The consumer knows what methods are available.
// Using any to avoid deep type instantiation recursion errors with intersection types
// and branding issues. The consumer knows what methods are available.
export function getChatAgent(namespace: any, name: string): any {
  const id = namespace.idFromName(name);
  return namespace.get(id);
}
