/**
 * Cloudflare Durable Object Agent wrapper for ChatAgent
 *
 * This provides a reusable base class for Cloudflare Workers apps
 * that want to use ChatAgent with Durable Object state persistence.
 */

import { Agent, type AgentNamespace } from 'agents';
import { ChatAgent } from './agent.js';
import { createAgent } from './factory.js';
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
     * Lazily initialize ChatAgent on first use
     * @internal
     */
    _ensureInitialized(): ChatAgent {
      if (!this._chatAgent) {
        // Access env from the Agent base class
        const env = (this as unknown as { env: TEnv }).env;
        const llmProvider = config.createProvider(env);

        this._chatAgent = createAgent({
          llmProvider,
          systemPrompt: config.systemPrompt,
          maxHistory: config.maxHistory ?? 20,
          ...(config.tools && { tools: config.tools }),
          ...(config.onToolCall && { onToolCall: config.onToolCall(env) }),
        });

        // Restore messages from state
        if (this.state.messages.length > 0) {
          this._chatAgent.setMessages(this.state.messages);
        }
      }

      return this._chatAgent;
    }

    /**
     * Initialize agent with context (userId, chatId, etc.)
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
        this.setState(newState);
      }
    }

    /**
     * Chat with the agent
     */
    async chat(userMessage: string): Promise<string> {
      const agent = this._ensureInitialized();

      const response = await agent.chat(userMessage);

      // Persist messages to Durable Object state
      this.setState({
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
