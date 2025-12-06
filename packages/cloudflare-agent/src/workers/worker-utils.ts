/**
 * Worker Utilities
 *
 * Pure utility functions for worker operations.
 * These functions don't depend on Cloudflare-specific imports.
 */

import type { WorkerResult } from '../routing/schemas.js';

/**
 * Worker type enum for type-safe worker selection
 */
export type WorkerType = 'code' | 'research' | 'github' | 'general';

/**
 * Helper to format dependency results as context
 */
export function formatDependencyContext(results: Map<string, WorkerResult>): string {
  if (results.size === 0) {
    return '';
  }

  const lines: string[] = ['## Context from Previous Steps\n'];

  for (const [stepId, result] of results) {
    lines.push(`### Step: ${stepId}`);
    if (result.success) {
      const dataStr =
        typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
      if (dataStr) {
        lines.push(`Result: ${dataStr.slice(0, 1000)}${dataStr.length > 1000 ? '...' : ''}`);
      }
    } else {
      lines.push(`Error: ${result.error}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Type guard to check if a result indicates success
 */
export function isSuccessfulResult(result: WorkerResult): boolean {
  return result.success === true && result.error === undefined;
}

/**
 * Combine multiple worker results into a summary
 */
export function summarizeResults(results: WorkerResult[]): {
  totalSteps: number;
  successCount: number;
  failureCount: number;
  totalDurationMs: number;
  errors: Array<{ stepId: string; error: string }>;
} {
  const errors: Array<{ stepId: string; error: string }> = [];
  let successCount = 0;
  let totalDurationMs = 0;

  for (const result of results) {
    totalDurationMs += result.durationMs;
    if (result.success) {
      successCount++;
    } else if (result.error) {
      errors.push({ stepId: result.stepId, error: result.error });
    }
  }

  return {
    totalSteps: results.length,
    successCount,
    failureCount: results.length - successCount,
    totalDurationMs,
    errors,
  };
}
