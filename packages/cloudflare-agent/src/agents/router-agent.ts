/**
 * Router Agent
 *
 * Classifies incoming queries and routes them to appropriate handlers.
 * Uses LLM-based classification with quick pattern matching for common cases.
 *
 * This is the entry point for all queries in the new routing architecture.
 * Extends BaseAgent and uses ExecutionContext for tracing and debug management.
 */

import { logger } from '@duyetbot/hono-middleware';
import { Agent, type AgentNamespace, type Connection, getAgentByName } from 'agents';
import {
  type AgentResult,
  BaseAgent,
  type BaseEnv,
  type BaseState,
  createBaseState,
  createErrorResult,
  createSuccessResult,
} from '../base/index.js';
import { enterAgent, exitAgent, type GlobalContext, setTiming } from '../context/index.js';
import type { AgentProvider, ExecutionContext } from '../execution/index.js';
import { createDebugAccumulator } from '../execution/index.js';
import { type ResponseTarget, sendPlatformResponse } from '../platform-response.js';
import {
  type ClassificationContext,
  type ClassifierConfig,
  determineRouteTarget,
  hybridClassify,
  type QueryClassification,
  type RouteTarget,
} from '../routing/index.js';
import type { DebugContext } from '../types.js';
import type { AgentContext } from './base-agent.js';

// Re-export ResponseTarget for consumers
export type { ResponseTarget } from '../platform-response.js';

/**
 * Pending execution for fire-and-forget pattern
 *
 * Stores ExecutionContext for deferred processing via alarm handler.
 * Allows immediate response to caller while routing continues separately.
 */
export interface PendingExecution {
  /** Unique execution identifier */
  executionId: string;
  /** Query to process */
  query: string;
  /** Execution context for routing (includes tracing, user info, etc.) */
  context: ExecutionContext;
  /** Target for response delivery */
  responseTarget: ResponseTarget;
  /** When execution was scheduled */
  scheduledAt: number;
}

/**
 * Router agent state
 *
 * Extends BaseState for common timestamp tracking.
 */
export interface RouterAgentState extends BaseState {
  /** Session identifier */
  sessionId: string;
  /** Last classification result */
  lastClassification: QueryClassification | undefined;
  /** Routing history for analytics */
  routingHistory: Array<{
    query: string;
    classification: QueryClassification;
    routedTo: RouteTarget;
    timestamp: number;
    durationMs: number;
  }>;
  /** Pending executions for fire-and-forget pattern */
  pendingExecutions?: PendingExecution[] | undefined;
}

/**
 * Environment bindings for router agent
 *
 * Note: Provider-specific fields (AI, AI_GATEWAY_NAME, AI_GATEWAY_API_KEY, OPENROUTER_API_KEY)
 * should be provided by the concrete environment type (e.g., from OpenRouterProviderEnv).
 * This interface only includes shared agent bindings.
 */
export interface RouterAgentEnv extends BaseEnv {
  /**
   * Agent bindings - these are optional since not all may be deployed.
   *
   * IMPORTANT: Router only dispatches to AGENTS, never directly to workers.
   * Workers (CodeWorker, ResearchWorker, GitHubWorker) are dispatched by
   * OrchestratorAgent as part of its ExecutionPlan.
   */
  SimpleAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
  OrchestratorAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
  HITLAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
  LeadResearcherAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
  DuyetInfoAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;

  /** State DO for centralized observability and watchdog recovery */
  StateDO?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
}

/**
 * Configuration for router agent
 */
export interface RouterAgentConfig<TEnv extends RouterAgentEnv> {
  /** Function to create agent provider from env */
  createProvider: (env: TEnv) => AgentProvider;
  /** Maximum routing history to keep */
  maxHistory?: number;
  /** Custom classification prompt override */
  customClassificationPrompt?: string;
  /** Enable detailed logging */
  debug?: boolean;
}

/**
 * Methods exposed by RouterAgent
 */
export interface RouterAgentMethods {
  /** Route a query using the execution context for full tracing support */
  route(ctx: ExecutionContext): Promise<AgentResult>;
  /** Get routing statistics */
  getStats(): {
    totalRouted: number;
    byTarget: Record<string, number>;
    avgDurationMs: number;
  };
  /** Get routing history with optional limit */
  getRoutingHistory(limit?: number): RouterAgentState['routingHistory'];
  /** Get the last classification result */
  getLastClassification(): QueryClassification | undefined;
  /** Clear routing history and classification state */
  clearHistory(): void;
}

/**
 * Type for RouterAgent class
 */
export type RouterAgentClass<TEnv extends RouterAgentEnv> = typeof Agent<TEnv, RouterAgentState> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, RouterAgentState>>
  ): Agent<TEnv, RouterAgentState> & RouterAgentMethods;
};

/**
 * Create a Router Agent class
 *
 * @example
 * ```typescript
 * export const RouterAgent = createRouterAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 * });
 * ```
 */
export function createRouterAgent<TEnv extends RouterAgentEnv>(
  config: RouterAgentConfig<TEnv>
): RouterAgentClass<TEnv> {
  const maxHistory = config.maxHistory ?? 50;
  const debug = config.debug ?? false;

  const AgentClass = class RouterAgent extends BaseAgent<TEnv, RouterAgentState> {
    override initialState: RouterAgentState = {
      ...createBaseState(),
      sessionId: '',
      lastClassification: undefined,
      routingHistory: [],
    };

    /**
     * Handle state updates
     */
    override onStateUpdate(_state: RouterAgentState, _source: 'server' | Connection): void {
      if (debug) {
        logger.info('[RouterAgent] State updated', {});
      }
    }

    /**
     * Route a query using GlobalContext
     *
     * NEW: Uses unified GlobalContext for tracing and debug accumulation.
     * This method coordinates classification and routing with full context tracking.
     *
     * @param gCtx - GlobalContext with query, platform, and accumulated data
     * @returns AgentResult with content and routing metrics
     */
    async routeGlobal(gCtx: GlobalContext): Promise<AgentResult> {
      const spanId = enterAgent(gCtx, 'router');
      const startTime = Date.now();

      logger.debug('[RouterAgent] Starting route (global)', {
        spanId,
        traceId: gCtx.traceId,
        queryLength: gCtx.query.length,
        platform: gCtx.platform,
      });

      try {
        // Step 1: Record classification start
        const classificationStart = Date.now();

        // Step 2: Classify the query (hybrid: patterns + LLM)
        // TODO: Update classification to work with GlobalContext
        const classification = await this.classifyGlobal(gCtx);

        // Step 3: Record classification metrics
        const classificationMs = Date.now() - classificationStart;
        const classificationTimestamp = Date.now();
        setTiming(gCtx, 'classificationMs', classificationMs);
        gCtx.classification = {
          type: classification.type,
          category: classification.category,
          complexity: classification.complexity,
          ...(classification.confidence !== undefined && { confidence: classification.confidence }),
          timestamp: classificationTimestamp,
        };

        // Step 4: Determine target agent
        const target = determineRouteTarget(classification);

        // Structured debug logging for routing decision
        if (debug) {
          logger.info('[ROUTER_DEBUG] Routing decision (global)', {
            spanId,
            traceId: gCtx.traceId,
            query: gCtx.query.slice(0, 100),
            classification: {
              type: classification.type,
              category: classification.category,
              complexity: classification.complexity,
            },
            target,
            classificationMs,
          });
        }

        // Update state with routing history
        // Guard against undefined routingHistory from persisted state migration
        const currentHistory = this.state.routingHistory ?? [];
        this.setState({
          ...this.state,
          sessionId: this.state.sessionId || gCtx.chatId.toString() || gCtx.traceId,
          lastClassification: classification,
          routingHistory: [
            ...currentHistory.slice(-(maxHistory - 1)),
            {
              query: gCtx.query.slice(0, 200),
              classification: {
                ...classification,
                reasoning: classification.reasoning?.slice(0, 100),
              },
              routedTo: target,
              timestamp: Date.now(),
              durationMs: classificationMs,
            },
          ],
          updatedAt: Date.now(),
        });

        logger.debug('[RouterAgent] Classification complete', {
          spanId,
          type: classification.type,
          category: classification.category,
          complexity: classification.complexity,
          target,
          classificationMs,
        });

        // Step 5: Dispatch to target agent
        // TODO: Dispatch to agents with GlobalContext
        const result = await this.dispatchGlobal(gCtx, target);

        const durationMs = Date.now() - startTime;

        // Log successful routing outcome
        if (debug) {
          logger.info('[ROUTER_DEBUG] Routing outcome (global)', {
            spanId,
            traceId: gCtx.traceId,
            target,
            success: result.success,
            totalDurationMs: durationMs,
          });
        }

        exitAgent(gCtx, result.success ? 'delegated' : 'error');
        return result;
      } catch (error) {
        const durationMs = Date.now() - startTime;

        // Enhanced error logging
        if (debug) {
          logger.error('[ROUTER_DEBUG] Routing error (global)', {
            spanId,
            traceId: gCtx.traceId,
            query: gCtx.query.slice(0, 100),
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            durationMs,
          });
        }

        logger.error('[RouterAgent] Routing failed', {
          spanId,
          durationMs,
          error: error instanceof Error ? error.message : String(error),
        });

        exitAgent(gCtx, 'error');
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs,
        };
      }
    }

    /**
     * Route a query to the appropriate handler
     *
     * Coordinates the classification and routing of incoming queries:
     * 1. Record start time
     * 2. Call classify() for hybrid classification
     * 3. Record classification metrics in debug context
     * 4. Update thinking status
     * 5. Determine target agent
     * 6. Create child context for sub-agent
     * 7. Dispatch to target agent
     * 8. Record execution metrics
     * 9. Return result
     *
     * @param ctx - ExecutionContext with query, platform, and tracing info
     * @returns AgentResult with content and routing metrics
     * @deprecated Use routeGlobal(gCtx) instead for unified context handling
     */
    async route(ctx: ExecutionContext): Promise<AgentResult> {
      const startTime = Date.now();

      logger.debug('[RouterAgent] Starting route', {
        spanId: ctx.spanId,
        traceId: ctx.traceId,
        queryLength: ctx.query.length,
        platform: ctx.platform,
      });

      try {
        // Step 1: Record classification start
        const classificationStart = Date.now();

        // Step 2: Classify the query (hybrid: patterns + LLM)
        const classification = await this.classify(ctx);

        // Step 3: Record classification metrics
        const classificationMs = Date.now() - classificationStart;
        ctx.debug.classificationMs = classificationMs;
        ctx.debug.classification = {
          type: classification.type,
          category: classification.category,
          complexity: classification.complexity,
          confidence: classification.confidence,
        };

        // Step 4: Update thinking status
        await this.updateThinking(ctx, `Routing to ${classification.category}`);

        // Step 5: Determine target agent
        const target = determineRouteTarget(classification);

        // Structured debug logging for routing decision
        if (debug) {
          logger.info('[ROUTER_DEBUG] Routing decision', {
            spanId: ctx.spanId,
            traceId: ctx.traceId,
            query: ctx.query.slice(0, 100),
            classification: {
              type: classification.type,
              category: classification.category,
              complexity: classification.complexity,
            },
            target,
            classificationMs,
          });
        }

        // Update state with routing history (truncate fields to limit storage)
        // Guard against undefined routingHistory from persisted state migration
        const currentHistory = this.state.routingHistory ?? [];
        this.setState({
          ...this.state,
          sessionId: this.state.sessionId || ctx.chatId.toString() || ctx.traceId,
          lastClassification: classification,
          routingHistory: [
            ...currentHistory.slice(-(maxHistory - 1)),
            {
              query: ctx.query.slice(0, 200),
              classification: {
                ...classification,
                reasoning: classification.reasoning?.slice(0, 100),
              },
              routedTo: target,
              timestamp: Date.now(),
              durationMs: classificationMs,
            },
          ],
          updatedAt: Date.now(),
        });

        logger.debug('[RouterAgent] Classification complete', {
          spanId: ctx.spanId,
          type: classification.type,
          category: classification.category,
          complexity: classification.complexity,
          target,
          classificationMs,
        });

        // Step 6: Create child context for target agent
        const childCtx = this.createChildContext(ctx);

        // Step 7: Dispatch to target agent
        const result = await this.dispatch(childCtx, target);

        // Step 8: Record execution in debug chain
        this.recordExecution(ctx, 'router-agent', Date.now() - startTime);

        // Log successful routing outcome
        if (debug) {
          logger.info('[ROUTER_DEBUG] Routing outcome', {
            spanId: ctx.spanId,
            traceId: ctx.traceId,
            target,
            success: result.success,
            totalDurationMs: Date.now() - startTime,
          });
        }

        return result;
      } catch (error) {
        const durationMs = Date.now() - startTime;

        // Enhanced error logging
        if (debug) {
          logger.error('[ROUTER_DEBUG] Routing error', {
            spanId: ctx.spanId,
            traceId: ctx.traceId,
            query: ctx.query.slice(0, 100),
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            durationMs,
          });
        }

        logger.error('[RouterAgent] Routing failed', {
          spanId: ctx.spanId,
          durationMs,
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs,
        };
      }
    }

    /**
     * Classify a query using GlobalContext
     *
     * NEW: Works with GlobalContext for unified context handling.
     *
     * @param gCtx - GlobalContext with query and platform info
     * @returns QueryClassification with type, category, complexity, etc.
     * @private
     */
    private async classifyGlobal(gCtx: GlobalContext): Promise<QueryClassification> {
      // Build classification context from global context and routing history
      // Guard against undefined routingHistory from persisted state migration
      const routingHistory = this.state.routingHistory ?? [];
      const classificationContext: ClassificationContext = {
        platform: gCtx.platform as 'telegram' | 'github' | 'api' | undefined,
        recentMessages: routingHistory.slice(-3).map((h) => ({
          role: 'user',
          content: h.query,
        })),
      };

      // Get provider from env
      const env = (this as unknown as { env: TEnv }).env;
      const provider = config.createProvider(env);

      // Build classifier config (AgentProvider is compatible with LLMProvider)
      const classifierConfig: ClassifierConfig = {
        provider: provider as unknown as any,
      };
      if (config.customClassificationPrompt) {
        classifierConfig.customPrompt = config.customClassificationPrompt;
      }

      // Use hybrid classification (patterns + LLM fallback)
      return hybridClassify(gCtx.query, classifierConfig, classificationContext);
    }

    /**
     * Classify a query using hybrid approach (patterns + LLM)
     *
     * Uses the classifier to:
     * 1. Try quick pattern-based classification first
     * 2. Fall back to LLM-based classification if needed
     *
     * @param ctx - ExecutionContext with query and platform info
     * @returns QueryClassification with type, category, complexity, etc.
     * @private
     * @deprecated Use classifyGlobal instead
     */
    private async classify(ctx: ExecutionContext): Promise<QueryClassification> {
      // Build classification context from execution context and routing history
      // Guard against undefined routingHistory from persisted state migration
      const routingHistory = this.state.routingHistory ?? [];
      const classificationContext: ClassificationContext = {
        platform: ctx.platform as 'telegram' | 'github' | 'api' | undefined,
        recentMessages: routingHistory.slice(-3).map((h) => ({
          role: 'user',
          content: h.query,
        })),
      };

      // Get provider from env
      const env = (this as unknown as { env: TEnv }).env;
      const provider = config.createProvider(env);

      // Build classifier config (AgentProvider is compatible with LLMProvider)
      const classifierConfig: ClassifierConfig = {
        provider: provider as unknown as any,
      };
      if (config.customClassificationPrompt) {
        classifierConfig.customPrompt = config.customClassificationPrompt;
      }

      // Use hybrid classification (patterns + LLM fallback)
      return hybridClassify(ctx.query, classifierConfig, classificationContext);
    }

    /**
     * Dispatch to target agent
     *
     * Routes the execution context to the appropriate agent based on classification.
     *
     * IMPORTANT: Router only dispatches to AGENTS, never directly to workers.
     * Workers (CodeWorker, ResearchWorker, GitHubWorker) are dispatched by
     * OrchestratorAgent as part of its ExecutionPlan.
     *
     * Valid targets:
     * - simple-agent: Direct LLM response
     * - orchestrator-agent: Complex tasks (internally dispatches to workers)
     * - lead-researcher-agent: Multi-agent research orchestration
     * - hitl-agent: Human-in-the-loop
     * - duyet-info-agent: Personal info queries
     *
     * @param ctx - ExecutionContext with query, user info, and tracing
     * @param target - Target agent route from classification
     * @returns AgentResult from the target agent
     *
     * @see https://developers.cloudflare.com/agents/patterns/
     * @private
     */
    private async dispatch(ctx: ExecutionContext, target: RouteTarget): Promise<AgentResult> {
      const startTime = Date.now();
      const env = (this as unknown as { env: TEnv }).env;

      try {
        switch (target) {
          case 'simple-agent': {
            if (!env.SimpleAgent) {
              // Fallback: handle simple queries directly
              return this.handleSimpleQuery(ctx);
            }
            const agent = await getAgentByName(env.SimpleAgent, ctx.chatId.toString());
            this.setProviderIfSupported(agent);
            return (
              agent as unknown as {
                route: (c: ExecutionContext) => Promise<AgentResult>;
              }
            ).route(ctx);
          }

          case 'orchestrator-agent': {
            if (!env.OrchestratorAgent) {
              return {
                success: false,
                error: 'OrchestratorAgent not available',
                durationMs: Date.now() - startTime,
              };
            }
            const agent = await getAgentByName(env.OrchestratorAgent, ctx.chatId.toString());
            this.setProviderIfSupported(agent);
            return (
              agent as unknown as {
                route: (c: ExecutionContext) => Promise<AgentResult>;
              }
            ).route(ctx);
          }

          case 'hitl-agent': {
            if (!env.HITLAgent) {
              return {
                success: false,
                error: 'HITLAgent not available',
                durationMs: Date.now() - startTime,
              };
            }
            const agent = await getAgentByName(env.HITLAgent, ctx.chatId.toString());
            this.setProviderIfSupported(agent);
            return (
              agent as unknown as {
                route: (c: ExecutionContext) => Promise<AgentResult>;
              }
            ).route(ctx);
          }

          case 'lead-researcher-agent': {
            if (!env.LeadResearcherAgent) {
              // Fallback to orchestrator for multi-agent research
              return this.dispatch(ctx, 'orchestrator-agent');
            }
            const agent = await getAgentByName(env.LeadResearcherAgent, ctx.chatId.toString());
            this.setProviderIfSupported(agent);
            return (
              agent as unknown as {
                route: (c: ExecutionContext) => Promise<AgentResult>;
              }
            ).route(ctx);
          }

          case 'duyet-info-agent': {
            if (!env.DuyetInfoAgent) {
              return this.handleSimpleQuery(ctx);
            }
            const agent = await getAgentByName(env.DuyetInfoAgent, ctx.chatId.toString());
            this.setProviderIfSupported(agent);
            return (
              agent as unknown as {
                route: (c: ExecutionContext) => Promise<AgentResult>;
              }
            ).route(ctx);
          }

          default: {
            // Fallback for unknown targets
            logger.warn('[RouterAgent] Unknown target, using fallback', {
              spanId: ctx.spanId,
              target,
            });
            return this.handleSimpleQuery(ctx);
          }
        }
      } catch (error) {
        logger.error('[RouterAgent] Dispatch failed', {
          spanId: ctx.spanId,
          target,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        };
      }
    }

    /**
     * Dispatch to target agent using GlobalContext
     *
     * NEW: Routes with GlobalContext for unified context handling.
     *
     * Dispatches to the appropriate agent based on classification.
     * Router only dispatches to AGENTS, never directly to workers.
     * Workers are dispatched by OrchestratorAgent.
     *
     * @param gCtx - GlobalContext with query, user info, and tracing
     * @param target - Target agent route from classification
     * @returns AgentResult from the target agent
     * @private
     */
    private async dispatchGlobal(gCtx: GlobalContext, target: RouteTarget): Promise<AgentResult> {
      const startTime = Date.now();
      const env = (this as unknown as { env: TEnv }).env;

      try {
        switch (target) {
          case 'simple-agent': {
            if (!env.SimpleAgent) {
              // Fallback: handle simple queries directly with GlobalContext
              // TODO: Implement handleSimpleQueryGlobal
              return {
                success: false,
                error: 'SimpleAgent not available and fallback not yet implemented',
                durationMs: Date.now() - startTime,
              };
            }
            const agent = await getAgentByName(env.SimpleAgent, gCtx.chatId.toString());
            this.setProviderIfSupported(agent);
            // TODO: Call executeGlobal on agent if available (when all agents support GlobalContext)
            // For now: defer to ExecutionContext-based execution
            return {
              success: false,
              error:
                'SimpleAgent GlobalContext support in progress - use routeGlobal when complete',
              durationMs: Date.now() - startTime,
            };
          }

          case 'orchestrator-agent': {
            if (!env.OrchestratorAgent) {
              return {
                success: false,
                error: 'OrchestratorAgent not available',
                durationMs: Date.now() - startTime,
              };
            }
            const agent = await getAgentByName(env.OrchestratorAgent, gCtx.chatId.toString());
            this.setProviderIfSupported(agent);
            // TODO: Call routeGlobal on agent if available
            return {
              success: false,
              error: 'OrchestratorAgent GlobalContext support not yet implemented',
              durationMs: Date.now() - startTime,
            };
          }

          case 'hitl-agent': {
            if (!env.HITLAgent) {
              return {
                success: false,
                error: 'HITLAgent not available',
                durationMs: Date.now() - startTime,
              };
            }
            const agent = await getAgentByName(env.HITLAgent, gCtx.chatId.toString());
            this.setProviderIfSupported(agent);
            return {
              success: false,
              error: 'HITLAgent GlobalContext support not yet implemented',
              durationMs: Date.now() - startTime,
            };
          }

          case 'lead-researcher-agent': {
            if (!env.LeadResearcherAgent) {
              // Fallback to orchestrator for multi-agent research
              return this.dispatchGlobal(gCtx, 'orchestrator-agent');
            }
            const agent = await getAgentByName(env.LeadResearcherAgent, gCtx.chatId.toString());
            this.setProviderIfSupported(agent);
            return {
              success: false,
              error: 'LeadResearcherAgent GlobalContext support not yet implemented',
              durationMs: Date.now() - startTime,
            };
          }

          case 'duyet-info-agent': {
            if (!env.DuyetInfoAgent) {
              // TODO: Implement handleSimpleQueryGlobal
              return {
                success: false,
                error: 'DuyetInfoAgent not available and fallback not yet implemented',
                durationMs: Date.now() - startTime,
              };
            }
            const agent = await getAgentByName(env.DuyetInfoAgent, gCtx.chatId.toString());
            this.setProviderIfSupported(agent);
            return {
              success: false,
              error: 'DuyetInfoAgent GlobalContext support not yet implemented',
              durationMs: Date.now() - startTime,
            };
          }

          default: {
            // Fallback for unknown targets
            logger.warn('[RouterAgent] Unknown target, using fallback', {
              spanId: gCtx.currentSpanId,
              target,
            });
            return {
              success: false,
              error: `Unknown routing target: ${target}`,
              durationMs: Date.now() - startTime,
            };
          }
        }
      } catch (error) {
        logger.error('[RouterAgent] Dispatch (global) failed', {
          spanId: gCtx.currentSpanId,
          target,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        };
      }
    }

    /**
     * Set provider on agent if it extends BaseAgent
     *
     * Attempts to set the provider on the target agent if it has the setProvider method.
     * This enables the agent to use the LLM provider for chat operations.
     *
     * @param agent - Agent instance to configure
     * @private
     */
    private setProviderIfSupported(agent: unknown): void {
      if (
        agent &&
        typeof agent === 'object' &&
        'setProvider' in agent &&
        typeof agent.setProvider === 'function'
      ) {
        const env = (this as unknown as { env: TEnv }).env;
        const provider = config.createProvider(env);
        (agent as unknown as { setProvider: (p: unknown) => void }).setProvider(provider);
      }
    }

    /**
     * Handle simple queries directly (fallback when target agent not available)
     *
     * Provides inline LLM response without delegating to another agent.
     * Used as fallback for simple-agent and duyet-info-agent when not available.
     *
     * @param ctx - ExecutionContext with query and user info
     * @returns AgentResult with LLM response
     * @private
     */
    private async handleSimpleQuery(ctx: ExecutionContext): Promise<AgentResult> {
      const startTime = Date.now();

      try {
        const systemPrompt =
          'You are a helpful assistant. Respond concisely and accurately to user queries.';

        const response = await this.chat(ctx, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: ctx.query },
        ]);

        return createSuccessResult(response.content, Date.now() - startTime, {
          ...(response.usage?.totalTokens !== undefined && {
            tokensUsed: response.usage.totalTokens,
          }),
        });
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
          Date.now() - startTime
        );
      }
    }

    /**
     * Get routing statistics
     */
    getStats(): {
      totalRouted: number;
      byTarget: Record<string, number>;
      avgDurationMs: number;
    } {
      // Guard against undefined routingHistory from persisted state migration
      const history = this.state.routingHistory ?? [];
      const byTarget: Record<string, number> = {};

      for (const entry of history) {
        byTarget[entry.routedTo] = (byTarget[entry.routedTo] || 0) + 1;
      }

      const avgDurationMs =
        history.length > 0 ? history.reduce((sum, h) => sum + h.durationMs, 0) / history.length : 0;

      return {
        totalRouted: history.length,
        byTarget,
        avgDurationMs,
      };
    }

    /**
     * Get routing history with optional limit
     */
    getRoutingHistory(limit?: number): RouterAgentState['routingHistory'] {
      // Guard against undefined routingHistory from persisted state migration
      const history = this.state.routingHistory ?? [];
      if (limit && limit > 0) {
        return history.slice(-limit);
      }
      return history;
    }

    /**
     * Get last classification result
     */
    getLastClassification(): QueryClassification | undefined {
      return this.state.lastClassification;
    }

    /**
     * Clear routing history
     */
    clearHistory(): void {
      this.setState({
        ...this.state,
        routingHistory: [],
        lastClassification: undefined,
        updatedAt: Date.now(),
      });
    }

    /**
     * Schedule execution without blocking caller (fire-and-forget pattern)
     *
     * The caller returns immediately after scheduling. RouterAgent processes
     * the request in its own alarm handler and sends the response directly
     * to the platform.
     *
     * Accepts AgentContext from CloudflareAgent and converts to ExecutionContext
     * for internal routing.
     *
     * @param ctx - AgentContext with query, user info, and optional tracing
     * @param responseTarget - Where to send the response
     * @returns Promise with scheduled status and execution ID
     */
    async scheduleExecution(
      ctx: AgentContext,
      responseTarget: ResponseTarget
    ): Promise<{ scheduled: boolean; executionId: string }> {
      const traceId = ctx.traceId || crypto.randomUUID();
      const executionId = `exec_${traceId.slice(0, 8)}`;

      // Convert AgentContext to ExecutionContext for internal routing
      const executionContext: ExecutionContext = {
        traceId,
        spanId: `span_${crypto.randomUUID().slice(0, 8)}`,
        query: ctx.query,
        platform: (ctx.platform || 'api') as 'telegram' | 'github' | 'api',
        userId: ctx.userId || 'unknown',
        chatId: ctx.chatId || 'unknown',
        ...(ctx.username && { username: ctx.username }),
        userMessageId: responseTarget.chatId || 'unknown',
        provider: 'claude',
        model: 'claude-opus-4.5',
        conversationHistory: ctx.conversationHistory || [],
        debug: createDebugAccumulator(),
        startedAt: Date.now(),
        deadline: Date.now() + 30000, // 30s budget for RouterAgent
      };

      // Store execution context in state
      const pendingExecutions = this.state.pendingExecutions || [];
      this.setState({
        ...this.state,
        pendingExecutions: [
          ...pendingExecutions,
          {
            executionId,
            query: ctx.query,
            context: executionContext,
            responseTarget,
            scheduledAt: Date.now(),
          },
        ],
        updatedAt: Date.now(),
      });

      // Schedule alarm to process (fires in 1s - reliable with second-precision timestamps)
      await this.schedule(1, 'onExecutionAlarm', { executionId });

      logger.info('[RouterAgent] Scheduled fire-and-forget execution', {
        executionId,
        traceId: ctx.traceId,
        queryLength: ctx.query.length,
        chatId: responseTarget.chatId,
        platform: responseTarget.platform,
      });

      return { scheduled: true, executionId };
    }

    /**
     * Alarm handler for fire-and-forget executions
     *
     * Runs in RouterAgent's own 30s budget, separate from the caller.
     * Processes the routing/LLM call and sends response directly to platform.
     * Builds debugContext for admin users with routing flow, timing, and classification.
     *
     * @param data - Alarm data containing executionId
     */
    async onExecutionAlarm(data: { executionId: string }): Promise<void> {
      const execution = this.state.pendingExecutions?.find(
        (e) => e.executionId === data.executionId
      );

      if (!execution) {
        logger.warn('[RouterAgent] Execution not found', {
          executionId: data.executionId,
        });
        return;
      }

      const startTime = Date.now();

      try {
        logger.info('[RouterAgent] Processing fire-and-forget execution', {
          executionId: data.executionId,
          traceId: execution.context.traceId,
          queryLength: execution.query.length,
        });

        // Do the actual routing + LLM work (full 30s budget available)
        const result = await this.route(execution.context);

        // Get the latest classification and routing info from state (populated by route())
        const classification = this.state.lastClassification;
        const target = classification ? determineRouteTarget(classification) : 'router';

        // Get router classification duration from routing history (last entry)
        // Guard against undefined routingHistory for persisted state migration
        const routingHistory = this.state.routingHistory ?? [];
        const lastRouting = routingHistory[routingHistory.length - 1];
        const routerDurationMs = lastRouting?.durationMs;

        // Build debug context for admin users
        const totalDurationMs = Date.now() - startTime;

        // Build target agent step - only include tools if defined to satisfy exactOptionalPropertyTypes
        const targetAgentStep: DebugContext['routingFlow'][0] = {
          agent: target,
          durationMs: result.durationMs,
        };
        if (result.debug?.tools && result.debug.tools.length > 0) {
          targetAgentStep.tools = result.debug.tools;
        }

        // Build debug context with new format:
        // router-agent (routerDuration) → [classification] → target-agent (agentDuration)
        const debugContext: DebugContext = {
          routingFlow: [
            { agent: 'router-agent' },
            targetAgentStep,
            // Include sub-agents if orchestrator delegated
            ...(result.debug?.subAgents || []).map((subAgent) => ({
              agent: subAgent,
            })),
          ],
          totalDurationMs,
        };

        // Add router classification duration (separate from agent execution)
        if (routerDurationMs) {
          debugContext.routerDurationMs = routerDurationMs;
        }

        // Add classification only when present to satisfy exactOptionalPropertyTypes
        if (classification) {
          debugContext.classification = {
            type: classification.type,
            category: classification.category,
            complexity: classification.complexity,
          };
        }

        // Add workers from orchestrator debug info (if any)
        if (result.debug?.workers && result.debug.workers.length > 0) {
          debugContext.workers = result.debug.workers.map((w) => ({
            name: w.name,
            durationMs: w.durationMs,
            status:
              w.status === 'success'
                ? ('completed' as const)
                : w.status === 'failed'
                  ? ('error' as const)
                  : ('error' as const),
            error: w.error,
          }));
        }

        // Add metadata from agent debug info (fallback, cache, timeout)
        if (result.debug?.metadata) {
          debugContext.metadata = result.debug.metadata;
        }

        // Send response directly to platform
        // Cast env to PlatformEnv - platform tokens come from responseTarget or env
        const envWithTokens = (this as unknown as { env: TEnv }).env as unknown as {
          TELEGRAM_BOT_TOKEN?: string;
          GITHUB_TOKEN?: string;
        };
        // Build response text - ensure string even if content is undefined
        const responseText =
          result.success && result.content
            ? result.content
            : `[error] ${result.error || 'Unknown error'}`;

        // Validate responseTarget before sending
        if (!execution.responseTarget?.messageRef?.messageId) {
          throw new Error('Missing messageRef.messageId in responseTarget');
        }

        await sendPlatformResponse(
          envWithTokens,
          execution.responseTarget,
          responseText,
          debugContext
        );

        logger.info('[RouterAgent] Fire-and-forget execution completed', {
          executionId: data.executionId,
          traceId: execution.context.traceId,
          success: result.success,
          durationMs: totalDurationMs,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('[RouterAgent] Execution alarm failed', {
          executionId: data.executionId,
          error: errorMessage,
          durationMs: Date.now() - startTime,
        });

        // Try to send error message to user (only if responseTarget has valid messageRef)
        if (execution.responseTarget?.messageRef?.messageId) {
          try {
            const envForError = (this as unknown as { env: TEnv }).env as unknown as {
              TELEGRAM_BOT_TOKEN?: string;
              GITHUB_TOKEN?: string;
            };
            await sendPlatformResponse(
              envForError,
              execution.responseTarget,
              '[error] Sorry, an error occurred processing your request.'
            );
          } catch (sendError) {
            logger.error('[RouterAgent] Failed to send error message', {
              executionId: data.executionId,
              error: sendError instanceof Error ? sendError.message : String(sendError),
            });
          }
        } else {
          logger.warn('[RouterAgent] Cannot send error message, no valid messageRef', {
            executionId: data.executionId,
            hasResponseTarget: !!execution.responseTarget,
            hasMessageRef: !!execution.responseTarget?.messageRef,
          });
        }
      } finally {
        // Clean up - remove from pending
        // Filter out the completed execution, keeping undefined if no executions remain
        const remainingExecutions = this.state.pendingExecutions?.filter(
          (e) => e.executionId !== data.executionId
        );
        this.setState({
          ...this.state,
          pendingExecutions:
            remainingExecutions && remainingExecutions.length > 0 ? remainingExecutions : undefined,
          updatedAt: Date.now(),
        });
      }
    }
  };

  return AgentClass as RouterAgentClass<TEnv>;
}

/**
 * Type for router agent instance
 */
export type RouterAgentInstance<TEnv extends RouterAgentEnv> = InstanceType<
  ReturnType<typeof createRouterAgent<TEnv>>
>;
