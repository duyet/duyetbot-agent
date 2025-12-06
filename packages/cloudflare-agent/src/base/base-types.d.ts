/**
 * Base Types for Durable Object Architecture
 *
 * Provides foundational types for all DO-based agents and services.
 * These types define the common interfaces that all DO implementations extend.
 */
/**
 * Base state interface for all Durable Objects
 * Provides common timestamp tracking across all agents
 */
export interface BaseState {
  /** Unix timestamp (ms) when this state was created */
  createdAt: number;
  /** Unix timestamp (ms) of last update to this state */
  updatedAt: number;
}
/**
 * D1 Database binding type (Cloudflare D1)
 *
 * This is a minimal interface matching Cloudflare Workers D1 binding.
 * Full type comes from @cloudflare/workers-types in worker apps.
 */
export interface D1DatabaseBinding {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<{
        success: boolean;
        meta: {
          changes: number;
        };
      }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{
        results: T[];
      }>;
    };
  };
}
/**
 * Minimal base environment bindings common to all agents
 * Specific agent environments extend this to add platform-specific bindings
 *
 * @example
 * ```typescript
 * interface TelegramBotEnv extends BaseEnv {
 *   TELEGRAM_BOT_TOKEN: string;
 * }
 * ```
 */
export interface BaseEnv {
  /** Current environment (production, development, staging) */
  ENVIRONMENT?: string;
  /** LLM model to use (e.g., 'claude-3-5-sonnet-20241022') */
  MODEL?: string;
  /** Cloudflare AI Gateway name for routing LLM requests */
  CLOUDFLARE_AI_GATEWAY_NAME?: string;
  /** API key for Cloudflare AI Gateway (BYOK) */
  CLOUDFLARE_AI_GATEWAY_KEY?: string;
  /**
   * D1 database for observability events (optional)
   * When present, agents can write completion events to D1
   */
  OBSERVABILITY_DB?: D1DatabaseBinding;
}
/**
 * Information about a worker execution
 * Used to track which workers were invoked and their performance
 */
export interface WorkerInfo {
  /** Worker identifier (e.g., 'code-worker', 'research-worker', 'github-worker') */
  name: string;
  /** Current execution status */
  status: 'success' | 'failed' | 'timeout';
  /** Time spent in this worker (milliseconds) */
  durationMs: number;
  /** Error message if status is 'failed' or 'timeout' (optional) */
  error?: string;
}
/**
 * Debug information collected during agent execution
 * Includes tools used, sub-agents delegated to, and worker execution details
 * Used for observability, tracing, and admin debugging
 */
export interface AgentDebugInfo {
  /** Tools invoked by this agent during execution */
  tools?: string[];
  /** Sub-agents delegated to (for orchestrator/delegation patterns) */
  subAgents?: string[];
  /** Workers executed with their performance metrics */
  workers?: WorkerInfo[];
  /** Additional structured metadata (fallback, cache, timeout info) */
  metadata?: Record<string, unknown>;
}
/**
 * Next action hint for HITL (Human-In-The-Loop) systems
 * Indicates what should happen after agent execution completes
 */
export type AgentNextAction = 'await_confirmation' | 'continue' | 'complete';
/**
 * Result of agent execution
 * Encapsulates success/failure, output, metrics, and debug information
 *
 * @example
 * ```typescript
 * const result: AgentResult = {
 *   success: true,
 *   content: "Here's the analysis...",
 *   durationMs: 1234,
 *   tokensUsed: 450,
 *   debug: {
 *     tools: ['search', 'analyze'],
 *     workers: [
 *       { name: 'code-worker', status: 'success', durationMs: 800 }
 *     ]
 *   }
 * };
 * ```
 */
export interface AgentResult {
  /** Whether execution succeeded (no unrecovered errors) */
  success: boolean;
  /** Text content of the response (optional if only structured data) */
  content?: string;
  /** Structured data result (optional if only text content) */
  data?: unknown;
  /** Error message if execution failed (populated only when success=false) */
  error?: string;
  /** Time taken to execute (milliseconds) */
  durationMs: number;
  /** Total tokens used in LLM calls (optional, if available) */
  tokensUsed?: number;
  /** Next action for HITL workflows (optional) */
  nextAction?: AgentNextAction;
  /** Debug information for tracing and observability (optional) */
  debug?: AgentDebugInfo;
}
/**
 * Create an initial base state with current timestamp
 *
 * @returns BaseState with timestamps set to now
 *
 * @example
 * ```typescript
 * const state = createBaseState();
 * // { createdAt: 1234567890, updatedAt: 1234567890 }
 * ```
 */
export declare function createBaseState(): BaseState;
/**
 * Create a successful agent result
 *
 * @param content - The response content
 * @param durationMs - Execution duration in milliseconds
 * @param extra - Optional additional fields
 * @returns AgentResult with success=true
 */
export declare function createSuccessResult(
  content: string,
  durationMs: number,
  extra?: Partial<AgentResult>
): AgentResult;
/**
 * Create a failed agent result
 *
 * @param error - The error message or Error object
 * @param durationMs - Execution duration in milliseconds
 * @param extra - Optional additional fields
 * @returns AgentResult with success=false
 */
export declare function createErrorResult(
  error: Error | string,
  durationMs: number,
  extra?: Partial<AgentResult>
): AgentResult;
/**
 * Update timestamps on a base state to current time
 *
 * @param state - The state to update
 * @returns Updated state with new updatedAt timestamp
 */
export declare function updateBaseStateTimestamp<T extends BaseState>(state: T): T;
/**
 * Add worker info to debug info
 *
 * @param debug - The debug info object (creates one if undefined)
 * @param worker - Worker info to add
 * @returns Updated debug info
 */
export declare function addWorkerInfo(
  debug: AgentDebugInfo | undefined,
  worker: WorkerInfo
): AgentDebugInfo;
/**
 * Add sub-agent to debug info
 *
 * @param debug - The debug info object (creates one if undefined)
 * @param subAgent - Sub-agent name to add
 * @returns Updated debug info
 */
export declare function addSubAgent(
  debug: AgentDebugInfo | undefined,
  subAgent: string
): AgentDebugInfo;
/**
 * Add tool to debug info
 *
 * @param debug - The debug info object (creates one if undefined)
 * @param tool - Tool name to add
 * @returns Updated debug info
 */
export declare function addTool(debug: AgentDebugInfo | undefined, tool: string): AgentDebugInfo;
//# sourceMappingURL=base-types.d.ts.map
