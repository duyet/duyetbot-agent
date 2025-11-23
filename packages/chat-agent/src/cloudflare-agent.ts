/**
 * Cloudflare Durable Object Agent wrapper for ChatAgent
 *
 * This provides a reusable base class for Cloudflare Workers apps
 * that want to use ChatAgent with Durable Object state persistence.
 */

import { Agent, type AgentNamespace } from 'agents';
import { ChatAgent } from './agent.js';
import { createAgent } from './factory.js';
import { DEFAULT_MEMORY_MCP_URL, createResilientMCPMemoryAdapter } from './mcp-memory-adapter.js';
import type { MemoryAdapter } from './memory-adapter.js';
import type { LLMProvider, Message, Tool, ToolExecutor } from './types.js';

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
 */
export interface CloudflareAgentConfig<TEnv> {
  /** Function to create LLM provider from env */
  createProvider: (env: TEnv) => LLMProvider;
  /** System prompt for the agent */
  systemPrompt: string;
  /** Welcome message for /start command */
  welcomeMessage?: string;
  /** Help message for /help command */
  helpMessage?: string;
  /** Maximum messages in history */
  maxHistory?: number;
  /** Available tools */
  tools?: Tool[];
  /** Tool executor */
  onToolCall?: (env: TEnv) => ToolExecutor;
  /** Optional: Override memory MCP URL (defaults to DEFAULT_MEMORY_MCP_URL) */
  memoryMCPUrl?: string;
  /** Optional: Disable memory adapter entirely */
  disableMemory?: boolean;
  /** Optional: Custom memory adapter (overrides auto-config) */
  createMemoryAdapter?: (env: TEnv) => MemoryAdapter | undefined;
  /** Function to generate session ID from context */
  getSessionId?: (userId?: string | number, chatId?: string | number) => string | undefined;
}

/**
 * Create a Cloudflare Durable Object Agent class that wraps ChatAgent
 *
 * @example
 * ```typescript
 * import { createCloudflareChatAgent } from '@duyetbot/chat-agent';
 * import { TELEGRAM_SYSTEM_PROMPT } from '@duyetbot/prompts';
 *
 * export const TelegramAgent = createCloudflareChatAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   systemPrompt: TELEGRAM_SYSTEM_PROMPT,
 *   welcomeMessage: 'Hello! I am your assistant.',
 *   helpMessage: 'Commands: /start, /help, /clear',
 * });
 * ```
 */
export function createCloudflareChatAgent<TEnv>(
  config: CloudflareAgentConfig<TEnv>
): typeof Agent<TEnv, CloudflareAgentState> {
  return class CloudflareChatAgent extends Agent<TEnv, CloudflareAgentState> {
    override initialState: CloudflareAgentState = {
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    /** @internal */
    _chatAgent: ChatAgent | null = null;

    /**
     * Schedule state update asynchronously to avoid blockConcurrencyWhile timeout
     * @internal
     */
    _scheduleStateUpdate(newState: CloudflareAgentState): void {
      // Use direct storage to avoid blockConcurrencyWhile timeout
      // The Agent base class stores state under 'state' key
      const ctx = (
        this as unknown as {
          ctx: {
            waitUntil: (p: Promise<unknown>) => void;
            storage: { put: (key: string, value: unknown) => Promise<void> };
          };
        }
      ).ctx;
      ctx.waitUntil(
        ctx.storage.put('state', newState).catch((err) => {
          console.error('Failed to persist state:', err);
        })
      );
      // Update in-memory state immediately for consistency
      (this as unknown as { state: CloudflareAgentState }).state = newState;
    }

    /**
     * Lazily initialize ChatAgent on first use
     * @internal
     */
    _ensureInitialized(): ChatAgent {
      if (!this._chatAgent) {
        // Access env from the Agent base class
        const env = (this as unknown as { env: TEnv }).env;
        const llmProvider = config.createProvider(env);

        // Generate session ID
        const sessionId = config.getSessionId
          ? config.getSessionId(this.state.userId, this.state.chatId)
          : this._generateDefaultSessionId();

        // Resolve memory adapter
        // Priority: 1. Custom adapter, 2. Auto-config (unless disabled)
        let memoryAdapter: MemoryAdapter | undefined;

        if (config.createMemoryAdapter) {
          // Use custom adapter if provided
          memoryAdapter = config.createMemoryAdapter(env);
        } else if (!config.disableMemory) {
          // Auto-configure with resilient adapter
          const memoryUrl = config.memoryMCPUrl || DEFAULT_MEMORY_MCP_URL;
          const token = (env as Record<string, unknown>).MEMORY_MCP_TOKEN as string | undefined;

          try {
            memoryAdapter = createResilientMCPMemoryAdapter({
              baseURL: memoryUrl,
              token,
            });
          } catch (err) {
            console.warn('Memory MCP unavailable, continuing without memory:', err);
            memoryAdapter = undefined;
          }
        }

        this._chatAgent = createAgent({
          llmProvider,
          systemPrompt: config.systemPrompt,
          maxHistory: config.maxHistory ?? 20,
          ...(config.tools && { tools: config.tools }),
          ...(config.onToolCall && { onToolCall: config.onToolCall(env) }),
          ...(memoryAdapter && { memoryAdapter }),
          ...(sessionId && { sessionId }),
        });

        // Restore messages from state
        if (this.state.messages.length > 0) {
          this._chatAgent.setMessages(this.state.messages);
        }
      }

      return this._chatAgent;
    }

    /**
     * Generate default session ID from state
     * @internal
     */
    _generateDefaultSessionId(): string | undefined {
      const { userId, chatId } = this.state;
      if (chatId) {
        return `session:${chatId}`;
      }
      if (userId) {
        return `session:${userId}`;
      }
      return undefined;
    }

    /**
     * Initialize agent with context (userId, chatId, etc.)
     * Uses async state update to avoid blockConcurrencyWhile timeout
     */
    async init(userId?: string | number, chatId?: string | number): Promise<void> {
      if (this.state.userId === undefined && userId !== undefined) {
        const newState: CloudflareAgentState = {
          ...this.state,
          userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        if (chatId !== undefined) {
          newState.chatId = chatId;
        }
        // Use async state update to avoid blockConcurrencyWhile timeout
        this._scheduleStateUpdate(newState);
      }
    }

    /**
     * Chat with the agent
     */
    async chat(userMessage: string): Promise<string> {
      // Access state early to trigger lazy loading before LLM call
      // This prevents blockConcurrencyWhile timeout during long LLM operations
      void this.state.messages;

      const agent = this._ensureInitialized();

      const response = await agent.chat(userMessage);

      // Persist messages asynchronously to avoid blockConcurrencyWhile timeout
      this._scheduleStateUpdate({
        ...this.state,
        messages: agent.getMessages(),
        updatedAt: Date.now(),
      });

      return response;
    }

    /**
     * Clear conversation history
     */
    async clearHistory(): Promise<string> {
      if (this._chatAgent) {
        this._chatAgent.clearHistory();
      }

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
