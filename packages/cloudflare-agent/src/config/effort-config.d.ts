/**
 * Effort Configuration
 *
 * Defines effort levels for scaling agent resources based on query complexity.
 * Based on Anthropic's multi-agent research system patterns:
 * - Simple queries: 1 agent, 3-10 tool calls
 * - Medium queries: 2-3 agents, 10-30 tool calls
 * - Complex queries: 5-10 agents, 30-100 tool calls
 */
import { z } from 'zod';
/**
 * Effort level identifier
 */
export declare const EffortLevel: z.ZodEnum<['minimal', 'standard', 'thorough', 'exhaustive']>;
export type EffortLevel = z.infer<typeof EffortLevel>;
/**
 * Effort configuration for a specific level
 */
export interface EffortConfig {
  /** Maximum number of parallel subagents */
  maxSubagents: number;
  /** Maximum total tool calls across all subagents */
  maxToolCalls: number;
  /** Timeout in milliseconds for entire operation */
  timeoutMs: number;
  /** Maximum tool calls per subagent */
  maxToolCallsPerSubagent: number;
  /** Whether to use LLM for result aggregation */
  useLLMAggregation: boolean;
  /** Maximum tokens per subagent context */
  maxTokensPerSubagent: number;
}
/**
 * Predefined effort configurations
 */
export declare const EFFORT_CONFIGS: Record<EffortLevel, EffortConfig>;
/**
 * Effort estimation output from classifier
 */
export interface EffortEstimate {
  /** Recommended effort level */
  level: EffortLevel;
  /** Recommended number of subagents (1-10) */
  recommendedSubagents: number;
  /** Maximum tool calls (3-100) */
  maxToolCalls: number;
  /** Expected duration category */
  expectedDuration: 'fast' | 'medium' | 'long';
  /** Reasoning for the estimate */
  reasoning: string;
}
/**
 * Zod schema for effort estimation
 */
export declare const EffortEstimateSchema: z.ZodObject<
  {
    level: z.ZodEnum<['minimal', 'standard', 'thorough', 'exhaustive']>;
    recommendedSubagents: z.ZodNumber;
    maxToolCalls: z.ZodNumber;
    expectedDuration: z.ZodEnum<['fast', 'medium', 'long']>;
    reasoning: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
    recommendedSubagents: number;
    maxToolCalls: number;
    expectedDuration: 'medium' | 'fast' | 'long';
    reasoning: string;
  },
  {
    level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
    recommendedSubagents: number;
    maxToolCalls: number;
    expectedDuration: 'medium' | 'fast' | 'long';
    reasoning: string;
  }
>;
/**
 * Map complexity + category to effort level
 */
export declare function estimateEffortLevel(
  complexity: 'low' | 'medium' | 'high',
  category: string,
  queryLength: number
): EffortEstimate;
/**
 * Get effort config for a given level
 */
export declare function getEffortConfig(level: EffortLevel): EffortConfig;
/**
 * Get effort config from an estimate
 */
export declare function getEffortConfigFromEstimate(estimate: EffortEstimate): EffortConfig;
//# sourceMappingURL=effort-config.d.ts.map
