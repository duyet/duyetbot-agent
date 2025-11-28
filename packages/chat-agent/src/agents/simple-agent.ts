/**
 * Simple Agent
 *
 * Handles simple queries that don't need tools or orchestration.
 * Provides direct LLM responses using conversation history from parent agent.
 *
 * This agent is STATELESS for conversation history - history is passed via
 * AgentContext.conversationHistory from the parent agent (CloudflareAgent).
 * This enables centralized state management where only the parent stores history.
 */

import { logger } from '@duyetbot/hono-middleware';
import { Agent, type Connection } from 'agents';
import type { LLMProvider, Message } from '../types.js';
import { type AgentContext, AgentMixin, type AgentResult } from './base-agent.js';

/**
 * Simple agent state
 *
 * NOTE: This agent is intentionally stateless for conversation history.
 * Conversation history is passed via AgentContext.conversationHistory from the parent agent.
 * This enables centralized state management where only the parent (CloudflareAgent) stores history.
 */
export interface SimpleAgentState {
  /** Session identifier */
  sessionId: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Number of queries executed (for analytics) */
  queriesExecuted: number;
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

  // Log system prompt at agent creation time
  logger.debug('[SimpleAgent] System prompt loaded', {
    promptLength: config.systemPrompt.length,
    promptPreview:
      config.systemPrompt.slice(0, 200) + (config.systemPrompt.length > 200 ? '...' : ''),
  });
  if (debug) {
    logger.debug(`[SimpleAgent] Full system prompt:\n${config.systemPrompt}`);
  }

  const AgentClass = class SimpleAgent extends Agent<TEnv, SimpleAgentState> {
    override initialState: SimpleAgentState = {
      sessionId: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      queriesExecuted: 0,
    };

    /**
     * Handle state updates
     */
    override onStateUpdate(state: SimpleAgentState, source: 'server' | Connection): void {
      if (debug) {
        logger.info('[SimpleAgent] State updated', {
          source,
          queriesExecuted: state.queriesExecuted,
        });
      }
    }

    /**
     * Execute a simple query
     *
     * Uses conversation history from context.conversationHistory (passed by parent agent)
     * instead of maintaining local state. This enables centralized state management.
     */
    async execute(query: string, context: AgentContext): Promise<AgentResult> {
      const startTime = Date.now();
      const traceId = context.traceId ?? AgentMixin.generateId('trace');

      // Use conversation history from context (passed by parent agent)
      const conversationHistory = context.conversationHistory ?? [];

      AgentMixin.log('SimpleAgent', 'Executing query', {
        traceId,
        queryLength: query.length,
        historyLength: conversationHistory.length,
      });

      try {
        // Get LLM provider
        const env = (this as unknown as { env: TEnv }).env;
        const provider = config.createProvider(env);

        // Build messages for LLM using history from context
        // Trim to maxHistory to prevent context overflow
        const trimmedHistory = AgentMixin.trimHistory(conversationHistory, maxHistory);
        const llmMessages = [
          { role: 'system' as const, content: config.systemPrompt },
          ...trimmedHistory.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
          { role: 'user' as const, content: query },
        ];

        // Call LLM
        const response = await provider.chat(llmMessages);

        // Update state with query count (not messages - those are managed by parent)
        this.setState({
          ...this.state,
          sessionId: this.state.sessionId || context.chatId?.toString() || traceId,
          queriesExecuted: this.state.queriesExecuted + 1,
          updatedAt: Date.now(),
        });

        const durationMs = Date.now() - startTime;

        AgentMixin.log('SimpleAgent', 'Query complete', {
          traceId,
          durationMs,
          responseLength: response.content.length,
        });

        // Return result with new messages for parent to save
        return AgentMixin.createResult(true, response.content, durationMs, {
          data: {
            // Return new messages so parent can append to its state
            newMessages: [
              { role: 'user' as const, content: query },
              { role: 'assistant' as const, content: response.content },
            ],
          },
        });
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
     * @deprecated This agent is stateless for messages. Returns 0.
     */
    getMessageCount(): number {
      return 0; // Stateless - history is in parent agent
    }

    /**
     * Clear conversation history
     * @deprecated This agent is stateless for messages. No-op.
     */
    clearHistory(): void {
      // No-op - history is managed by parent agent
      logger.info('[SimpleAgent] clearHistory called - no-op (stateless agent)');
    }

    /**
     * Get conversation history
     * @deprecated This agent is stateless for messages. Returns empty array.
     */
    getHistory(): Message[] {
      return []; // Stateless - history is in parent agent
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
