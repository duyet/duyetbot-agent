/**
 * Sub-Agent Worker Protocol
 *
 * Model-agnostic interface for external model workers (e.g., Gemini, GPT, etc.).
 * Enables multi-model orchestration where different models can be used for
 * different tasks based on their strengths.
 *
 * Key Features:
 * - Model-agnostic: Works with any LLM provider (Claude, Gemini, OpenAI, etc.)
 * - Health monitoring: Built-in health checks for worker availability
 * - Context propagation: Supports needsMoreContext for bounded re-planning
 * - Iteration tracking: Prevents infinite loops via iterationCount
 *
 * @see executor.ts for bounded re-planning implementation
 * @see base-worker.ts for base worker pattern
 */
import type { WorkerResult } from '../routing/schemas.js';
import type { WorkerInput, WorkerType } from './base-worker.js';
/**
 * Sub-agent worker capabilities
 *
 * Defines what task types a worker can handle effectively.
 */
export type SubAgentCapability =
  | 'code-review'
  | 'code-generation'
  | 'research'
  | 'summarization'
  | 'translation'
  | 'data-extraction'
  | 'reasoning'
  | 'creative'
  | 'general';
/**
 * Extended worker result with iteration tracking
 *
 * Adds fields needed for bounded re-planning:
 * - iterationCount: How many times this worker has been called for the same step
 * - metadata: Model-specific execution details
 */
export interface SubAgentWorkerResult extends WorkerResult {
  /** Number of re-planning iterations for this step (max: 2) */
  iterationCount?: number;
  /** Model-specific metadata */
  metadata?: SubAgentMetadata;
}
/**
 * Model execution metadata
 *
 * Tracks model usage for observability and cost control.
 */
export interface SubAgentMetadata {
  /** Which model was used (e.g., "gemini-1.5-pro", "claude-3-opus") */
  model: string;
  /** Tokens consumed */
  tokensUsed: number;
  /** Execution duration in ms */
  durationMs: number;
  /** Model temperature used */
  temperature?: number;
  /** Model-specific response metadata */
  modelResponse?: Record<string, unknown>;
}
/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Whether the worker is available */
  available: boolean;
  /** Response latency in ms */
  latencyMs: number;
  /** Additional health info */
  details?: Record<string, unknown>;
}
/**
 * Sub-Agent Worker Interface
 *
 * Model-agnostic contract for external model workers.
 * Implementations wrap specific model APIs (Gemini, OpenAI, etc.)
 * behind a consistent interface.
 *
 * @example
 * ```typescript
 * const geminiWorker: SubAgentWorker = {
 *   name: 'gemini-security-reviewer',
 *   capabilities: ['code-review', 'reasoning'],
 *   execute: async (input) => {
 *     const result = await geminiApi.generate(input.step.task);
 *     return { stepId: input.step.id, success: true, data: result };
 *   },
 *   healthCheck: async () => ({ available: true, latencyMs: 100 }),
 * };
 * ```
 */
export interface SubAgentWorker {
  /** Unique worker name for identification */
  name: string;
  /** Capabilities this worker excels at */
  capabilities: SubAgentCapability[];
  /**
   * Execute a task step
   *
   * @param input - Worker input containing step, dependencies, context
   * @returns Worker result with optional re-planning signals
   */
  execute(input: WorkerInput): Promise<SubAgentWorkerResult>;
  /**
   * Check worker health and availability
   *
   * Called periodically by WorkerRegistry to maintain health status.
   * Should be lightweight and fast (< 500ms).
   */
  healthCheck(): Promise<HealthCheckResult>;
}
/**
 * Worker registration entry
 */
export interface WorkerRegistryEntry {
  /** The worker instance */
  worker: SubAgentWorker;
  /** Current health status */
  healthy: boolean;
  /** Last health check timestamp */
  lastHealthCheck: number;
  /** Consecutive failure count */
  failureCount: number;
  /** Worker type mapping for dispatcher */
  workerType: WorkerType;
}
/**
 * Worker Registry
 *
 * Manages a pool of sub-agent workers with health monitoring.
 * Provides worker selection based on capabilities and health status.
 */
export declare class WorkerRegistry {
  private workers;
  private healthCheckIntervalMs;
  /**
   * Register a new worker
   *
   * @param worker - Worker to register
   * @param workerType - Worker type for dispatcher routing
   */
  register(worker: SubAgentWorker, workerType: WorkerType): void;
  /**
   * Unregister a worker
   *
   * @param name - Worker name to remove
   */
  unregister(name: string): void;
  /**
   * Get a healthy worker by capability
   *
   * @param capability - Required capability
   * @returns Worker entry or undefined if none available
   */
  getWorkerByCapability(capability: SubAgentCapability): WorkerRegistryEntry | undefined;
  /**
   * Get a healthy worker by type
   *
   * @param workerType - Worker type to find
   * @returns Worker entry or undefined if none available
   */
  getWorkerByType(workerType: WorkerType): WorkerRegistryEntry | undefined;
  /**
   * Get all healthy workers
   */
  getHealthyWorkers(): WorkerRegistryEntry[];
  /**
   * Get all registered workers
   */
  getAllWorkers(): WorkerRegistryEntry[];
  /**
   * Check health of all workers
   *
   * Should be called periodically (e.g., every minute).
   */
  checkAllHealth(): Promise<Map<string, boolean>>;
  /**
   * Mark a worker as failed (called when execute() fails)
   *
   * @param name - Worker name
   */
  markFailed(name: string): void;
  /**
   * Get registry statistics
   */
  getStats(): {
    total: number;
    healthy: number;
    unhealthy: number;
  };
}
/**
 * Create a SubAgentWorker adapter from a base worker
 *
 * Wraps existing workers (CodeWorker, ResearchWorker, etc.) with
 * the SubAgentWorker interface for registry compatibility.
 *
 * @param name - Worker name
 * @param capabilities - Worker capabilities
 * @param execute - Execute function
 */
export declare function createSubAgentWorkerAdapter(
  name: string,
  capabilities: SubAgentCapability[],
  execute: (input: WorkerInput) => Promise<WorkerResult>
): SubAgentWorker;
/**
 * Validate a re-planning request
 *
 * Checks if re-planning is allowed based on iteration count.
 * Returns false if max iterations (2) reached.
 *
 * @param result - Worker result to validate
 * @param maxIterations - Maximum allowed iterations (default: 2)
 */
export declare function validateReplanningRequest(
  result: SubAgentWorkerResult,
  maxIterations?: number
): boolean;
/**
 * Create a context-gathering step
 *
 * Helper to create a plan step that gathers additional context
 * based on a worker's contextSuggestion.
 *
 * @param suggestion - Context suggestion from worker
 * @param dependsOn - Steps this depends on
 */
export declare function createContextGatheringStep(
  suggestion: string,
  dependsOn?: string[]
): {
  id: string;
  description: string;
  workerType: 'research' | 'code' | 'github' | 'general';
  task: string;
  dependsOn: string[];
  priority: number;
  expectedOutput: 'text' | 'code' | 'data' | 'action';
};
/**
 * Default worker registry instance
 *
 * Applications can use this singleton or create their own registry.
 */
export declare const defaultWorkerRegistry: WorkerRegistry;
//# sourceMappingURL=sub-agent-protocol.d.ts.map
