import type { TokenUsage } from '@duyetbot/observability';

/**
 * Token tracker for accumulating usage and calculating costs.
 *
 * Provides:
 * - Token usage accumulation across multiple LLM calls
 * - Cost calculation using pricing table
 * - Format helpers for display
 *
 * @example
 * ```typescript
 * const tracker = new TokenTracker('x-ai/grok-4.1-fast');
 *
 * // Accumulate usage from multiple calls
 * tracker.add({ inputTokens: 1200, outputTokens: 400, totalTokens: 1600 });
 * tracker.add({ inputTokens: 800, outputTokens: 200, totalTokens: 1000 });
 *
 * // Get totals
 * const total = tracker.getTotal(); // { inputTokens: 2000, outputTokens: 600, totalTokens: 2600 }
 * const cost = tracker.getCostUsd(); // 0.00096 USD
 * const formatted = tracker.getFormattedCost(); // '$0.0010'
 * ```
 */
export class TokenTracker {
  private inputTokens = 0;
  private outputTokens = 0;
  private totalTokens = 0;
  private cachedTokens = 0;
  private reasoningTokens = 0;

  constructor(private model?: string) {}

  /**
   * Add token usage from a single LLM call.
   *
   * @param usage - Token usage to add
   */
  add(usage: TokenUsage): void {
    this.inputTokens += usage.inputTokens || 0;
    this.outputTokens += usage.outputTokens || 0;
    this.totalTokens += usage.totalTokens || 0;
    this.cachedTokens += usage.cachedTokens || 0;
    this.reasoningTokens += usage.reasoningTokens || 0;
  }

  /**
   * Get total accumulated token usage.
   *
   * @returns Total token usage across all calls
   */
  getTotal(): TokenUsage {
    const total: TokenUsage = {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens: this.totalTokens,
    };

    if (this.cachedTokens > 0) {
      total.cachedTokens = this.cachedTokens;
    }

    if (this.reasoningTokens > 0) {
      total.reasoningTokens = this.reasoningTokens;
    }

    return total;
  }

  /**
   * Calculate total cost in USD based on model pricing.
   *
   * Note: This is a simplified estimation. For accurate costs,
   * use the pricing data from @duyetbot/providers directly.
   *
   * @returns Estimated cost in USD (returns 0 if model not set)
   */
  getCostUsd(): number {
    if (!this.model) {
      return 0;
    }

    // Simplified pricing estimation (per 1M tokens)
    // For accurate costs, import from @duyetbot/providers
    const pricing = getSimplifiedPricing(this.model);

    // For cached tokens: (input - cached) charged at input rate + cached charged at cached rate
    const effectiveInputTokens = this.inputTokens - this.cachedTokens;
    const inputCost = (effectiveInputTokens / 1_000_000) * pricing.inputPerMillion;
    const outputCost = (this.outputTokens / 1_000_000) * pricing.outputPerMillion;
    const cachedCost = pricing.cachedPerMillion
      ? (this.cachedTokens / 1_000_000) * pricing.cachedPerMillion
      : 0;

    return inputCost + outputCost + cachedCost;
  }

  /**
   * Get formatted cost string for display.
   *
   * @returns Formatted cost (e.g., '$0.0042', '<$0.0001', '$0')
   */
  getFormattedCost(): string {
    const cost = this.getCostUsd();
    if (cost === 0) {
      return '$0';
    }
    if (cost < 0.0001) {
      return '<$0.0001';
    }
    // Show 4 decimal places for small costs, 2 for larger
    return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
  }

  /**
   * Reset all counters to zero.
   */
  reset(): void {
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.totalTokens = 0;
    this.cachedTokens = 0;
    this.reasoningTokens = 0;
  }

  /**
   * Set or update the model used for cost calculation.
   *
   * @param model - Model identifier (e.g., 'x-ai/grok-4.1-fast')
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Get current model identifier.
   *
   * @returns Model identifier or undefined if not set
   */
  getModel(): string | undefined {
    return this.model;
  }
}

/**
 * Simplified pricing table for common models (USD per 1M tokens)
 * This is a subset for quick estimation. Full pricing is in @duyetbot/providers.
 */
interface SimplifiedPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cachedPerMillion?: number;
}

/** Default pricing for unknown models (conservative estimate) */
const DEFAULT_PRICING: SimplifiedPricing = {
  inputPerMillion: 1.0,
  outputPerMillion: 3.0,
};

function getSimplifiedPricing(model: string): SimplifiedPricing {
  // Common models for quick estimation
  const pricingTable: Record<string, SimplifiedPricing> = {
    // xAI
    'x-ai/grok-4.1-fast': { inputPerMillion: 0.2, outputPerMillion: 0.6 },
    'x-ai/grok-4.1': { inputPerMillion: 3.0, outputPerMillion: 9.0 },
    // Anthropic
    'anthropic/claude-3.5-sonnet': {
      inputPerMillion: 3.0,
      outputPerMillion: 15.0,
      cachedPerMillion: 0.3,
    },
    'anthropic/claude-3.5-haiku': {
      inputPerMillion: 0.8,
      outputPerMillion: 4.0,
      cachedPerMillion: 0.08,
    },
    // OpenAI
    'openai/gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10.0 },
    'openai/gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  };

  // Try exact match first
  if (pricingTable[model]) {
    return pricingTable[model];
  }

  // Try partial match (e.g., 'grok-4.1-fast' matches 'x-ai/grok-4.1-fast')
  for (const [key, pricing] of Object.entries(pricingTable)) {
    if (model.includes(key.split('/')[1] ?? '')) {
      return pricing;
    }
  }

  // Return default pricing for unknown models
  return DEFAULT_PRICING;
}
