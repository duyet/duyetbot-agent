/**
 * Simple Agent
 *
 * Handles simple queries that don't need tools or orchestration.
 * Provides direct LLM responses using conversation history from ExecutionContext.
 *
 * This agent is STATELESS for conversation history - history is passed via
 * ExecutionContext.conversationHistory from the parent agent (CloudflareAgent).
 * This enables centralized state management where only the parent stores history.
 *
 * SimpleAgent extends BaseAgent to leverage:
 * - Provider management for LLM calls
 * - Message sending and editing via transport
 * - Execution context tracing and debug accumulation
 * - Typing indicators and thinking status updates
 */

import { logger } from '@duyetbot/hono-middleware';
import { Agent } from 'agents';
import { BaseAgent } from '../base/base-agent.js';
import type { AgentResult, BaseEnv, BaseState } from '../base/index.js';
import { createErrorResult, createSuccessResult } from '../base/index.js';
import type { AgentProvider } from '../execution/agent-provider.js';
import type { ExecutionContext } from '../execution/context.js';
import type { ChatOptions, Message } from '../types.js';
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
 * Extends BaseState with optional analytics. Conversation history is stateless
 * and passed via ExecutionContext.conversationHistory from the parent agent.
 */
export interface SimpleAgentState extends BaseState {
  /** Session identifier (optional) */
  sessionId?: string;
  /** Number of queries executed (for analytics) */
  queriesExecuted: number;
}

/**
 * Environment bindings for simple agent
 * Note: Actual env fields depend on the provider (OpenRouterProviderEnv, etc.)
 * This interface is kept minimal - extend with provider-specific env in your app
 */
export interface SimpleAgentEnv extends BaseEnv {}

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
  /** Function to create agent provider from env */
  createProvider: (env: TEnv) => AgentProvider;
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
 * Type for SimpleAgent class
 */
export type SimpleAgentClass<TEnv extends SimpleAgentEnv> = typeof Agent<TEnv, SimpleAgentState> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, SimpleAgentState>>
  ): Agent<TEnv, SimpleAgentState>;
};

/**
 * Create a Simple Agent class
 *
 * Extends BaseAgent to provide:
 * - Provider management for LLM calls via this.chat()
 * - Message sending via this.respond()
 * - Status updates via this.updateThinking()
 * - Typing indicators via this.sendTyping()
 * - Execution tracing via this.recordExecution()
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

  /**
   * SimpleAgent class extending BaseAgent
   *
   * Provides direct LLM responses for simple queries without tools.
   * Uses BaseAgent for provider management, message sending, and execution tracing.
   */
  const AgentClass = class SimpleAgent extends BaseAgent<TEnv, SimpleAgentState> {
    override initialState: SimpleAgentState = {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      queriesExecuted: 0,
    };

    /**
     * Execute a simple query using ExecutionContext
     *
     * Handles direct LLM calls without tools. Uses ExecutionContext for:
     * - User query and conversation history
     * - Provider/model information for LLM calls
     * - Execution tracing and debug accumulation
     * - Message sending via transport layer
     *
     * @param ctx - ExecutionContext with query, history, tracing
     * @returns AgentResult with success, content, and duration
     *
     * @example
     * ```typescript
     * const result = await agent.execute(executionContext);
     * console.log(result.content); // LLM response
     * console.log(result.durationMs); // Total execution time
     * ```
     */
    async execute(ctx: ExecutionContext): Promise<AgentResult> {
      const startTime = Date.now();

      logger.debug('[SimpleAgent] Starting execution', {
        spanId: ctx.spanId,
        queryLength: ctx.query.length,
        historyLength: ctx.conversationHistory.length,
      });

      try {
        // Send initial response message
        await this.respond(ctx, '🤔 Processing your query...');

        // Build messages for LLM using history from context
        // Trim to maxHistory to prevent context overflow
        const trimmedHistory = ctx.conversationHistory.slice(-maxHistory);
        const llmMessages: Message[] = [
          { role: 'system', content: config.systemPrompt },
          ...trimmedHistory,
          { role: 'user', content: ctx.query },
        ];

        // Update thinking status
        await this.updateThinking(ctx, 'Generating response');

        // Build chat options with web search if enabled
        let chatOptions: ChatOptions | undefined;
        if (config.webSearch) {
          const webConfig =
            typeof config.webSearch === 'boolean'
              ? { enabled: config.webSearch }
              : config.webSearch;

          if (webConfig.enabled) {
            chatOptions = { webSearch: true };

            if (debug) {
              logger.debug('[SimpleAgent] Web search enabled', {
                spanId: ctx.spanId,
              });
            }
          }
        }

        // Send typing indicator
        await this.sendTyping(ctx);

        // Call LLM via BaseAgent.chat()
        const response = await this.chat(ctx, llmMessages, chatOptions);

        // Update state with query count
        this.setState({
          ...this.state,
          sessionId: ctx.chatId?.toString(),
          queriesExecuted: this.state.queriesExecuted + 1,
          updatedAt: Date.now(),
        });

        const durationMs = Date.now() - startTime;

        // Record execution in debug chain
        this.recordExecution(ctx, 'simple-agent', durationMs);

        logger.debug('[SimpleAgent] Query completed', {
          spanId: ctx.spanId,
          durationMs,
          contentLength: response.content.length,
        });

        // Send final response
        await this.respond(ctx, response.content);

        return createSuccessResult(response.content, durationMs, {
          ...(response.usage?.totalTokens !== undefined && {
            tokensUsed: response.usage.totalTokens,
          }),
        });
      } catch (error) {
        const durationMs = Date.now() - startTime;

        logger.error('[SimpleAgent] Query failed', {
          spanId: ctx.spanId,
          durationMs,
          error: error instanceof Error ? error.message : String(error),
        });

        // Record execution even on failure
        this.recordExecution(ctx, 'simple-agent', durationMs);

        // Try to send error message via transport
        try {
          await this.respond(
            ctx,
            `Error: ${error instanceof Error ? error.message : String(error)}`
          );
        } catch (respondError) {
          logger.warn('[SimpleAgent] Failed to send error message', {
            spanId: ctx.spanId,
            error: respondError instanceof Error ? respondError.message : String(respondError),
          });
        }

        return createErrorResult(
          error instanceof Error ? error : new Error(String(error)),
          durationMs
        );
      }
    }
  };

  return AgentClass;
}

/**
 * Type for simple agent instance
 */
export type SimpleAgentInstance<TEnv extends SimpleAgentEnv> = InstanceType<
  ReturnType<typeof createSimpleAgent<TEnv>>
>;
