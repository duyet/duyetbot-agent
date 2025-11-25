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
  type FeatureFlagEnv,
  type RoutingFlags,
  evaluateFlag,
  parseFlagsFromEnv,
} from './feature-flags.js';
import {
  createThinkingRotator,
  formatWithEmbeddedHistory,
  getDefaultThinkingMessages,
} from './format.js';
import { trimHistory } from './history.js';
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
  handleCommand(text: string): string;
  /** Handle built-in commands, returns null for unknown commands */
  handleBuiltinCommand(text: string): string | null;
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

          logger.info(`[MCP] Connecting to ${server.name} at ${server.url}`);
          logger.info(
            `[MCP] Auth header present: ${!!authHeader}, length: ${authHeader?.length || 0}`
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
          logger.info(`[MCP] Connected to ${server.name}: ${result.id}`);
        } catch (error) {
          logger.error(`[MCP] Failed to connect to ${server.name}: ${error}`);
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
      logger.info(`State updated: ${JSON.stringify(state)}, Source: ${source}`);
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
     */
    async chat(userMessage: string): Promise<string> {
      // Trim history if it exceeds maxHistory (handles bloated state from older versions)
      if (this.state.messages.length > maxHistory) {
        logger.info(
          `[CHAT] Trimming bloated history: ${this.state.messages.length} -> ${maxHistory}`
        );
        const trimmedMessages = trimHistory(this.state.messages, maxHistory);
        this.setState({
          ...this.state,
          messages: trimmedMessages,
          updatedAt: Date.now(),
        });
      }

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
          logger.info(`[TOOLS] Skipping duplicate tool: ${name}`);
          return false;
        }
        seenNames.add(name);
        return true;
      });

      // Apply maxTools limit if configured
      if (maxTools !== undefined && deduplicatedTools.length > maxTools) {
        logger.info(`[TOOLS] Limiting tools from ${deduplicatedTools.length} to ${maxTools}`);
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
          `[MCP] Processing ${response.toolCalls.length} tool calls (iteration ${iterations})`
        );

        // Add assistant message with tool calls to tool conversation
        toolConversation.push({
          role: 'assistant' as const,
          content: response.content || '',
        });

        // Execute each tool call (built-in or MCP)
        for (const toolCall of response.toolCalls) {
          try {
            const toolArgs = JSON.parse(toolCall.arguments);
            let resultText: string;

            // Check if it's a built-in tool first
            const builtinTool = builtinToolMap.get(toolCall.name);
            if (builtinTool) {
              logger.info(`[TOOL] Calling built-in tool: ${toolCall.name}`);

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

              logger.info(`[MCP] Calling tool: ${toolName} on server ${serverId}`);

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

            // Use 'user' role with tool context for compatibility
            toolConversation.push({
              role: 'user' as const,
              content: `[Tool Result for ${toolCall.name}]: ${resultText}`,
            });
          } catch (error) {
            logger.error(`[TOOL] Tool call failed: ${error}`);
            // Use 'user' role with error context for compatibility
            toolConversation.push({
              role: 'user' as const,
              content: `[Tool Error for ${toolCall.name}]: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }

        // Rebuild messages with embedded history + tool conversation
        // Combine: system prompt + embedded history with user message + tool turns
        const toolMessages = [...llmMessages, ...toolConversation];

        // Continue conversation with tool results
        response = await llmProvider.chat(toolMessages, hasTools ? tools : undefined);
      }

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
    handleBuiltinCommand(text: string): string | null {
      const command = (text.split(' ')[0] ?? '').toLowerCase();

      switch (command) {
        case '/start':
          return this.getWelcome();
        case '/help':
          return this.getHelp();
        case '/clear': {
          // Full DO state reset - clears messages, metadata, and resets MCP
          this._mcpInitialized = false;
          const freshState: CloudflareAgentState = {
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          // Preserve userId/chatId if they exist
          if (this.state.userId !== undefined) {
            freshState.userId = this.state.userId;
          }
          if (this.state.chatId !== undefined) {
            freshState.chatId = this.state.chatId;
          }
          this.setState(freshState);
          return '🧹 All conversation data cleared. Fresh start!';
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
    handleCommand(text: string): string {
      return (
        this.handleBuiltinCommand(text) ??
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
     * Check if routing is enabled for this request based on feature flags
     */
    shouldRoute(userId?: string): boolean {
      if (!routerConfig) {
        return false;
      }

      const env = (this as unknown as { env: TEnv }).env;
      const flags = routerConfig.flags ?? parseFlagsFromEnv(env as FeatureFlagEnv);
      const result = evaluateFlag(flags, userId);

      if (routerConfig.debug) {
        logger.info('[ROUTER] shouldRoute evaluation', {
          userId,
          enabled: result.enabled,
          reason: result.reason,
        });
      }

      return result.enabled;
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
          logger.warn('[ROUTER] RouterAgent binding not available');
        }
        return null;
      }

      try {
        // Get RouterAgent by session/chat ID for state persistence
        const routerId = context.chatId?.toString() || context.userId?.toString() || 'default';
        const routerAgent = await getAgentByName(routerEnv.RouterAgent, routerId);

        // Call the route method
        const result = await (
          routerAgent as unknown as {
            route: (query: string, context: AgentContext) => Promise<AgentResult>;
          }
        ).route(query, {
          ...context,
          platform: routerConfig.platform,
        });

        if (routerConfig.debug) {
          logger.info('[ROUTER] Route result', {
            success: result.success,
            durationMs: result.durationMs,
          });
        }

        return result;
      } catch (error) {
        logger.error('[ROUTER] Failed to route query', {
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
        logger.error('[ROUTER] Failed to get stats', {
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
        logger.error('[ROUTER] Failed to get history', {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
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
      logger.info('[HANDLE] Starting handle()');

      if (!transport) {
        throw new Error('Transport not configured. Pass transport in config to use handle().');
      }

      const input = transport.parseContext(ctx);
      logger.info('[HANDLE] Parsed input', {
        userId: input.userId,
        chatId: input.chatId,
        textLength: input.text.length,
      });

      // Deduplicate requests using requestId from metadata
      const requestId = input.metadata?.requestId as string | undefined;
      if (requestId) {
        const lastRequestId = this.state.metadata?.lastRequestId as string | undefined;
        if (lastRequestId === requestId) {
          logger.info(`[HANDLE] Duplicate request ${requestId}, skipping`);
          return;
        }
      }

      // Prevent concurrent processing (Telegram may send retries)
      if (this._processing) {
        logger.info('[HANDLE] Already processing, skipping duplicate request');
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
          const builtinResponse = this.handleBuiltinCommand(input.text);

          if (builtinResponse !== null) {
            // Built-in command handled - send response directly
            response = builtinResponse;
            await transport.send(ctx, response);
          } else {
            // Unknown command - transform to chat message for tools/MCP/LLM
            // e.g., "/translate hello" → "translate: hello"
            chatMessage = this.transformSlashCommand(input.text);
            logger.info(`[HANDLE] Dynamic command: "${input.text}" → "${chatMessage}"`);

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

          // Create thinking message rotator
          rotator = createThinkingRotator({
            messages: config.thinkingMessages ?? getDefaultThinkingMessages(),
            interval: config.thinkingRotationInterval ?? 5000,
          });

          // Send initial thinking message
          messageRef = await transport.send(ctx, rotator.getCurrentMessage());

          // Start rotation if transport supports edit
          if (transport.edit) {
            rotator.start(async (nextMessage) => {
              try {
                logger.info(`[ROTATOR] Editing to: ${nextMessage}`);
                await transport.edit!(ctx, messageRef!, nextMessage);
              } catch (err) {
                logger.error(`[ROTATOR] Edit failed: ${err}`);
              }
            });
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
                platform: routerConfig?.platform || 'api',
                ...(input.metadata && { data: input.metadata }),
              };

              logger.info('[HANDLE] Routing enabled, calling RouterAgent', {
                platform: agentContext.platform,
                userId: agentContext.userId,
              });

              // Try routing through RouterAgent
              const routeResult = await this.routeQuery(chatMessage, agentContext);

              if (routeResult?.success && routeResult.content) {
                // Routing succeeded - use the routed response
                response = routeResult.content;
                logger.info('[HANDLE] RouterAgent returned response', {
                  routedTo: (routeResult.data as Record<string, unknown>)?.routedTo ?? 'unknown',
                  durationMs: routeResult.durationMs,
                });
              } else {
                // Routing failed or returned null - fall back to direct chat
                logger.info('[HANDLE] Routing failed or unavailable, falling back to chat()');
                response = await this.chat(chatMessage);
              }
            } else {
              // Routing disabled - use direct chat
              logger.info('[HANDLE] Routing disabled, using direct chat()');
              response = await this.chat(chatMessage);
            }
          } finally {
            rotator.stop();
          }

          // Edit thinking message with actual response
          if (transport.edit) {
            try {
              logger.info(`[HANDLE] Editing final response: ${response}`);
              await transport.edit(ctx, messageRef, response);
            } catch (editError) {
              // Fallback: send new message if edit fails (e.g., message deleted)
              logger.error(`[HANDLE] Edit failed, sending new message: ${editError}`);
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
        // Stop rotator if still running
        if (rotator) {
          rotator.stop();
        }

        logger.error(`[HANDLE] Error: ${error}`);

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
