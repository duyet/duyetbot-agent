/**
 * Cloudflare Durable Object Agent with direct LLM integration
 *
 * Simplified design: No ChatAgent wrapper, calls LLM directly in chat().
 * State persistence via Durable Object storage.
 */

import { Agent, type AgentNamespace, type Connection } from 'agents';
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
}

// Re-export types for backward compatibility
export type { MemoryServiceBinding } from './service-binding-adapter.js';

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
): typeof Agent<TEnv, CloudflareAgentState> {
  const maxHistory = config.maxHistory ?? 100;
  const transport = config.transport;
  const hooks = config.hooks;
  const mcpServers = config.mcpServers ?? [];

  return class CloudflareChatAgent extends Agent<TEnv, CloudflareAgentState> {
    override initialState: CloudflareAgentState = {
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    private _mcpInitialized = false;

    /**
     * Initialize MCP server connections
     */
    async initMcp(): Promise<void> {
      if (this._mcpInitialized || mcpServers.length === 0) {
        return;
      }

      const env = (this as unknown as { env: TEnv }).env;

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

          console.log(`[MCP] Connecting to ${server.name} at ${server.url}`);
          const result = await this.mcp.connect(server.url, options);
          console.log(`[MCP] Connected to ${server.name}: ${result.id}`);
        } catch (error) {
          console.error(`[MCP] Failed to connect to ${server.name}:`, error);
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
      console.log('State updated:', state, 'Source:', source);
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
      // Initialize MCP connections if configured
      await this.initMcp();

      // Get LLM provider from environment bindings
      // Note: Type assertion needed due to TypeScript limitation with anonymous class inheritance
      const llmProvider = config.createProvider((this as unknown as { env: TEnv }).env);

      // Get available tools from MCP servers
      const tools = this.getMcpTools();
      const hasTools = tools.length > 0;

      // Build messages for LLM call
      const llmMessages = [
        { role: 'system' as const, content: config.systemPrompt },
        ...this.state.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content: userMessage },
      ];

      // Call LLM with tools if available
      let response = await llmProvider.chat(llmMessages, hasTools ? tools : undefined);

      // Handle tool calls (up to 5 iterations)
      let iterations = 0;
      const maxIterations = 5;

      while (response.toolCalls && response.toolCalls.length > 0 && iterations < maxIterations) {
        iterations++;
        console.log(
          `[MCP] Processing ${response.toolCalls.length} tool calls (iteration ${iterations})`
        );

        // Add assistant message with tool calls
        llmMessages.push({
          role: 'assistant' as const,
          content: response.content || '',
        });

        // Execute each tool call via MCP
        for (const toolCall of response.toolCalls) {
          try {
            // Parse tool name to get server ID (format: serverId__toolName)
            const [serverId, ...toolNameParts] = toolCall.name.split('__');
            const toolName = toolNameParts.join('__') || toolCall.name;

            console.log(`[MCP] Calling tool: ${toolName} on server ${serverId}`);

            const toolArgs = JSON.parse(toolCall.arguments);
            const result = (await this.mcp.callTool({
              serverId: serverId || '',
              name: toolName,
              arguments: toolArgs,
            })) as { content: Array<{ type: string; text?: string }> };

            // Add tool result to messages
            const resultText = result.content
              .map((c) => (c.type === 'text' ? c.text : JSON.stringify(c)))
              .join('\n');

            // Use 'user' role with tool context for compatibility
            llmMessages.push({
              role: 'user' as const,
              content: `[Tool Result for ${toolCall.name}]: ${resultText}`,
            });
          } catch (error) {
            console.error('[MCP] Tool call failed:', error);
            // Use 'user' role with error context for compatibility
            llmMessages.push({
              role: 'user' as const,
              content: `[Tool Error for ${toolCall.name}]: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }

        // Continue conversation with tool results
        response = await llmProvider.chat(llmMessages, hasTools ? tools : undefined);
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
     * Handle command and return response message
     * Routes /start, /help, /clear to appropriate handlers
     */
    handleCommand(text: string): string {
      const command = (text.split(' ')[0] ?? '').toLowerCase();

      switch (command) {
        case '/start':
          return this.getWelcome();
        case '/help':
          return this.getHelp();
        case '/clear':
          // clearHistory is async but returns string synchronously for command response
          this.setState({
            ...this.state,
            messages: [],
            updatedAt: Date.now(),
          });
          return 'Conversation history cleared.';
        default:
          return `Unknown command: ${command}. Try /help for available commands.`;
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
      if (!transport) {
        throw new Error('Transport not configured. Pass transport in config to use handle().');
      }

      const input = transport.parseContext(ctx);

      // Initialize state with user/chat context
      await this.init(input.userId, input.chatId);

      try {
        // Call beforeHandle hook
        if (hooks?.beforeHandle) {
          await hooks.beforeHandle(ctx);
        }

        let response: string;

        // Route: Command or Chat
        if (input.text.startsWith('/')) {
          response = this.handleCommand(input.text);
        } else {
          // Send typing indicator
          if (transport.typing) {
            await transport.typing(ctx);
          }

          // Process with LLM
          response = await this.chat(input.text);
        }

        // Send response via transport
        await transport.send(ctx, response);

        // Call afterHandle hook
        if (hooks?.afterHandle) {
          await hooks.afterHandle(ctx, response);
        }
      } catch (error) {
        // Call onError hook or rethrow
        if (hooks?.onError) {
          await hooks.onError(ctx, error as Error);
        } else {
          throw error;
        }
      }
    }
  };
}

/**
 * Type helper for agent namespaces
 */
export type CloudflareChatAgentNamespace<TEnv> = AgentNamespace<
  ReturnType<typeof createCloudflareChatAgent<TEnv>> extends new (
    ...args: unknown[]
  ) => infer R
    ? R
    : never
>;
