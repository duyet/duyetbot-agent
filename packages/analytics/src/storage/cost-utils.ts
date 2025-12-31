/**
 * Cost Calculation Utilities
 *
 * Provides cost estimation for token usage when model-specific pricing
 * is not available. Uses reasonable default rates based on common LLM pricing.
 */

/**
 * Default pricing rates (USD per 1M tokens)
 * These are conservative estimates based on typical LLM pricing as of 2024.
 */
export const DEFAULT_COST_RATES = {
  /** Cost per 1M input tokens */
  inputPerMillion: 1.0,
  /** Cost per 1M output tokens */
  outputPerMillion: 3.0,
  /** Cost per 1M cached tokens */
  cachedPerMillion: 0.1,
  /** Cost per 1M reasoning tokens (similar to output) */
  reasoningPerMillion: 3.0,
};

/**
 * Token usage for cost calculation
 */
export interface TokenUsageForCostEstimate {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
}

/**
 * Estimate cost for token usage using default rates
 *
 * Use this function when model-specific pricing is not available,
 * such as when aggregating across multiple models or sessions.
 *
 * @param usage - Token usage breakdown
 * @returns Estimated cost in USD
 *
 * @example
 * ```typescript
 * const cost = estimateCostFromTokens({
 *   inputTokens: 10000,
 *   outputTokens: 5000,
 * });
 * // cost = (10000 * 1.0 / 1_000_000) + (5000 * 3.0 / 1_000_000) = 0.025 USD
 * ```
 */
export function estimateCostFromTokens(usage: TokenUsageForCostEstimate): number {
  let cost = 0;

  // Input tokens cost (non-cached)
  const nonCachedInputTokens = usage.cachedTokens
    ? Math.max(0, usage.inputTokens - usage.cachedTokens)
    : usage.inputTokens;
  cost += (nonCachedInputTokens * DEFAULT_COST_RATES.inputPerMillion) / 1_000_000;

  // Output tokens cost
  cost += (usage.outputTokens * DEFAULT_COST_RATES.outputPerMillion) / 1_000_000;

  // Cached tokens cost (if present)
  if (usage.cachedTokens && usage.cachedTokens > 0) {
    cost += (usage.cachedTokens * DEFAULT_COST_RATES.cachedPerMillion) / 1_000_000;
  }

  // Reasoning tokens cost (if present)
  if (usage.reasoningTokens && usage.reasoningTokens > 0) {
    cost += (usage.reasoningTokens * DEFAULT_COST_RATES.reasoningPerMillion) / 1_000_000;
  }

  return cost;
}
