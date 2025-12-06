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
export declare function formatDependencyContext(results: Map<string, WorkerResult>): string;
/**
 * Type guard to check if a result indicates success
 */
export declare function isSuccessfulResult(result: WorkerResult): boolean;
/**
 * Combine multiple worker results into a summary
 */
export declare function summarizeResults(results: WorkerResult[]): {
  totalSteps: number;
  successCount: number;
  failureCount: number;
  totalDurationMs: number;
  errors: Array<{
    stepId: string;
    error: string;
  }>;
};
//# sourceMappingURL=worker-utils.d.ts.map
