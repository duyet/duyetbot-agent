/**
 * Result Aggregator
 *
 * Aggregates and synthesizes results from multiple workers.
 * Produces final unified responses from distributed execution.
 *
 * Based on Cloudflare's Orchestrator-Workers pattern:
 * https://developers.cloudflare.com/agents/patterns/orchestrator-workers/
 */
import type { AgentProvider } from '../execution/agent-provider.js';
import type { ExecutionPlan } from '../routing/schemas.js';
import type { LLMProvider } from '../types.js';
import type { ExecutionResult } from './executor.js';
/**
 * Aggregator configuration
 */
export interface AggregatorConfig {
  /** LLM/Agent provider for synthesis */
  provider: LLMProvider | AgentProvider;
  /** Maximum tokens for aggregation response */
  maxTokens?: number;
  /** Enable detailed logging */
  debug?: boolean;
}
/**
 * Aggregation result
 */
export interface AggregationResult {
  /** Synthesized response */
  response: string;
  /** Summary of execution */
  summary: {
    totalSteps: number;
    successCount: number;
    failureCount: number;
    skippedCount: number;
    totalDurationMs: number;
  };
  /** Individual step outputs (structured) */
  stepOutputs: Array<{
    stepId: string;
    success: boolean;
    output: unknown;
    error?: string;
  }>;
  /** Any errors encountered */
  errors: Array<{
    stepId: string;
    error: string;
  }>;
}
/**
 * Aggregate execution results into a final response
 */
export declare function aggregateResults(
  plan: ExecutionPlan,
  executionResult: ExecutionResult,
  config: AggregatorConfig
): Promise<AggregationResult>;
/**
 * Quick aggregation without LLM (for simple results)
 */
export declare function quickAggregate(
  plan: ExecutionPlan,
  executionResult: ExecutionResult
): AggregationResult;
/**
 * Extract key findings from aggregation result
 */
export declare function extractKeyFindings(result: AggregationResult): string[];
//# sourceMappingURL=aggregator.d.ts.map
