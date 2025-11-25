/**
 * Simple Agent
 *
 * Handles simple queries that don't need tools or orchestration.
 * Provides direct LLM responses with optional conversation history.
 *
 * This is a lightweight agent for quick responses.
 */

import { logger } from '@duyetbot/hono-middleware';
import { Agent, type Connection } from 'agents';
import type { LLMProvider, Message } from '../types.js';
import { type AgentContext, AgentMixin, type AgentResult } from './base-agent.js';

/**
 * Simple agent state
 */
export interface SimpleAgentState {
  /** Session identifier */
  sessionId: string;
  /** Conversation messages */
  messages: Message[];
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Environment bindings for simple agent
 */
export interface SimpleAgentEnv {
  AI_GATEWAY_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

/**
 * Configuration for simple agent
 */
export interface SimpleAgentConfig<TEnv extends SimpleAgentEnv> {
  /** Function to create LLM provider from env */
  createProvider: (env: TEnv) => LLMProvider;
  /** System prompt for the agent */
  systemPrompt: string;
  /** Maximum messages in history */
  maxHistory?: number;
  /** Enable detailed logging */
  debug?: boolean;
}

/**
 * Methods exposed by SimpleAgent
 */
export interface SimpleAgentMethods {
  execute(query: string, context: AgentContext): Promise<AgentResult>;
  getMessageCount(): number;
  clearHistory(): void;
  getHistory(): Message[];
}

/**
 * Type for SimpleAgent class
 */
export type SimpleAgentClass<TEnv extends SimpleAgentEnv> = typeof Agent<TEnv, SimpleAgentState> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, SimpleAgentState>>
  ): Agent<TEnv, SimpleAgentState> & SimpleAgentMethods;
};

/**
 * Create a Simple Agent class
 *
 * @example
 * ```typescript
 * export const SimpleAgent = createSimpleAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   systemPrompt: 'You are a helpful assistant.',
 * });
 * ```
 */
export function createSimpleAgent<TEnv extends SimpleAgentEnv>(
  config: SimpleAgentConfig<TEnv>
): SimpleAgentClass<TEnv> {
  const maxHistory = config.maxHistory ?? 20;
  const debug = config.debug ?? false;

  const AgentClass = class SimpleAgent extends Agent<TEnv, SimpleAgentState> {
    override initialState: SimpleAgentState = {
      sessionId: '',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    /**
     * Handle state updates
     */
    override onStateUpdate(state: SimpleAgentState, source: 'server' | Connection): void {
      if (debug) {
        logger.info('[SimpleAgent] State updated', {
          source,
          messageCount: state.messages.length,
        });
      }
    }

    /**
     * Execute a simple query
     */
    async execute(query: string, context: AgentContext): Promise<AgentResult> {
      const startTime = Date.now();
      const traceId = context.traceId ?? AgentMixin.generateId('trace');

      AgentMixin.log('SimpleAgent', 'Executing query', {
        traceId,
        queryLength: query.length,
      });

      try {
        // Get LLM provider
        const env = (this as unknown as { env: TEnv }).env;
        const provider = config.createProvider(env);

        // Add user message to history
        const userMessage: Message = { role: 'user', content: query };
        const updatedMessages = [...this.state.messages, userMessage];

        // Build messages for LLM
        const llmMessages = [
          { role: 'system' as const, content: config.systemPrompt },
          ...updatedMessages.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
        ];

        // Call LLM
        const response = await provider.chat(llmMessages);
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.content,
        };

        // Update state with trimmed history
        const newMessages = AgentMixin.trimHistory(
          [...updatedMessages, assistantMessage],
          maxHistory
        );

        this.setState({
          ...this.state,
          sessionId: this.state.sessionId || context.chatId?.toString() || traceId,
          messages: newMessages,
          updatedAt: Date.now(),
        });

        const durationMs = Date.now() - startTime;

        AgentMixin.log('SimpleAgent', 'Query complete', {
          traceId,
          durationMs,
          responseLength: response.content.length,
        });

        return AgentMixin.createResult(true, response.content, durationMs);
      } catch (error) {
        const durationMs = Date.now() - startTime;
        AgentMixin.logError('SimpleAgent', 'Query failed', error, {
          traceId,
          durationMs,
        });
        return AgentMixin.createErrorResult(error, durationMs);
      }
    }

    /**
     * Get current message count
     */
    getMessageCount(): number {
      return this.state.messages.length;
    }

    /**
     * Clear conversation history
     */
    clearHistory(): void {
      this.setState({
        ...this.state,
        messages: [],
        updatedAt: Date.now(),
      });
    }

    /**
     * Get conversation history
     */
    getHistory(): Message[] {
      return [...this.state.messages];
    }
  };

  return AgentClass as SimpleAgentClass<TEnv>;
}

/**
 * Type for simple agent instance
 */
export type SimpleAgentInstance<TEnv extends SimpleAgentEnv> = InstanceType<
  ReturnType<typeof createSimpleAgent<TEnv>>
>;
