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
export const EffortLevel = z.enum(['minimal', 'standard', 'thorough', 'exhaustive']);
/**
 * Predefined effort configurations
 */
export const EFFORT_CONFIGS = {
  minimal: {
    maxSubagents: 1,
    maxToolCalls: 10,
    timeoutMs: 30_000, // 30 seconds
    maxToolCallsPerSubagent: 10,
    useLLMAggregation: false,
    maxTokensPerSubagent: 8_000,
  },
  standard: {
    maxSubagents: 3,
    maxToolCalls: 30,
    timeoutMs: 60_000, // 1 minute
    maxToolCallsPerSubagent: 15,
    useLLMAggregation: true,
    maxTokensPerSubagent: 16_000,
  },
  thorough: {
    maxSubagents: 5,
    maxToolCalls: 60,
    timeoutMs: 120_000, // 2 minutes
    maxToolCallsPerSubagent: 20,
    useLLMAggregation: true,
    maxTokensPerSubagent: 32_000,
  },
  exhaustive: {
    maxSubagents: 10,
    maxToolCalls: 100,
    timeoutMs: 300_000, // 5 minutes
    maxToolCallsPerSubagent: 25,
    useLLMAggregation: true,
    maxTokensPerSubagent: 50_000,
  },
};
/**
 * Zod schema for effort estimation
 */
export const EffortEstimateSchema = z.object({
  level: EffortLevel,
  recommendedSubagents: z.number().min(1).max(10),
  maxToolCalls: z.number().min(3).max(100),
  expectedDuration: z.enum(['fast', 'medium', 'long']),
  reasoning: z.string(),
});
/**
 * Map complexity + category to effort level
 */
export function estimateEffortLevel(complexity, category, queryLength) {
  // Research and code tasks generally need more effort
  const isHighEffortCategory = ['research', 'code', 'github'].includes(category);
  const isLongQuery = queryLength > 200;
  // Base mapping from complexity
  let level;
  let recommendedSubagents;
  let maxToolCalls;
  let expectedDuration;
  switch (complexity) {
    case 'low':
      level = isHighEffortCategory ? 'standard' : 'minimal';
      recommendedSubagents = isHighEffortCategory ? 2 : 1;
      maxToolCalls = isHighEffortCategory ? 15 : 5;
      expectedDuration = 'fast';
      break;
    case 'medium':
      level = isHighEffortCategory || isLongQuery ? 'thorough' : 'standard';
      recommendedSubagents = isHighEffortCategory ? 4 : 2;
      maxToolCalls = isHighEffortCategory ? 40 : 20;
      expectedDuration = 'medium';
      break;
    case 'high':
      level = isLongQuery ? 'exhaustive' : 'thorough';
      recommendedSubagents = isHighEffortCategory ? 8 : 5;
      maxToolCalls = isHighEffortCategory ? 80 : 50;
      expectedDuration = 'long';
      break;
  }
  return {
    level,
    recommendedSubagents,
    maxToolCalls,
    expectedDuration,
    reasoning: `Complexity: ${complexity}, Category: ${category}, Query length: ${queryLength > 200 ? 'long' : 'short'}`,
  };
}
/**
 * Get effort config for a given level
 */
export function getEffortConfig(level) {
  return EFFORT_CONFIGS[level];
}
/**
 * Get effort config from an estimate
 */
export function getEffortConfigFromEstimate(estimate) {
  const base = EFFORT_CONFIGS[estimate.level];
  // Override with estimate-specific values if they're more restrictive
  return {
    ...base,
    maxSubagents: Math.min(base.maxSubagents, estimate.recommendedSubagents),
    maxToolCalls: Math.min(base.maxToolCalls, estimate.maxToolCalls),
  };
}
