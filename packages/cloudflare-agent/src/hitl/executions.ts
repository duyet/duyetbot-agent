/**
 * Tool Executions Handler
 *
 * Handles the execution of approved tools after user confirmation.
 * Manages execution queue, retries, and result collection.
 */

import { AgentMixin } from '../agents/base-agent.js';
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
 * Default execution options
 */
const DEFAULT_OPTIONS: Required<ExecutionOptions> = {
  timeoutMs: 30000, // 30 seconds
  maxRetries: 0,
  retryDelayMs: 1000,
  continueOnError: true,
};

/**
 * Execute a single tool with timeout and error handling
 */
export async function executeTool(
  confirmation: ToolConfirmation,
  executor: ToolExecutor,
  options: ExecutionOptions = {}
): Promise<ExecutionEntry> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  let lastError: Error | null = null;
  let attempts = 0;

  while (attempts <= opts.maxRetries) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Tool execution timed out')), opts.timeoutMs);
      });

      // Execute tool with timeout
      const result = await Promise.race([
        executor(confirmation.toolName, confirmation.toolArgs),
        timeoutPromise,
      ]);

      return {
        toolName: confirmation.toolName,
        args: confirmation.toolArgs,
        result,
        success: true,
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempts++;

      if (attempts <= opts.maxRetries) {
        AgentMixin.log('HITLExecutor', 'Tool execution failed, retrying', {
          toolName: confirmation.toolName,
          attempt: attempts,
          maxRetries: opts.maxRetries,
          error: lastError.message,
        });

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, opts.retryDelayMs));
      }
    }
  }

  // All attempts failed
  return {
    toolName: confirmation.toolName,
    args: confirmation.toolArgs,
    result: null,
    success: false,
    error: lastError?.message ?? 'Unknown error',
    timestamp: Date.now(),
    durationMs: Date.now() - startTime,
  };
}

/**
 * Execute multiple approved tools in sequence
 */
export async function executeApprovedTools(
  confirmations: ToolConfirmation[],
  executor: ToolExecutor,
  options: ExecutionOptions = {},
  onProgress?: (entry: ExecutionEntry, index: number, total: number) => void
): Promise<BatchExecutionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  const results: ExecutionEntry[] = [];

  // Filter to only approved confirmations
  const approved = confirmations.filter((c) => c.status === 'approved');

  for (let i = 0; i < approved.length; i++) {
    const confirmation = approved[i];
    if (!confirmation) {
      continue;
    }

    AgentMixin.log('HITLExecutor', 'Executing tool', {
      toolName: confirmation.toolName,
      index: i + 1,
      total: approved.length,
    });

    const entry = await executeTool(confirmation, executor, opts);
    results.push(entry);

    // Notify progress
    if (onProgress) {
      onProgress(entry, i, approved.length);
    }

    // Stop on error if configured
    if (!entry.success && !opts.continueOnError) {
      AgentMixin.log('HITLExecutor', 'Stopping batch execution due to error', {
        toolName: confirmation.toolName,
        error: entry.error,
      });
      break;
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  return {
    results,
    successCount,
    failureCount,
    totalDurationMs: Date.now() - startTime,
    allSucceeded: failureCount === 0,
  };
}

/**
 * Execute tools in parallel with concurrency limit
 */
export async function executeToolsParallel(
  confirmations: ToolConfirmation[],
  executor: ToolExecutor,
  options: ExecutionOptions & { maxConcurrency?: number } = {}
): Promise<BatchExecutionResult> {
  const { maxConcurrency = 3, ...opts } = options;
  const fullOpts = { ...DEFAULT_OPTIONS, ...opts };
  const startTime = Date.now();

  // Filter to only approved confirmations
  const approved = confirmations.filter((c) => c.status === 'approved');

  // Execute in batches with concurrency limit
  const results: ExecutionEntry[] = [];
  for (let i = 0; i < approved.length; i += maxConcurrency) {
    const batch = approved.slice(i, i + maxConcurrency);
    const batchResults = await Promise.all(
      batch.map((confirmation) => executeTool(confirmation, executor, fullOpts))
    );
    results.push(...batchResults);
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  return {
    results,
    successCount,
    failureCount,
    totalDurationMs: Date.now() - startTime,
    allSucceeded: failureCount === 0,
  };
}

/**
 * Format execution results for display
 */
export function formatExecutionResults(result: BatchExecutionResult): string {
  let message = '';

  if (result.allSucceeded) {
    message += `[ok] **All ${result.successCount} tool(s) executed successfully**\n\n`;
  } else {
    message += `[!] **Execution completed with ${result.failureCount} error(s)**\n\n`;
    message += `[ok] Succeeded: ${result.successCount}\n`;
    message += `[x] Failed: ${result.failureCount}\n\n`;
  }

  for (const entry of result.results) {
    const statusIcon = entry.success ? '[ok]' : '[x]';
    message += `${statusIcon} **${entry.toolName}** (${entry.durationMs}ms)\n`;

    if (!entry.success && entry.error) {
      message += `   Error: ${entry.error}\n`;
    }
  }

  message += `\nTotal time: ${result.totalDurationMs}ms`;

  return message;
}

/**
 * Create a no-op executor for testing
 */
export function createMockExecutor(results: Map<string, unknown> = new Map()): ToolExecutor {
  return async (toolName: string, _args: Record<string, unknown>): Promise<unknown> => {
    // Simulate some execution time
    await new Promise((resolve) => setTimeout(resolve, 10));

    if (results.has(toolName)) {
      return results.get(toolName);
    }

    return { success: true, toolName };
  };
}

/**
 * Create an executor that wraps a tools registry
 */
export function createRegistryExecutor(
  registry: Map<string, (args: Record<string, unknown>) => Promise<unknown>>
): ToolExecutor {
  return async (toolName: string, args: Record<string, unknown>): Promise<unknown> => {
    const tool = registry.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    return tool(args);
  };
}
