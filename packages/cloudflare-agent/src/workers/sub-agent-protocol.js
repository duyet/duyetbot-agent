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
/**
 * Worker Registry
 *
 * Manages a pool of sub-agent workers with health monitoring.
 * Provides worker selection based on capabilities and health status.
 */
export class WorkerRegistry {
  workers = new Map();
  healthCheckIntervalMs = 60_000; // 1 minute default
  /**
   * Register a new worker
   *
   * @param worker - Worker to register
   * @param workerType - Worker type for dispatcher routing
   */
  register(worker, workerType) {
    this.workers.set(worker.name, {
      worker,
      healthy: true, // Assume healthy until proven otherwise
      lastHealthCheck: 0,
      failureCount: 0,
      workerType,
    });
  }
  /**
   * Unregister a worker
   *
   * @param name - Worker name to remove
   */
  unregister(name) {
    this.workers.delete(name);
  }
  /**
   * Get a healthy worker by capability
   *
   * @param capability - Required capability
   * @returns Worker entry or undefined if none available
   */
  getWorkerByCapability(capability) {
    for (const entry of this.workers.values()) {
      if (entry.healthy && entry.worker.capabilities.includes(capability)) {
        return entry;
      }
    }
    return undefined;
  }
  /**
   * Get a healthy worker by type
   *
   * @param workerType - Worker type to find
   * @returns Worker entry or undefined if none available
   */
  getWorkerByType(workerType) {
    for (const entry of this.workers.values()) {
      if (entry.healthy && entry.workerType === workerType) {
        return entry;
      }
    }
    return undefined;
  }
  /**
   * Get all healthy workers
   */
  getHealthyWorkers() {
    return Array.from(this.workers.values()).filter((entry) => entry.healthy);
  }
  /**
   * Get all registered workers
   */
  getAllWorkers() {
    return Array.from(this.workers.values());
  }
  /**
   * Check health of all workers
   *
   * Should be called periodically (e.g., every minute).
   */
  async checkAllHealth() {
    const results = new Map();
    const now = Date.now();
    const healthChecks = Array.from(this.workers.entries()).map(async ([name, entry]) => {
      // Skip if recently checked
      if (now - entry.lastHealthCheck < this.healthCheckIntervalMs) {
        results.set(name, entry.healthy);
        return;
      }
      try {
        const health = await entry.worker.healthCheck();
        entry.healthy = health.available && health.latencyMs < 5000; // 5s timeout threshold
        entry.lastHealthCheck = now;
        entry.failureCount = entry.healthy ? 0 : entry.failureCount + 1;
        results.set(name, entry.healthy);
      } catch {
        entry.healthy = false;
        entry.failureCount += 1;
        entry.lastHealthCheck = now;
        results.set(name, false);
      }
    });
    await Promise.allSettled(healthChecks);
    return results;
  }
  /**
   * Mark a worker as failed (called when execute() fails)
   *
   * @param name - Worker name
   */
  markFailed(name) {
    const entry = this.workers.get(name);
    if (entry) {
      entry.failureCount += 1;
      // Mark unhealthy after 3 consecutive failures
      if (entry.failureCount >= 3) {
        entry.healthy = false;
      }
    }
  }
  /**
   * Get registry statistics
   */
  getStats() {
    const all = this.getAllWorkers();
    const healthy = all.filter((w) => w.healthy).length;
    return {
      total: all.length,
      healthy,
      unhealthy: all.length - healthy,
    };
  }
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
export function createSubAgentWorkerAdapter(name, capabilities, execute) {
  return {
    name,
    capabilities,
    execute: async (input) => {
      const result = await execute(input);
      return result;
    },
    healthCheck: async () => ({
      available: true,
      latencyMs: 0,
    }),
  };
}
/**
 * Validate a re-planning request
 *
 * Checks if re-planning is allowed based on iteration count.
 * Returns false if max iterations (2) reached.
 *
 * @param result - Worker result to validate
 * @param maxIterations - Maximum allowed iterations (default: 2)
 */
export function validateReplanningRequest(result, maxIterations = 2) {
  if (!result.needsMoreContext) {
    return false;
  }
  const iteration = result.iterationCount ?? 0;
  return iteration < maxIterations;
}
/**
 * Create a context-gathering step
 *
 * Helper to create a plan step that gathers additional context
 * based on a worker's contextSuggestion.
 *
 * @param suggestion - Context suggestion from worker
 * @param dependsOn - Steps this depends on
 */
export function createContextGatheringStep(suggestion, dependsOn = []) {
  const id = `ctx-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    description: `Gather additional context: ${suggestion.slice(0, 100)}`,
    workerType: 'research',
    task: `Research and gather the following context information: ${suggestion}`,
    dependsOn,
    priority: 8, // High priority to gather context quickly
    expectedOutput: 'text',
  };
}
/**
 * Default worker registry instance
 *
 * Applications can use this singleton or create their own registry.
 */
export const defaultWorkerRegistry = new WorkerRegistry();
