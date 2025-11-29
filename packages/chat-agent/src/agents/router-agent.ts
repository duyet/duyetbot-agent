/**
 * Router Agent
 *
 * Classifies incoming queries and routes them to appropriate handlers.
 * Uses LLM-based classification with quick pattern matching for common cases.
 *
 * This is the entry point for all queries in the new routing architecture.
 */

import { logger } from "@duyetbot/hono-middleware";
import {
  Agent,
  type AgentNamespace,
  type Connection,
  getAgentByName,
} from "agents";
import {
  type ResponseTarget,
  sendPlatformResponse,
} from "../platform-response.js";
import {
  type ClassificationContext,
  type ClassifierConfig,
  type QueryClassification,
  type RouteTarget,
  determineRouteTarget,
  hybridClassify,
} from "../routing/index.js";
import type { DebugContext, LLMProvider, Message } from "../types.js";
import {
  type AgentContext,
  AgentMixin,
  type AgentResult,
} from "./base-agent.js";

// Re-export ResponseTarget for consumers
export type { ResponseTarget } from "../platform-response.js";

/**
 * Pending execution for fire-and-forget pattern
 */
export interface PendingExecution {
  /** Unique execution identifier */
  executionId: string;
  /** Query to process */
  query: string;
  /** Agent context for routing */
  context: AgentContext;
  /** Target for response delivery */
  responseTarget: ResponseTarget;
  /** When execution was scheduled */
  scheduledAt: number;
}

/**
 * Router agent state
 */
export interface RouterAgentState {
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
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
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
export interface RouterAgentEnv {
  /** Agent bindings - these are optional since not all may be deployed */
  SimpleAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
  OrchestratorAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
  HITLAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
  CodeWorker?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
  ResearchWorker?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
  GitHubWorker?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
  DuyetInfoAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;

  /** State DO for centralized observability and watchdog recovery */
  StateDO?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
}

/**
 * Configuration for router agent
 */
export interface RouterAgentConfig<TEnv extends RouterAgentEnv> {
  /** Function to create LLM provider from env and optional context */
  createProvider: (env: TEnv, context?: AgentContext) => LLMProvider;
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
  route(query: string, context: AgentContext): Promise<AgentResult>;
  getStats(): {
    totalRouted: number;
    byTarget: Record<string, number>;
    avgDurationMs: number;
  };
  getRoutingHistory(limit?: number): RouterAgentState["routingHistory"];
  getLastClassification(): QueryClassification | undefined;
  clearHistory(): void;
}

/**
 * Type for RouterAgent class
 */
export type RouterAgentClass<TEnv extends RouterAgentEnv> = typeof Agent<
  TEnv,
  RouterAgentState
> & {
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
  config: RouterAgentConfig<TEnv>,
): RouterAgentClass<TEnv> {
  const maxHistory = config.maxHistory ?? 50;
  const debug = config.debug ?? false;

  const AgentClass = class RouterAgent extends Agent<TEnv, RouterAgentState> {
    override initialState: RouterAgentState = {
      sessionId: "",
      lastClassification: undefined,
      routingHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    /**
     * Handle state updates
     */
    override onStateUpdate(
      _state: RouterAgentState,
      source: "server" | Connection,
    ): void {
      if (debug) {
        logger.info("[RouterAgent] State updated", { source });
      }
    }

    /**
     * Route a query to the appropriate handler
     */
    async route(query: string, context: AgentContext): Promise<AgentResult> {
      const startTime = Date.now();
      const traceId = context.traceId ?? AgentMixin.generateId("trace");

      AgentMixin.log("RouterAgent", "Routing query", {
        traceId,
        queryLength: query.length,
        platform: context.platform,
      });

      try {
        // Get LLM provider (pass context for platformConfig credentials)
        const env = (this as unknown as { env: TEnv }).env;
        const provider = config.createProvider(env, context);

        // Build classification context
        const validPlatforms = ["telegram", "github", "api", "cli"] as const;
        const platform = validPlatforms.includes(
          context.platform as (typeof validPlatforms)[number],
        )
          ? (context.platform as (typeof validPlatforms)[number])
          : undefined;

        const classificationContext: ClassificationContext = {
          platform,
          recentMessages: this.state.routingHistory.slice(-3).map((h) => ({
            role: "user",
            content: h.query,
          })),
        };

        // Classify the query
        const classifierConfig: ClassifierConfig = { provider };
        if (config.customClassificationPrompt) {
          classifierConfig.customPrompt = config.customClassificationPrompt;
        }
        const classification = await hybridClassify(
          query,
          classifierConfig,
          classificationContext,
        );

        // Determine route target
        const target = determineRouteTarget(classification);

        const durationMs = Date.now() - startTime;

        // Structured debug logging for routing decision
        if (debug) {
          const logEntry = {
            timestamp: new Date().toISOString(),
            traceId,
            query: query.slice(0, 100), // Truncated for logging
            classification: {
              type: classification.type,
              category: classification.category,
              complexity: classification.complexity,
              confidence: classification.confidence,
              reasoning: classification.reasoning?.slice(0, 200),
            },
            target,
            durationMs,
            sessionId: this.state.sessionId,
            platform: context.platform,
          };

          logger.info("[ROUTER_DEBUG] Routing decision", logEntry);
        }

        // Update state with routing history (truncate fields to limit storage)
        this.setState({
          ...this.state,
          sessionId:
            this.state.sessionId || context.chatId?.toString() || traceId,
          lastClassification: classification,
          routingHistory: [
            ...this.state.routingHistory.slice(-(maxHistory - 1)),
            {
              query: query.slice(0, 200),
              classification: {
                ...classification,
                reasoning: classification.reasoning?.slice(0, 100),
              },
              routedTo: target,
              timestamp: Date.now(),
              durationMs,
            },
          ],
          updatedAt: Date.now(),
        });

        AgentMixin.log("RouterAgent", "Classification complete", {
          traceId,
          type: classification.type,
          category: classification.category,
          complexity: classification.complexity,
          target,
          durationMs,
        });

        // Route to target agent
        const result = await this.dispatchToTarget(
          target,
          query,
          context,
          classification,
        );

        // Log successful routing outcome
        if (debug) {
          logger.info("[ROUTER_DEBUG] Routing outcome", {
            traceId,
            target,
            success: result.success,
            resultDurationMs: result.durationMs,
            totalDurationMs: Date.now() - startTime,
          });
        }

        return result;
      } catch (error) {
        const durationMs = Date.now() - startTime;

        // Enhanced error logging
        if (debug) {
          logger.error("[ROUTER_DEBUG] Routing error", {
            traceId,
            query: query.slice(0, 100),
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            durationMs,
          });
        }

        AgentMixin.logError("RouterAgent", "Routing failed", error, {
          traceId,
          durationMs,
        });

        return AgentMixin.createErrorResult(error, durationMs);
      }
    }

    /**
     * Dispatch query to target agent/worker
     */
    private async dispatchToTarget(
      target: RouteTarget,
      query: string,
      context: AgentContext,
      classification: QueryClassification,
    ): Promise<AgentResult> {
      const startTime = Date.now();
      const env = (this as unknown as { env: TEnv }).env;

      // Build enhanced context for target
      // Forward conversation history from parent to enable stateless child agents
      const targetContextBase: AgentContext = {
        ...context,
        data: {
          ...context.data,
          classification,
          routedFrom: "router-agent",
        },
      };

      const targetContext: AgentContext =
        context.conversationHistory !== undefined
          ? {
              ...targetContextBase,
              conversationHistory: context.conversationHistory,
            }
          : targetContextBase;

      try {
        switch (target) {
          case "simple-agent": {
            if (!env.SimpleAgent) {
              // Fallback: handle simple queries directly
              return this.handleSimpleQuery(query, targetContext);
            }
            const agent = await getAgentByName(
              env.SimpleAgent,
              targetContext.chatId?.toString() || "default",
            );
            return (
              agent as unknown as {
                execute: (q: string, c: AgentContext) => Promise<AgentResult>;
              }
            ).execute(query, targetContext);
          }

          case "orchestrator-agent": {
            if (!env.OrchestratorAgent) {
              return AgentMixin.createErrorResult(
                new Error("OrchestratorAgent not available"),
                Date.now() - startTime,
              );
            }
            const agent = await getAgentByName(
              env.OrchestratorAgent,
              targetContext.chatId?.toString() || "default",
            );
            return (
              agent as unknown as {
                orchestrate: (
                  q: string,
                  c: AgentContext,
                ) => Promise<AgentResult>;
              }
            ).orchestrate(query, targetContext);
          }

          case "hitl-agent": {
            if (!env.HITLAgent) {
              return AgentMixin.createErrorResult(
                new Error("HITLAgent not available"),
                Date.now() - startTime,
              );
            }
            const agent = await getAgentByName(
              env.HITLAgent,
              targetContext.chatId?.toString() || "default",
            );
            return (
              agent as unknown as {
                handle: (q: string, c: AgentContext) => Promise<AgentResult>;
              }
            ).handle(query, targetContext);
          }

          case "code-worker": {
            if (!env.CodeWorker) {
              // Fallback to simple handling
              return this.handleSimpleQuery(query, targetContext);
            }
            const agent = await getAgentByName(
              env.CodeWorker,
              AgentMixin.generateId("worker"),
            );
            return (
              agent as unknown as {
                execute: (q: string, c: AgentContext) => Promise<AgentResult>;
              }
            ).execute(query, targetContext);
          }

          case "research-worker": {
            if (!env.ResearchWorker) {
              return this.handleSimpleQuery(query, targetContext);
            }
            const agent = await getAgentByName(
              env.ResearchWorker,
              AgentMixin.generateId("worker"),
            );
            return (
              agent as unknown as {
                execute: (q: string, c: AgentContext) => Promise<AgentResult>;
              }
            ).execute(query, targetContext);
          }

          case "github-worker": {
            if (!env.GitHubWorker) {
              return this.handleSimpleQuery(query, targetContext);
            }
            const agent = await getAgentByName(
              env.GitHubWorker,
              AgentMixin.generateId("worker"),
            );
            return (
              agent as unknown as {
                execute: (q: string, c: AgentContext) => Promise<AgentResult>;
              }
            ).execute(query, targetContext);
          }

          case "duyet-info-agent": {
            if (!env.DuyetInfoAgent) {
              return this.handleSimpleQuery(query, targetContext);
            }
            const agent = await getAgentByName(
              env.DuyetInfoAgent,
              targetContext.chatId?.toString() || "default",
            );
            return (
              agent as unknown as {
                execute: (q: string, c: AgentContext) => Promise<AgentResult>;
              }
            ).execute(query, targetContext);
          }

          default: {
            // Fallback for unknown targets
            AgentMixin.log(
              "RouterAgent",
              "Unknown target, using simple handler",
              {
                target,
              },
            );
            return this.handleSimpleQuery(query, targetContext);
          }
        }
      } catch (error) {
        AgentMixin.logError("RouterAgent", "Dispatch failed", error, {
          target,
        });
        return AgentMixin.createErrorResult(error, Date.now() - startTime);
      }
    }

    /**
     * Handle simple queries directly (fallback when SimpleAgent not available)
     */
    private async handleSimpleQuery(
      query: string,
      context: AgentContext,
    ): Promise<AgentResult> {
      const startTime = Date.now();
      const env = (this as unknown as { env: TEnv }).env;

      try {
        const provider = config.createProvider(env, context);
        const messages: Message[] = [
          {
            role: "system",
            content:
              "You are a helpful assistant. Respond concisely and accurately.",
          },
          { role: "user", content: query },
        ];

        const response = await provider.chat(
          messages.map((m) => ({
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          })),
        );

        return AgentMixin.createResult(
          true,
          response.content,
          Date.now() - startTime,
        );
      } catch (error) {
        return AgentMixin.createErrorResult(error, Date.now() - startTime);
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
      const history = this.state.routingHistory;
      const byTarget: Record<string, number> = {};

      for (const entry of history) {
        byTarget[entry.routedTo] = (byTarget[entry.routedTo] || 0) + 1;
      }

      const avgDurationMs =
        history.length > 0
          ? history.reduce((sum, h) => sum + h.durationMs, 0) / history.length
          : 0;

      return {
        totalRouted: history.length,
        byTarget,
        avgDurationMs,
      };
    }

    /**
     * Get routing history with optional limit
     */
    getRoutingHistory(limit?: number): RouterAgentState["routingHistory"] {
      const history = this.state.routingHistory;
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
     * @param query - The query to process
     * @param context - Agent context for routing
     * @param responseTarget - Where to send the response
     * @returns Promise with scheduled status and execution ID
     */
    async scheduleExecution(
      query: string,
      context: AgentContext,
      responseTarget: ResponseTarget,
    ): Promise<{ scheduled: boolean; executionId: string }> {
      const executionId = AgentMixin.generateId("exec");

      // Store execution context in state
      const pendingExecutions = this.state.pendingExecutions || [];
      this.setState({
        ...this.state,
        pendingExecutions: [
          ...pendingExecutions,
          {
            executionId,
            query,
            context,
            responseTarget,
            scheduledAt: Date.now(),
          },
        ],
        updatedAt: Date.now(),
      });

      // Schedule alarm to process (fires in 1s - reliable with second-precision timestamps)
      await this.schedule(1, "onExecutionAlarm", { executionId });

      AgentMixin.log("RouterAgent", "Scheduled fire-and-forget execution", {
        executionId,
        queryLength: query.length,
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
        (e) => e.executionId === data.executionId,
      );

      if (!execution) {
        logger.warn("[RouterAgent] Execution not found", {
          executionId: data.executionId,
        });
        return;
      }

      const startTime = Date.now();

      try {
        AgentMixin.log("RouterAgent", "Processing fire-and-forget execution", {
          executionId: data.executionId,
          queryLength: execution.query.length,
        });

        // Do the actual routing + LLM work (full 30s budget available)
        const result = await this.route(execution.query, execution.context);

        // Get the latest classification from state (populated by route())
        const classification = this.state.lastClassification;
        const target = classification
          ? determineRouteTarget(classification)
          : "router";

        // Build debug context for admin users
        const totalDurationMs = Date.now() - startTime;

        // Build target agent step - only include tools if defined to satisfy exactOptionalPropertyTypes
        const targetAgentStep: DebugContext["routingFlow"][0] = {
          agent: target,
          durationMs: result.durationMs,
        };
        if (result.debug?.tools && result.debug.tools.length > 0) {
          targetAgentStep.tools = result.debug.tools;
        }

        // Build debug context - only include classification if present (exactOptionalPropertyTypes)
        const debugContext: DebugContext = {
          routingFlow: [
            { agent: "router" },
            targetAgentStep,
            // Include sub-agents if orchestrator delegated
            ...(result.debug?.subAgents || []).map((subAgent) => ({
              agent: subAgent,
            })),
          ],
          totalDurationMs,
        };
        // Add classification only when present to satisfy exactOptionalPropertyTypes
        if (classification) {
          debugContext.classification = {
            type: classification.type,
            category: classification.category,
            complexity: classification.complexity,
          };
        }
        // Add metadata from agent debug info (fallback, cache, timeout)
        if (result.debug?.metadata) {
          debugContext.metadata = result.debug.metadata;
        }

        // Send response directly to platform
        // Cast env to PlatformEnv - platform tokens come from responseTarget or env
        const envWithTokens = (this as unknown as { env: TEnv })
          .env as unknown as {
          TELEGRAM_BOT_TOKEN?: string;
          GITHUB_TOKEN?: string;
        };
        // Build response text - ensure string even if content is undefined
        const responseText =
          result.success && result.content
            ? result.content
            : `❌ Error: ${result.error || "Unknown error"}`;
        await sendPlatformResponse(
          envWithTokens,
          execution.responseTarget,
          responseText,
          debugContext,
        );

        AgentMixin.log("RouterAgent", "Fire-and-forget execution completed", {
          executionId: data.executionId,
          success: result.success,
          durationMs: totalDurationMs,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        logger.error("[RouterAgent] Execution alarm failed", {
          executionId: data.executionId,
          error: errorMessage,
          durationMs: Date.now() - startTime,
        });

        // Try to send error message to user
        try {
          const envForError = (this as unknown as { env: TEnv })
            .env as unknown as {
            TELEGRAM_BOT_TOKEN?: string;
            GITHUB_TOKEN?: string;
          };
          await sendPlatformResponse(
            envForError,
            execution.responseTarget,
            "❌ Sorry, an error occurred processing your request.",
          );
        } catch (sendError) {
          logger.error("[RouterAgent] Failed to send error message", {
            executionId: data.executionId,
            error:
              sendError instanceof Error
                ? sendError.message
                : String(sendError),
          });
        }
      } finally {
        // Clean up - remove from pending
        // Filter out the completed execution, keeping undefined if no executions remain
        const remainingExecutions = this.state.pendingExecutions?.filter(
          (e) => e.executionId !== data.executionId,
        );
        this.setState({
          ...this.state,
          pendingExecutions:
            remainingExecutions && remainingExecutions.length > 0
              ? remainingExecutions
              : undefined,
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
