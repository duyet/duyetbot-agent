/**
 * Cloudflare Durable Object Agent with direct LLM integration
 *
 * Simplified design: No ChatAgent wrapper, calls LLM directly in chat().
 * State persistence via Durable Object storage.
 */

import { logger } from '@duyetbot/hono-middleware';
import type { Tool, ToolInput } from '@duyetbot/types';
import { Agent, type AgentNamespace, type Connection, getAgentByName } from 'agents';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { AgentContext, AgentResult } from './agents/base-agent.js';
import type { RouterAgentEnv } from './agents/router-agent.js';
import {
  type BatchConfig,
  type BatchState,
  type PendingMessage,
  combineBatchMessages,
  createInitialBatchState,
  isBatchStuckByHeartbeat,
  isDuplicateInBothBatches,
} from './batch-types.js';
import type { RoutingFlags } from './feature-flags.js';
import {
  createThinkingRotator,
  formatWithEmbeddedHistory,
  getDefaultThinkingMessages,
} from './format.js';
import { trimHistory } from './history.js';
import type {
  CompleteBatchParams,
  HeartbeatParams,
  Platform,
  RegisterBatchParams,
  ResponseTarget as StateResponseTarget,
} from './state-types.js';
import { StepProgressTracker } from './step-progress.js';
import type { Transport, TransportHooks } from './transport.js';
import type { LLMProvider, Message, OpenAITool } from './types.js';

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
   * Active batch - currently being processed (IMMUTABLE during processing)
   * Once a batch starts processing, it cannot be modified
   */
  activeBatch?: BatchState;
  /**
   * Pending batch - collecting new messages (MUTABLE)
   * New messages always go here, never to activeBatch
   */
  pendingBatch?: BatchState;
  /** Request IDs for deduplication (rolling window) */
  processedRequestIds?: string[];
}

/**
 * Router configuration for feature flag-based routing
 */
export interface RouterConfig {
  /** Platform identifier for routing decisions */
  platform: 'telegram' | 'github' | 'cli' | 'api';
  /** Feature flags (if not provided, parsed from env) */
  flags?: RoutingFlags;
  /** Enable debug logging for routing decisions */
  debug?: boolean;
}

/**
 * Configuration for CloudflareChatAgent
 *
 * @template TEnv - Environment type with bindings
 * @template TContext - Platform-specific context type for transport
 */
export interface CloudflareAgentConfig<TEnv, TContext = unknown> {
  /** Function to create LLM provider from env */
  createProvider: (env: TEnv) => LLMProvider;
  /** System prompt for the agent */
  systemPrompt: string;
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
  /**
   * Router configuration for Phase 4 integration
   * When enabled, queries are classified and routed to specialized agents
   */
  router?: RouterConfig;
  /**
   * Batch configuration for message coalescing
   * When enabled, rapid messages are combined within a time window
   */
  batchConfig?: Partial<BatchConfig>;
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
  chat(userMessage: string): Promise<string>;
  clearHistory(): Promise<string>;
  getWelcome(): string;
  getHelp(): string;
  getMessageCount(): number;
  setMetadata(metadata: Record<string, unknown>): void;
  getMetadata(): Record<string, unknown> | undefined;
  /** @deprecated Use handleBuiltinCommand instead */
  handleCommand(text: string): Promise<string>;
  /** Handle built-in commands, returns null for unknown commands */
  handleBuiltinCommand(text: string): Promise<string | null>;
  /** Transform slash command to natural language for LLM */
  transformSlashCommand(text: string): string;
  handle(ctx: TContext): Promise<void>;
  /**
   * Check if routing is enabled for this request
   * @param userId - User ID for deterministic rollout assignment
   */
  shouldRoute(userId?: string): boolean;
  /**
   * Route a query through RouterAgent if enabled
   * @param query - The user's message
   * @param context - Agent context with platform info
   * @returns AgentResult from RouterAgent, or null if routing disabled
   */
  routeQuery(query: string, context: AgentContext): Promise<AgentResult | null>;
  /**
   * Get routing statistics from RouterAgent if available
   * @returns Routing stats or null if RouterAgent not available
   */
  getRoutingStats(): Promise<{
    totalRouted: number;
    byTarget: Record<string, number>;
    avgDurationMs: number;
  } | null>;
  /**
   * Get routing history from RouterAgent if available
   * @param limit - Optional limit for number of history entries
   * @returns Routing history or null if RouterAgent not available
   */
  getRoutingHistory(limit?: number): Promise<unknown[] | null>;
  /**
   * Queue a message for batch processing with alarm-based execution
   * Messages within the batch window are combined into a single LLM call
   * @param ctx - Platform-specific context
   * @returns Object with queued status
   */
  queueMessage(ctx: TContext): Promise<{ queued: boolean; batchId?: string }>;
  /**
   * Get current batch state for debugging/monitoring
   */
  getBatchState(): { activeBatch?: BatchState; pendingBatch?: BatchState };
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
 * import { createCloudflareChatAgent } from '@duyetbot/chat-agent';
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
  const routerConfig = config.router;
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

  // The class has all the methods defined in CloudflareChatAgentMethods
  // Type assertion is needed because TypeScript can't infer the additional methods
  // on the class type from the instance methods alone
  const AgentClass = class CloudflareChatAgent extends Agent<TEnv, CloudflareAgentState> {
    override initialState: CloudflareAgentState = {
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    private _mcpInitialized = false;
    private _processing = false;
    private _batchStartTime = 0; // Track batch start time for duration calculation

    // ============================================
    // State DO Reporting (Fire-and-Forget)
    // ============================================

    /**
     * Interface for State DO stub methods (RPC calls via Durable Object binding)
     */
    private getStateDOStub(): {
      registerBatch: (p: RegisterBatchParams) => Promise<void>;
      heartbeat: (p: HeartbeatParams) => Promise<void>;
      completeBatch: (p: CompleteBatchParams) => Promise<void>;
    } | null {
      const env = (this as unknown as { env: TEnv }).env;
      const envWithState = env as unknown as RouterAgentEnv & {
        StateDO?: AgentNamespace<Agent<unknown, unknown>>;
      };

      if (!envWithState.StateDO) {
        return null;
      }

      // Use a single global instance for State DO
      const id = envWithState.StateDO.idFromName('global');
      return envWithState.StateDO.get(id) as unknown as {
        registerBatch: (p: RegisterBatchParams) => Promise<void>;
        heartbeat: (p: HeartbeatParams) => Promise<void>;
        completeBatch: (p: CompleteBatchParams) => Promise<void>;
      };
    }

    /**
     * Report to State DO (fire-and-forget pattern)
     * Does not block on errors - State DO reporting is non-critical
     */
    private reportToStateDO(
      method: 'registerBatch' | 'heartbeat' | 'completeBatch',
      params: RegisterBatchParams | HeartbeatParams | CompleteBatchParams
    ): void {
      try {
        const stateDO = this.getStateDOStub();
        if (!stateDO) {
          return;
        }

        // Fire-and-forget: don't await, catch any errors
        void (async () => {
          try {
            if (method === 'registerBatch') {
              await stateDO.registerBatch(params as RegisterBatchParams);
            } else if (method === 'heartbeat') {
              await stateDO.heartbeat(params as HeartbeatParams);
            } else if (method === 'completeBatch') {
              await stateDO.completeBatch(params as CompleteBatchParams);
            }
          } catch (err) {
            logger.warn(`[CloudflareAgent][StateDO] ${method} failed`, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        })();
      } catch (err) {
        logger.warn('[CloudflareAgent][StateDO] Report failed', {
          method,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    /**
     * Get platform type from router config
     */
    private getPlatform(): Platform {
      return (routerConfig?.platform as Platform) || 'api';
    }

    /**
     * Initialize MCP server connections with timeout
     */
    async initMcp(): Promise<void> {
      if (this._mcpInitialized || mcpServers.length === 0) {
        return;
      }

      const env = (this as unknown as { env: TEnv }).env;
      const CONNECTION_TIMEOUT = 10000; // 10 seconds per connection

      for (const server of mcpServers) {
        try {
          const authHeader = server.getAuthHeader?.(env as Record<string, unknown>);
          const options: Record<string, unknown> = {};

          if (authHeader) {
            options.transport = {
              headers: {
                Authorization: authHeader,
              },
            };
          }

          logger.info(`[CloudflareAgent][MCP] Connecting to ${server.name} at ${server.url}`);
          logger.info(
            `[CloudflareAgent][MCP] Auth header present: ${!!authHeader}, length: ${authHeader?.length || 0}`
          );

          // Add timeout to prevent hanging connections
          const connectPromise = this.mcp.connect(server.url, options);
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error(`Connection timeout after ${CONNECTION_TIMEOUT}ms`)),
              CONNECTION_TIMEOUT
            );
          });

          const result = await Promise.race([connectPromise, timeoutPromise]);
          logger.info(`[CloudflareAgent][MCP] Connected to ${server.name}: ${result.id}`);
        } catch (error) {
          logger.error(`[CloudflareAgent][MCP] Failed to connect to ${server.name}: ${error}`);
          // Continue to next server - don't block on failed connections
        }
      }

      this._mcpInitialized = true;
    }

    /**
     * Get tools from connected MCP servers in OpenAI format
     */
    getMcpTools(): OpenAITool[] {
      const mcpTools = this.mcp.listTools();
      return mcpTools.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description || '',
          parameters: tool.inputSchema as Record<string, unknown>,
        },
      }));
    }

    /**
     * Called when state is updated from any source
     */
    override onStateUpdate(state: CloudflareAgentState, source: 'server' | Connection) {
      logger.info(`[CloudflareAgent] State updated: ${JSON.stringify(state)}, Source: ${source}`);
    }

    /**
     * Initialize agent with context (userId, chatId)
     */
    async init(userId?: string | number, chatId?: string | number): Promise<void> {
      const needsUpdate =
        (this.state.userId === undefined && userId !== undefined) ||
        (this.state.chatId === undefined && chatId !== undefined);

      if (needsUpdate) {
        const newState: CloudflareAgentState = {
          ...this.state,
          createdAt: this.state.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
        if (userId !== undefined) {
          newState.userId = userId;
        }
        if (chatId !== undefined) {
          newState.chatId = chatId;
        }
        this.setState(newState);
      }
    }

    /**
     * Chat with the LLM directly, with optional MCP tool support
     * @param userMessage - The user's message
     * @param stepTracker - Optional step progress tracker for real-time UI updates
     */
    async chat(userMessage: string, stepTracker?: StepProgressTracker): Promise<string> {
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
      await stepTracker?.addStep({ type: 'thinking' });

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

      // Build messages with history embedded in user message (XML format)
      // This embeds conversation history directly in the prompt for AI Gateway compatibility
      const llmMessages = formatWithEmbeddedHistory(
        this.state.messages,
        config.systemPrompt,
        userMessage
      );

      // Call LLM with tools if available
      let response = await llmProvider.chat(llmMessages, hasTools ? tools : undefined);

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
      }

      // Emit preparing step before finalizing
      await stepTracker?.addStep({ type: 'preparing' });

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

      return assistantContent;
    }

    /**
     * Clear conversation history
     */
    async clearHistory(): Promise<string> {
      this.setState({
        ...this.state,
        messages: [],
        updatedAt: Date.now(),
      });

      return 'Conversation history cleared.';
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
     * Handle built-in command and return response message
     * Routes /start, /help, /clear to appropriate handlers
     * Returns null for unknown commands (should fall back to chat)
     */
    async handleBuiltinCommand(text: string): Promise<string | null> {
      const command = (text.split(/[\s\n]/)[0] ?? '').toLowerCase();

      switch (command) {
        case '/start':
          return this.getWelcome();
        case '/help':
          return this.getHelp();
        case '/clear': {
          // Log state BEFORE clear for debugging
          logger.info('[CloudflareAgent][CLEAR] State BEFORE clear', {
            messageCount: this.state.messages?.length ?? 0,
            hasActiveBatch: !!this.state.activeBatch,
            hasPendingBatch: !!this.state.pendingBatch,
            hasMetadata: !!this.state.metadata,
          });

          // Full DO state reset - clears messages, metadata, batch, and resets MCP
          this._mcpInitialized = false;

          // Build fresh state without optional properties (exactOptionalPropertyTypes)
          // By NOT including activeBatch, pendingBatch, metadata, processedRequestIds,
          // we ensure they are fully cleared (not merged from old state)
          const freshState: CloudflareAgentState = {
            messages: [], // Clear conversation history
            createdAt: Date.now(),
            updatedAt: Date.now(),
            // Optional properties are intentionally OMITTED to clear them completely
          };

          // Preserve userId/chatId for session continuity
          if (this.state.userId !== undefined) {
            freshState.userId = this.state.userId;
          }
          if (this.state.chatId !== undefined) {
            freshState.chatId = this.state.chatId;
          }

          this.setState(freshState);

          // Log state AFTER clear to verify
          logger.info('[CloudflareAgent][CLEAR] State AFTER clear', {
            messageCount: this.state.messages?.length ?? 0,
            hasActiveBatch: !!this.state.activeBatch,
            hasPendingBatch: !!this.state.pendingBatch,
            hasMetadata: !!this.state.metadata,
            userId: freshState.userId,
            chatId: freshState.chatId,
            mcpReset: true,
          });

          return '🧹 All conversation data and agent connections cleared. Fresh start!';
        }
        case '/recover': {
          // Clear stuck batch state to recover from processing failures
          // This is a lighter reset than /clear - preserves messages and metadata
          const hadActiveBatch = !!this.state.activeBatch;
          const hadPendingBatch =
            !!this.state.pendingBatch && this.state.pendingBatch.pendingMessages.length > 0;

          // Remove batch state while preserving everything else
          const { activeBatch: _a, pendingBatch: _p, ...rest } = this.state;
          this.setState({
            ...rest,
            pendingBatch: createInitialBatchState(),
            updatedAt: Date.now(),
          });

          logger.info('[CloudflareAgent][RECOVER] Batch state cleared', {
            hadActiveBatch,
            activeBatchId: this.state.activeBatch?.batchId,
            hadPendingBatch,
            pendingBatchId: this.state.pendingBatch?.batchId,
          });

          if (!hadActiveBatch && !hadPendingBatch) {
            return '✅ No stuck batches detected. System is healthy.';
          }

          return `🔧 Recovered from stuck state. Cleared: ${hadActiveBatch ? 'activeBatch' : ''}${hadActiveBatch && hadPendingBatch ? ' + ' : ''}${hadPendingBatch ? 'pendingBatch' : ''}. Try sending a message again.`;
        }
        default:
          // Return null for unknown commands - will fall back to chat/tools/MCP
          return null;
      }
    }

    /**
     * @deprecated Use handleBuiltinCommand instead
     * Kept for backward compatibility
     */
    async handleCommand(text: string): Promise<string> {
      return (
        (await this.handleBuiltinCommand(text)) ??
        `Unknown command: ${text.split(' ')[0]}. Try /help for available commands.`
      );
    }

    /**
     * Transform slash command to natural language for LLM
     * e.g., "/translate hello" → "translate: hello"
     * e.g., "/math 1 + 1" → "math: 1 + 1"
     */
    transformSlashCommand(text: string): string {
      // Remove leading slash and split into command + args
      const withoutSlash = text.slice(1);
      const spaceIndex = withoutSlash.indexOf(' ');

      if (spaceIndex === -1) {
        // Just command, no args: "/translate" → "translate"
        return withoutSlash;
      }

      const command = withoutSlash.slice(0, spaceIndex);
      const args = withoutSlash.slice(spaceIndex + 1).trim();

      // Format as "command: args" for clear intent
      return `${command}: ${args}`;
    }

    /**
     * Check if routing is enabled for this request.
     * Routing is always enabled when routerConfig is present.
     */
    shouldRoute(_userId?: string): boolean {
      if (!routerConfig) {
        return false;
      }

      if (routerConfig.debug) {
        logger.info('[CloudflareAgent][ROUTER] shouldRoute: routing enabled');
      }

      return true;
    }

    /**
     * Route a query through RouterAgent if enabled
     * Returns null if routing is disabled or RouterAgent is unavailable
     */
    async routeQuery(query: string, context: AgentContext): Promise<AgentResult | null> {
      if (!routerConfig) {
        return null;
      }

      const env = (this as unknown as { env: TEnv }).env;
      const routerEnv = env as unknown as RouterAgentEnv & {
        RouterAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
      };

      // Check if RouterAgent binding is available
      if (!routerEnv.RouterAgent) {
        if (routerConfig.debug) {
          logger.warn('[CloudflareAgent][ROUTER] RouterAgent binding not available');
        }
        return null;
      }

      try {
        // Get RouterAgent by session/chat ID for state persistence
        const routerId = context.chatId?.toString() || context.userId?.toString() || 'default';
        const routerAgent = await getAgentByName(routerEnv.RouterAgent, routerId);

        // Call the route method, passing current conversation history
        const result = await (
          routerAgent as unknown as {
            route: (query: string, context: AgentContext) => Promise<AgentResult>;
          }
        ).route(query, {
          ...context,
          platform: routerConfig.platform,
          conversationHistory: this.state.messages,
        });

        if (routerConfig.debug) {
          logger.info('[CloudflareAgent][ROUTER] Route result', {
            success: result.success,
            durationMs: result.durationMs,
          });
        }

        // If result contains new messages, save them to state
        if (
          result?.success &&
          result.data &&
          typeof result.data === 'object' &&
          'newMessages' in result.data
        ) {
          const newMessages = (result.data as { newMessages: Message[] }).newMessages;
          this.setState({
            ...this.state,
            messages: trimHistory([...this.state.messages, ...newMessages], maxHistory),
            updatedAt: Date.now(),
          });
        }

        return result;
      } catch (error) {
        logger.error('[CloudflareAgent][ROUTER] Failed to route query', {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    }

    /**
     * Get routing statistics from RouterAgent if available
     */
    async getRoutingStats(): Promise<{
      totalRouted: number;
      byTarget: Record<string, number>;
      avgDurationMs: number;
    } | null> {
      if (!routerConfig) {
        return null;
      }

      const env = (this as unknown as { env: TEnv }).env;
      const routerEnv = env as unknown as RouterAgentEnv & {
        RouterAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
      };

      if (!routerEnv.RouterAgent) {
        return null;
      }

      try {
        const routerId =
          this.state.chatId?.toString() || this.state.userId?.toString() || 'default';
        const routerAgent = await getAgentByName(routerEnv.RouterAgent, routerId);

        return (
          routerAgent as unknown as {
            getStats: () => {
              totalRouted: number;
              byTarget: Record<string, number>;
              avgDurationMs: number;
            };
          }
        ).getStats();
      } catch (error) {
        logger.error('[CloudflareAgent][ROUTER] Failed to get stats', {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    }

    /**
     * Get routing history from RouterAgent if available
     */
    async getRoutingHistory(limit?: number): Promise<unknown[] | null> {
      if (!routerConfig) {
        return null;
      }

      const env = (this as unknown as { env: TEnv }).env;
      const routerEnv = env as unknown as RouterAgentEnv & {
        RouterAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
      };

      if (!routerEnv.RouterAgent) {
        return null;
      }

      try {
        const routerId =
          this.state.chatId?.toString() || this.state.userId?.toString() || 'default';
        const routerAgent = await getAgentByName(routerEnv.RouterAgent, routerId);

        return (
          routerAgent as unknown as {
            getRoutingHistory: (limit?: number) => unknown[];
          }
        ).getRoutingHistory(limit);
      } catch (error) {
        logger.error('[CloudflareAgent][ROUTER] Failed to get history', {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    }

    /**
     * Schedule routing to RouterAgent without blocking (fire-and-forget pattern)
     *
     * Instead of blocking on routeQuery(), this method schedules the work
     * on RouterAgent via its alarm handler. The caller returns immediately
     * after scheduling, and RouterAgent handles response delivery.
     *
     * @param query - The query to route
     * @param context - Agent context
     * @param responseTarget - Where to send the response (includes admin context for debug footer)
     * @returns Promise<boolean> - true if scheduling succeeded
     */
    private async scheduleRouting(
      query: string,
      context: AgentContext,
      responseTarget: {
        chatId: string;
        messageRef: { messageId: number };
        platform: string;
        botToken?: string | undefined;
        /** Admin username for debug footer (Phase 5) */
        adminUsername?: string | undefined;
        /** Current user's username for admin check (Phase 5) */
        username?: string | undefined;
      }
    ): Promise<boolean> {
      if (!routerConfig) {
        return false;
      }

      const env = (this as unknown as { env: TEnv }).env;
      const routerEnv = env as unknown as RouterAgentEnv & {
        RouterAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
      };

      if (!routerEnv.RouterAgent) {
        logger.warn('[CloudflareAgent] RouterAgent binding not available for scheduling');
        return false;
      }

      try {
        const routerId = context.chatId?.toString() || context.userId?.toString() || 'default';
        const routerAgent = await getAgentByName(routerEnv.RouterAgent, routerId);

        // Call fire-and-forget method on RouterAgent
        const result = await (
          routerAgent as unknown as {
            scheduleExecution: (
              query: string,
              context: AgentContext,
              target: typeof responseTarget
            ) => Promise<{ scheduled: boolean; executionId: string }>;
          }
        ).scheduleExecution(query, context, responseTarget);

        logger.info('[CloudflareAgent] Delegated to RouterAgent (fire-and-forget)', {
          executionId: result.executionId,
          scheduled: result.scheduled,
          chatId: responseTarget.chatId,
        });

        return result.scheduled;
      } catch (error) {
        logger.error('[CloudflareAgent] Failed to schedule routing', {
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    }

    /**
     * Handle incoming message context
     * Routes to command handler or chat, then sends response via transport
     *
     * @param ctx - Platform-specific context
     * @throws Error if transport is not configured
     */
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
      // Legacy rotator for batch processing (not yet migrated)
      let rotator: ReturnType<typeof createThinkingRotator> | undefined;

      try {
        // Call beforeHandle hook
        if (hooks?.beforeHandle) {
          await hooks.beforeHandle(ctx);
        }

        let response = '';
        let chatMessage: string = input.text;

        // Route: Built-in Command, Dynamic Command, or Chat
        if (input.text.startsWith('/')) {
          // Try built-in commands first (/start, /help, /clear)
          const builtinResponse = await this.handleBuiltinCommand(input.text);

          if (builtinResponse !== null) {
            // Built-in command handled - send response directly
            response = builtinResponse;
            await transport.send(ctx, response);
          } else {
            // Unknown command - transform to chat message for tools/MCP/LLM
            // e.g., "/translate hello" → "translate: hello"
            chatMessage = this.transformSlashCommand(input.text);
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
          messageRef = await transport.send(ctx, '🔄 Thinking...');

          // Create step progress tracker for real-time step visibility
          if (transport.edit) {
            stepTracker = new StepProgressTracker(
              async (message) => {
                try {
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
            // Check if routing is enabled for this user
            const userIdStr = input.userId?.toString();
            const useRouting = this.shouldRoute(userIdStr);

            if (useRouting) {
              // Build agent context for RouterAgent
              const agentContext: AgentContext = {
                query: chatMessage,
                userId: input.userId?.toString(),
                chatId: input.chatId?.toString(),
                ...(input.username && { username: input.username }),
                platform: routerConfig?.platform || 'api',
                ...(input.metadata && { data: input.metadata }),
              };

              logger.info('[CloudflareAgent][HANDLE] Routing enabled, calling RouterAgent', {
                platform: agentContext.platform,
                userId: agentContext.userId,
              });

              // Try routing through RouterAgent
              const routeResult = await this.routeQuery(chatMessage, agentContext);

              if (routeResult?.success && routeResult.content) {
                // Emit routing step to show which agent handled the query
                const routedTo =
                  (routeResult.data as Record<string, unknown>)?.routedTo ?? 'unknown';
                await stepTracker?.addStep({
                  type: 'routing',
                  agentName: String(routedTo),
                });

                // Routing succeeded - use the routed response
                response = routeResult.content;
                logger.info('[CloudflareAgent][HANDLE] RouterAgent returned response', {
                  routedTo,
                  durationMs: routeResult.durationMs,
                });
              } else {
                // Routing failed or returned null - fall back to direct chat
                logger.info(
                  '[CloudflareAgent][HANDLE] Routing failed or unavailable, falling back to chat()'
                );
                response = await this.chat(chatMessage, stepTracker);
              }
            } else {
              // Routing disabled - use direct chat
              logger.info('[CloudflareAgent][HANDLE] Routing disabled, using direct chat()');
              response = await this.chat(chatMessage, stepTracker);
            }
          } finally {
            // Stop step tracker (stops any rotation timers)
            stepTracker?.destroy();
          }

          // Edit thinking message with actual response
          if (transport.edit) {
            try {
              logger.info(`[CloudflareAgent][HANDLE] Editing final response: ${response}`);
              await transport.edit(ctx, messageRef, response);
            } catch (editError) {
              // Fallback: send new message if edit fails (e.g., message deleted)
              logger.error(
                `[CloudflareAgent][HANDLE] Edit failed, sending new message: ${editError}`
              );
              await transport.send(ctx, response);
            }
          } else {
            // Transport doesn't support edit, send new message
            await transport.send(ctx, response);
          }
        }

        // Call afterHandle hook (for command responses)
        if (hooks?.afterHandle) {
          await hooks.afterHandle(ctx, response);
        }
      } catch (error) {
        // Stop step tracker if still running
        stepTracker?.destroy();
        // Legacy rotator cleanup (for batch processing)
        rotator?.stop();

        logger.error(`[CloudflareAgent][HANDLE] Error: ${error}`);

        // Edit thinking message to show error (if we have a message to edit)
        if (messageRef && transport.edit) {
          const errorMessage = '❌ Sorry, an error occurred. Please try again later.';
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
      } finally {
        // Always reset processing flag
        this._processing = false;
      }
    }

    /**
     * Queue a message for batch processing with alarm-based execution
     * Messages arriving within the batch window are combined into a single LLM call
     *
     * TWO-BATCH QUEUE ARCHITECTURE:
     * - activeBatch: Currently being processed (IMMUTABLE)
     * - pendingBatch: Collecting new messages (MUTABLE)
     * - NEW messages ALWAYS go to pendingBatch, NEVER to activeBatch
     */
    async queueMessage(ctx: TContext): Promise<{ queued: boolean; batchId?: string }> {
      if (!transport) {
        throw new Error(
          'Transport not configured. Pass transport in config to use queueMessage().'
        );
      }

      const input = transport.parseContext(ctx);
      const requestId = (input.metadata?.requestId as string) || crypto.randomUUID();
      const now = Date.now();

      // Detect and recover from stuck activeBatch
      // This prevents a failed/stuck batch from blocking all future message processing
      let recoveredFromStuck = false;
      if (this.state.activeBatch) {
        const stuckCheck = isBatchStuckByHeartbeat(this.state.activeBatch);
        if (stuckCheck.isStuck) {
          logger.warn('[CloudflareAgent][BATCH] Detected stuck activeBatch, recovering', {
            batchId: this.state.activeBatch.batchId,
            reason: stuckCheck.reason,
            lastHeartbeat: this.state.activeBatch.lastHeartbeat,
            status: this.state.activeBatch.status,
          });
          // Clear stuck activeBatch to allow new messages to process
          const { activeBatch: _removed, ...stateWithoutActive } = this.state;
          this.setState({
            ...stateWithoutActive,
            updatedAt: now,
          });
          recoveredFromStuck = true;
        }
      }

      // Get or create pendingBatch (NEW messages ALWAYS go here)
      const pendingBatch = this.state.pendingBatch ?? createInitialBatchState();

      // Check for duplicates across BOTH batches
      if (isDuplicateInBothBatches(requestId, this.state.activeBatch, pendingBatch)) {
        logger.info(`[CloudflareAgent][BATCH] Duplicate request ${requestId}, skipping`);
        return { queued: false };
      }

      // Create pending message with original context for transport operations
      const pendingMessage: PendingMessage<TContext> = {
        text: input.text,
        timestamp: now,
        requestId,
        userId: input.userId,
        chatId: input.chatId,
        ...(input.username && { username: input.username }),
        originalContext: ctx,
      };

      // Add to pendingBatch
      pendingBatch.pendingMessages.push(pendingMessage);
      pendingBatch.lastMessageAt = now;

      // Initialize pendingBatch if this is the first message
      if (pendingBatch.status === 'idle') {
        pendingBatch.status = 'collecting';
        pendingBatch.batchStartedAt = now;
        pendingBatch.batchId = crypto.randomUUID();
      }

      // Determine if we need to schedule alarm
      // Schedule if: (1) no active batch AND first message, OR (2) just recovered from stuck,
      // OR (3) orphaned pending batch (alarm was lost due to deployment/hibernation/SDK issue)
      const isFirstMessage = pendingBatch.pendingMessages.length === 1;
      const hasNoActiveProcessing = !this.state.activeBatch;
      const shouldScheduleNormal = hasNoActiveProcessing && isFirstMessage;
      const shouldScheduleAfterRecovery =
        recoveredFromStuck && pendingBatch.pendingMessages.length > 0;

      // FIX: Also schedule if we have pending messages but no active batch and not first message
      // This handles the edge case where a previous alarm was lost (e.g., due to deployment,
      // DO hibernation, or SDK issue). Without this, messages accumulate forever.
      const hasOrphanedPendingBatch =
        hasNoActiveProcessing &&
        !isFirstMessage &&
        pendingBatch.pendingMessages.length > 0 &&
        pendingBatch.status === 'collecting';

      const shouldSchedule =
        shouldScheduleNormal || shouldScheduleAfterRecovery || hasOrphanedPendingBatch;

      // Update state with new pendingBatch
      this.setState({
        ...this.state,
        pendingBatch,
        updatedAt: now,
      });

      logger.info('[CloudflareAgent][BATCH] Message queued to pendingBatch', {
        requestId,
        batchId: pendingBatch.batchId,
        pendingCount: pendingBatch.pendingMessages.length,
        hasActiveBatch: !!this.state.activeBatch,
        recoveredFromStuck,
        hasOrphanedPendingBatch,
        willScheduleAlarm: shouldSchedule,
      });

      // Schedule alarm if conditions met
      if (shouldSchedule) {
        const reason = shouldScheduleAfterRecovery
          ? 'recovered_from_stuck'
          : hasOrphanedPendingBatch
            ? 'orphaned_pending_batch'
            : 'first_pending_message';
        logger.info(`[CloudflareAgent][BATCH] Scheduling alarm (${reason})`);

        try {
          await this.schedule(1, 'onBatchAlarm', {
            batchId: pendingBatch.batchId,
          });
          logger.info('[CloudflareAgent][BATCH][ALARM] Scheduled', {
            batchId: pendingBatch.batchId,
            delayMs: 1000,
            scheduledFor: Date.now() + 1000,
            reason,
          });
        } catch (scheduleError) {
          // CRITICAL FIX: If schedule() fails, fall back to direct processing
          // This prevents messages from being stuck forever when alarm scheduling fails
          logger.error('[CloudflareAgent][BATCH][ALARM] Schedule failed, processing immediately', {
            batchId: pendingBatch.batchId,
            error: scheduleError instanceof Error ? scheduleError.message : String(scheduleError),
          });

          // Fall back to direct processing via micro-task to avoid blocking
          queueMicrotask(() => {
            this.onBatchAlarm({ batchId: pendingBatch.batchId }).catch((err) => {
              logger.error('[CloudflareAgent][BATCH] Fallback processing failed', {
                batchId: pendingBatch.batchId,
                error: err instanceof Error ? err.message : String(err),
              });
            });
          });
        }
      }

      // Return result
      const result: { queued: boolean; batchId?: string } = { queued: true };
      if (pendingBatch.batchId) {
        result.batchId = pendingBatch.batchId;
      }
      return result;
    }

    /**
     * Alarm handler for batch processing
     * Called by Cloudflare Agents SDK schedule system
     *
     * TWO-BATCH QUEUE LOGIC:
     * 1. Check if already processing (activeBatch exists) → skip
     * 2. Promote pendingBatch to activeBatch atomically
     * 3. Clear pendingBatch
     * 4. Process activeBatch
     * 5. On success: clear activeBatch, schedule alarm if pendingBatch has messages
     * 6. On failure: clear activeBatch, don't retry (discard stuck messages)
     */
    async onBatchAlarm(_data: { batchId: string | null }): Promise<void> {
      logger.info('[CloudflareAgent][BATCH][ALARM] Fired', {
        batchId: _data.batchId,
        firedAt: Date.now(),
        hasActiveBatch: !!this.state.activeBatch,
        hasPendingBatch: !!this.state.pendingBatch,
        pendingCount: this.state.pendingBatch?.pendingMessages.length || 0,
        activeCount: this.state.activeBatch?.pendingMessages.length || 0,
      });

      // Check if already processing - but also check for stuck state
      if (this.state.activeBatch) {
        // CRITICAL FIX: Check if activeBatch is stuck before skipping
        // Previously, a stuck batch would block all future processing until user sent a new message
        const stuckCheck = isBatchStuckByHeartbeat(this.state.activeBatch);

        if (stuckCheck.isStuck) {
          logger.warn(
            '[CloudflareAgent][BATCH][ALARM] Active batch stuck, clearing to allow processing',
            {
              batchId: this.state.activeBatch.batchId,
              reason: stuckCheck.reason,
              lastHeartbeat: this.state.activeBatch.lastHeartbeat,
              status: this.state.activeBatch.status,
            }
          );

          // Clear stuck activeBatch and continue to process pendingBatch
          const { activeBatch: _removed, ...stateWithoutActive } = this.state;
          this.setState({
            ...stateWithoutActive,
            updatedAt: Date.now(),
          });
          // Don't return - continue to process pendingBatch below
        } else {
          // Active batch is healthy - skip this alarm
          logger.info('[CloudflareAgent][BATCH] activeBatch healthy, skipping alarm');
          return;
        }
      }

      // Check if there are pending messages to process
      if (!this.state.pendingBatch || this.state.pendingBatch.pendingMessages.length === 0) {
        logger.info('[CloudflareAgent][BATCH] No pending messages to process');
        return;
      }

      const now = Date.now();

      // Promote pendingBatch to activeBatch atomically
      const activeBatch: BatchState = {
        ...this.state.pendingBatch,
        status: 'processing',
        lastHeartbeat: now, // Initialize heartbeat for stuck detection
      };

      // Clear pendingBatch immediately
      this.setState({
        ...this.state,
        activeBatch,
        pendingBatch: createInitialBatchState(),
        updatedAt: now,
      });

      logger.info('[CloudflareAgent][BATCH] Promoted pendingBatch to activeBatch', {
        batchId: activeBatch.batchId,
        messageCount: activeBatch.pendingMessages.length,
      });

      // Track batch start time for duration calculation
      this._batchStartTime = now;

      // Report to State DO: batch started
      const firstMessage = activeBatch.pendingMessages[0];
      if (firstMessage) {
        const sessionId =
          this.state.chatId?.toString() ||
          this.state.userId?.toString() ||
          activeBatch.batchId ||
          '';

        // Build responseTarget only if we have original context
        const responseTarget: StateResponseTarget | null = firstMessage.originalContext
          ? { chatId: firstMessage.chatId?.toString() || '' }
          : null;

        const registerParams: RegisterBatchParams = {
          sessionId,
          batchId: activeBatch.batchId || '',
          platform: this.getPlatform(),
          userId: firstMessage.userId?.toString() || '',
          chatId: firstMessage.chatId?.toString() || '',
          responseTarget,
        };
        this.reportToStateDO('registerBatch', registerParams);
      }

      try {
        await this.processBatch();

        // Success - clear activeBatch
        const { activeBatch: _removed, ...stateWithoutActive } = this.state;
        const newState: CloudflareAgentState = {
          ...stateWithoutActive,
          updatedAt: Date.now(),
        };
        this.setState(newState);

        logger.info('[CloudflareAgent][BATCH] Batch processed successfully', {
          batchId: activeBatch.batchId,
        });

        // Report to State DO: batch completed successfully
        const completedSessionId =
          this.state.chatId?.toString() ||
          this.state.userId?.toString() ||
          activeBatch.batchId ||
          '';
        const completeParams: CompleteBatchParams = {
          sessionId: completedSessionId,
          batchId: activeBatch.batchId || '',
          success: true,
          durationMs: Date.now() - this._batchStartTime,
        };
        this.reportToStateDO('completeBatch', completeParams);

        // Check if new messages arrived during processing
        const currentPendingBatch = this.state.pendingBatch;
        if (currentPendingBatch && currentPendingBatch.pendingMessages.length > 0) {
          logger.info(
            '[CloudflareAgent][BATCH] New messages arrived during processing, scheduling alarm',
            {
              pendingCount: currentPendingBatch.pendingMessages.length,
              pendingBatchId: currentPendingBatch.batchId,
            }
          );
          await this.schedule(1, 'onBatchAlarm', {
            batchId: currentPendingBatch.batchId,
          });
        }
      } catch (error) {
        logger.error('[CloudflareAgent][BATCH] Batch processing failed', {
          batchId: activeBatch.batchId,
          error: error instanceof Error ? error.message : String(error),
        });

        // Report to State DO: batch failed
        const failedSessionId =
          this.state.chatId?.toString() ||
          this.state.userId?.toString() ||
          activeBatch.batchId ||
          '';
        const failedParams: CompleteBatchParams = {
          sessionId: failedSessionId,
          batchId: activeBatch.batchId || '',
          success: false,
          durationMs: Date.now() - this._batchStartTime,
          error: error instanceof Error ? error.message : String(error),
        };
        this.reportToStateDO('completeBatch', failedParams);

        // Failure - discard activeBatch (don't retry stuck messages)
        const { activeBatch: _removed, ...stateWithoutActive } = this.state;
        const newState: CloudflareAgentState = {
          ...stateWithoutActive,
          updatedAt: Date.now(),
        };
        this.setState(newState);

        // Send error message to user if transport available
        if (transport) {
          const firstMessage = activeBatch.pendingMessages[0];
          if (firstMessage?.originalContext) {
            try {
              await transport.send(
                firstMessage.originalContext as TContext,
                '❌ Sorry, an error occurred processing your message. Please try again.'
              );
            } catch (sendError) {
              logger.error('[CloudflareAgent][BATCH] Failed to send error message', {
                error: sendError instanceof Error ? sendError.message : String(sendError),
              });
            }
          }
        }

        // If pendingBatch has new messages, schedule alarm to process them
        const currentPendingBatch = this.state.pendingBatch;
        if (currentPendingBatch && currentPendingBatch.pendingMessages.length > 0) {
          logger.info('[CloudflareAgent][BATCH] Scheduling retry for pendingBatch after error', {
            pendingCount: currentPendingBatch.pendingMessages.length,
            pendingBatchId: currentPendingBatch.batchId,
          });
          await this.schedule(2, 'onBatchAlarm', {
            batchId: currentPendingBatch.batchId,
          });
        }
      }
    }

    /**
     * Process the current batch of messages
     * Combines messages and sends to LLM
     *
     * TWO-BATCH ARCHITECTURE:
     * - Only processes activeBatch (immutable during processing)
     * - pendingBatch continues collecting new messages independently
     */
    private async processBatch(): Promise<void> {
      const batch = this.state.activeBatch;
      if (!batch || batch.pendingMessages.length === 0) {
        return;
      }

      if (!transport) {
        throw new Error('Transport not configured');
      }

      // Check if first message is /clear command - process alone and discard others
      const firstMessage = batch.pendingMessages[0];
      if (!firstMessage) {
        return; // Should never happen due to length check above, but TypeScript needs this
      }

      const firstText = firstMessage.text ?? '';
      const firstCommand = firstText.split(/[\s\n]/)[0]?.toLowerCase();

      if (firstCommand === '/clear') {
        logger.info(
          '[CloudflareAgent][BATCH] Detected /clear - processing alone and discarding other messages',
          {
            batchId: batch.batchId,
            messageCount: batch.pendingMessages.length,
            discardedCount: batch.pendingMessages.length - 1,
          }
        );

        // Use originalContext from first message to preserve platform-specific data
        // Fall back to minimal context only if originalContext is missing (shouldn't happen in normal operation)
        const baseCtx =
          firstMessage.originalContext ??
          ({
            chatId: firstMessage.chatId,
            userId: firstMessage.userId,
            text: firstText,
            metadata: { requestId: batch.batchId },
          } as TContext);

        // Update the text (originalContext may have original single message text)
        const ctx = {
          ...baseCtx,
          text: firstText,
        } as TContext;

        // Initialize state with user/chat context
        await this.init(firstMessage.userId, firstMessage.chatId);

        // Process /clear command through normal handle() flow
        // This will call handleBuiltinCommand() which clears state and sends response
        await this.handle(ctx);

        // Done - other messages in batch are intentionally discarded
        return;
      }

      // Normal batch processing for non-clear messages
      // Combine messages
      const combinedText = combineBatchMessages(batch.pendingMessages);

      logger.info('[CloudflareAgent][BATCH] Combined messages', {
        combinedText,
        count: batch.pendingMessages.length,
        combinedLength: combinedText.length,
      });

      // Use originalContext from first message to preserve platform-specific data (e.g., bot token)
      // Fall back to minimal context only if originalContext is missing (shouldn't happen in normal operation)
      const baseCtx =
        firstMessage?.originalContext ??
        ({
          chatId: firstMessage?.chatId,
          userId: firstMessage?.userId,
          text: combinedText,
          metadata: { requestId: batch.batchId },
        } as TContext);

      // Update the text to combined messages (originalContext has original single message text)
      const ctx = {
        ...baseCtx,
        text: combinedText,
      } as TContext;

      // Initialize state with user/chat context
      await this.init(firstMessage?.userId, firstMessage?.chatId);

      // Send typing indicator
      if (transport.typing) {
        await transport.typing(ctx);
      }

      // Create thinking message rotator
      const rotator = createThinkingRotator({
        messages: config.thinkingMessages ?? getDefaultThinkingMessages(),
        interval: config.thinkingRotationInterval ?? 5000,
      });

      // Send initial thinking message
      const messageRef = await transport.send(ctx, rotator.getCurrentMessage());

      // Update activeBatch state with message ref
      this.setState({
        ...this.state,
        activeBatch: { ...batch, messageRef },
        updatedAt: Date.now(),
      });

      // Start rotation if transport supports edit
      // The rotator also serves as a heartbeat - we record lastHeartbeat on each rotation
      if (transport.edit) {
        rotator.start(async (nextMessage) => {
          try {
            // Update heartbeat FIRST - proves DO is alive regardless of edit success
            // This prevents false stuck detection when user deletes the "thinking" message
            const currentBatch = this.state.activeBatch;
            if (currentBatch) {
              this.setState({
                ...this.state,
                activeBatch: {
                  ...currentBatch,
                  lastHeartbeat: Date.now(),
                },
                updatedAt: Date.now(),
              });

              // Report heartbeat to State DO
              const heartbeatSessionId =
                this.state.chatId?.toString() ||
                this.state.userId?.toString() ||
                currentBatch.batchId ||
                '';
              const heartbeatParams: HeartbeatParams = {
                sessionId: heartbeatSessionId,
                batchId: currentBatch.batchId || '',
              };
              this.reportToStateDO('heartbeat', heartbeatParams);
            }

            // Refresh typing indicator every rotation cycle (5s)
            // Telegram's typing indicator only lasts ~5s, so we refresh it
            if (transport.typing) {
              await transport.typing(ctx);
            }

            // Then attempt edit (may fail if message was deleted by user)
            await transport.edit!(ctx, messageRef, nextMessage);
          } catch (err) {
            // Edit failed (message deleted, network error, etc.)
            // Heartbeat already updated above, so DO won't be marked as stuck
            logger.error(`[CloudflareAgent][BATCH] Rotator edit failed: ${err}`);
          }
        });
      }

      try {
        let response: string;

        // Check if routing is enabled
        const userIdStr = firstMessage?.userId?.toString();
        const useRouting = this.shouldRoute(userIdStr);

        if (useRouting) {
          // Build context conditionally to satisfy exactOptionalPropertyTypes
          const agentContext: AgentContext = {
            query: combinedText,
            platform: routerConfig?.platform || 'api',
            ...(firstMessage?.userId !== undefined && {
              userId: firstMessage.userId.toString(),
            }),
            ...(firstMessage?.chatId !== undefined && {
              chatId: firstMessage.chatId.toString(),
            }),
          };

          // Try fire-and-forget pattern first - delegate to RouterAgent via alarm
          // This prevents blockConcurrencyWhile timeout by returning immediately
          const env = (this as unknown as { env: TEnv }).env;
          const envWithToken = env as unknown as {
            TELEGRAM_BOT_TOKEN?: string;
            ADMIN_USERNAME?: string;
          };

          // Extract admin context from ctx for debug footer
          // ctx may have adminUsername/username from TelegramContext
          const ctxWithAdmin = ctx as {
            adminUsername?: string;
            username?: string;
          };

          const scheduled = await this.scheduleRouting(combinedText, agentContext, {
            chatId: firstMessage?.chatId?.toString() || '',
            messageRef: { messageId: messageRef as number },
            platform: routerConfig?.platform || 'telegram',
            botToken: envWithToken.TELEGRAM_BOT_TOKEN,
            // Pass admin context for debug footer (Phase 5)
            adminUsername: ctxWithAdmin.adminUsername || envWithToken.ADMIN_USERNAME,
            username: ctxWithAdmin.username || firstMessage?.username,
          });

          if (scheduled) {
            // Successfully delegated to RouterAgent - it will handle response delivery
            rotator.stop();

            // Mark activeBatch as delegated (not completed yet - RouterAgent will complete it)
            this.setState({
              ...this.state,
              activeBatch: { ...batch, status: 'delegated' },
              updatedAt: Date.now(),
            });

            logger.info(
              '[CloudflareAgent][BATCH] Delegated to RouterAgent, returning immediately',
              {
                batchId: batch.batchId,
              }
            );

            return; // Exit immediately - don't block waiting for LLM response
          }

          // Fire-and-forget scheduling failed - fall back to direct chat
          logger.info(
            '[CloudflareAgent][BATCH] Fire-and-forget scheduling failed, falling back to chat()'
          );
          response = await this.chat(combinedText);
        } else {
          // Routing disabled - use direct chat
          response = await this.chat(combinedText);
        }

        rotator.stop();

        // Edit thinking message with response
        if (transport.edit) {
          try {
            await transport.edit(ctx, messageRef, response);
          } catch {
            await transport.send(ctx, response);
          }
        } else {
          await transport.send(ctx, response);
        }

        // Call afterHandle hook if available
        if (hooks?.afterHandle) {
          await hooks.afterHandle(ctx, response);
        }
      } finally {
        rotator.stop();
      }
    }

    /**
     * Get current batch state for debugging/monitoring
     */
    getBatchState(): { activeBatch?: BatchState; pendingBatch?: BatchState } {
      const result: { activeBatch?: BatchState; pendingBatch?: BatchState } = {};
      if (this.state.activeBatch) {
        result.activeBatch = this.state.activeBatch;
      }
      if (this.state.pendingBatch) {
        result.pendingBatch = this.state.pendingBatch;
      }
      return result;
    }
  };

  return AgentClass as CloudflareChatAgentClass<TEnv, TContext>;
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
export function getChatAgent<TEnv, TContext>(
  namespace: CloudflareChatAgentNamespace<TEnv, TContext>,
  name: string
) {
  const id = namespace.idFromName(name);
  return namespace.get(id);
}
