import type { TokenUsage } from '@duyetbot/observability';
import { estimateCost, formatCost } from '@duyetbot/providers';

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
   * @returns Estimated cost in USD (returns 0 if model not set)
   */
  getCostUsd(): number {
    if (!this.model) {
      return 0;
    }

    return estimateCost(this.model, {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      cachedTokens: this.cachedTokens,
    });
  }

  /**
   * Get formatted cost string for display.
   *
   * @returns Formatted cost (e.g., '$0.0042', '<$0.0001')
   */
  getFormattedCost(): string {
    return formatCost(this.getCostUsd());
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
