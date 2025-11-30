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
import type { ChatOptions, LLMProvider, Message } from '../types.js';
import { type AgentContext, AgentMixin, type AgentResult } from './base-agent.js';
import { agentRegistry } from './registry.js';

// =============================================================================
// Agent Self-Registration
// =============================================================================

/**
 * Register SimpleAgent with the agent registry.
 * This is the fallback agent for general queries that don't match other agents.
 * Priority is low (10) to ensure specialized agents are checked first.
 */
agentRegistry.register({
  name: 'simple-agent',
  description:
    'Handles simple questions that can be answered directly without tools. Used for greetings, explanations, general knowledge, help requests, and any query that does not require web search, code tools, or external APIs.',
  examples: [
    'hello',
    'hi there',
    'what is machine learning',
    'explain this code',
    'help',
    'what can you do',
    'thank you',
  ],
  triggers: {
    patterns: [
      /^(hi|hello|hey|good\s+(morning|afternoon|evening))[\s!.]*$/i,
      /^(help|\/help|\?|what can you do)[\s?]*$/i,
      /^(thanks?|thank you|thx)[\s!.]*$/i,
    ],
    categories: ['general'],
  },
  capabilities: {
    tools: [], // No tools - LLM only
    complexity: 'low',
  },
  priority: 10, // Lowest priority - fallback agent
});

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
 * Note: Actual env fields depend on the provider (OpenRouterProviderEnv, etc.)
 * This interface is kept minimal - extend with provider-specific env in your app
 */
// biome-ignore lint/suspicious/noEmptyInterface: Intentionally empty - extend with provider env
export interface SimpleAgentEnv {}

/**
 * Web search configuration for SimpleAgent
 */
export interface WebSearchConfig {
  /** Enable web search */
  enabled: boolean;
  /** Maximum number of search results (default: 5, max: 10) */
  maxResults?: number;
  /** Search engine: 'native' uses model's built-in search, 'exa' uses Exa API */
  engine?: 'native' | 'exa';
}

/**
 * Configuration for simple agent
 */
export interface SimpleAgentConfig<TEnv extends SimpleAgentEnv> {
  /** Function to create LLM provider from env and optional context */
  createProvider: (env: TEnv, context?: AgentContext) => LLMProvider;
  /** System prompt for the agent */
  systemPrompt: string;
  /** Maximum messages in history */
  maxHistory?: number;
  /** Enable detailed logging */
  debug?: boolean;
  /**
   * Enable native web search via OpenRouter plugins.
   * When enabled, the model can access real-time web information.
   *
   * @example
   * ```typescript
   * webSearch: true  // Enable with defaults
   * webSearch: { enabled: true, maxResults: 3 }  // Custom config
   * ```
   */
  webSearch?: boolean | WebSearchConfig;
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
        // Get LLM provider (pass context for platformConfig credentials)
        const env = (this as unknown as { env: TEnv }).env;
        const provider = config.createProvider(env, context);

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

        // Build chat options with web search if enabled
        // Uses :online model suffix for reliable passthrough via AI Gateway
        let chatOptions: ChatOptions | undefined;
        if (config.webSearch) {
          const webConfig =
            typeof config.webSearch === 'boolean'
              ? { enabled: config.webSearch }
              : config.webSearch;

          if (webConfig.enabled) {
            chatOptions = { webSearch: true };

            if (debug) {
              logger.debug('[SimpleAgent] Web search enabled via :online suffix', {
                traceId,
              });
            }
          }
        }

        // Call LLM
        const response = await provider.chat(llmMessages, undefined, chatOptions);

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
