import type { TokenUsage } from '../types.js';

export class TokenTracker {
  private usage: TokenUsage = { input: 0, output: 0, total: 0 };
  private model: string | undefined = undefined;

  /**
   * Add usage (accumulates with existing).
   */
  addUsage(usage: Partial<TokenUsage>): void {
    this.usage.input += usage.input || 0;
    this.usage.output += usage.output || 0;
    this.usage.total += usage.total || 0;

    if (usage.cached !== undefined) {
      this.usage.cached = (this.usage.cached || 0) + usage.cached;
    }

    if (usage.reasoning !== undefined) {
      this.usage.reasoning = (this.usage.reasoning || 0) + usage.reasoning;
    }

    if (usage.costUsd !== undefined) {
      this.usage.costUsd = (this.usage.costUsd || 0) + usage.costUsd;
    }
  }

  /**
   * Set model identifier.
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Get aggregated usage.
   */
  getUsage(): TokenUsage {
    return { ...this.usage };
  }

  /**
   * Get model.
   */
  getModel(): string | undefined {
    return this.model;
  }

  /**
   * Reset all tracking.
   */
  reset(): void {
    // Reset to initial state without optional properties
    const resetUsage: TokenUsage = { input: 0, output: 0, total: 0 };
    this.usage = resetUsage;
    this.model = undefined;
  }
}
