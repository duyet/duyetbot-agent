/**
 * Tool Executions Handler
 *
 * Handles the execution of approved tools after user confirmation.
 * Manages execution queue, retries, and result collection.
 */
import type { ToolConfirmation } from '../routing/schemas.js';
import type { ExecutionEntry } from './state-machine.js';
/**
 * Tool executor function type
 */
export type ToolExecutor = (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
/**
 * Execution options
 */
export interface ExecutionOptions {
  /** Timeout for tool execution in ms */
  timeoutMs?: number;
  /** Maximum retries on failure */
  maxRetries?: number;
  /** Delay between retries in ms */
  retryDelayMs?: number;
  /** Whether to continue executing remaining tools on failure */
  continueOnError?: boolean;
}
/**
 * Result of executing multiple tools
 */
export interface BatchExecutionResult {
  /** All execution results */
  results: ExecutionEntry[];
  /** Number of successful executions */
  successCount: number;
  /** Number of failed executions */
  failureCount: number;
  /** Total duration in ms */
  totalDurationMs: number;
  /** Whether all executions succeeded */
  allSucceeded: boolean;
}
/**
 * Execute a single tool with timeout and error handling
 */
export declare function executeTool(
  confirmation: ToolConfirmation,
  executor: ToolExecutor,
  options?: ExecutionOptions
): Promise<ExecutionEntry>;
/**
 * Execute multiple approved tools in sequence
 */
export declare function executeApprovedTools(
  confirmations: ToolConfirmation[],
  executor: ToolExecutor,
  options?: ExecutionOptions,
  onProgress?: (entry: ExecutionEntry, index: number, total: number) => void
): Promise<BatchExecutionResult>;
/**
 * Execute tools in parallel with concurrency limit
 */
export declare function executeToolsParallel(
  confirmations: ToolConfirmation[],
  executor: ToolExecutor,
  options?: ExecutionOptions & {
    maxConcurrency?: number;
  }
): Promise<BatchExecutionResult>;
/**
 * Format execution results for display
 */
export declare function formatExecutionResults(result: BatchExecutionResult): string;
/**
 * Create a no-op executor for testing
 */
export declare function createMockExecutor(results?: Map<string, unknown>): ToolExecutor;
/**
 * Create an executor that wraps a tools registry
 */
export declare function createRegistryExecutor(
  registry: Map<string, (args: Record<string, unknown>) => Promise<unknown>>
): ToolExecutor;
//# sourceMappingURL=executions.d.ts.map
