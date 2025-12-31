import { describe, expect, it } from 'vitest';
import { TokenTracker } from '../token-tracker.js';

describe('TokenTracker', () => {
  describe('add', () => {
    it('should accumulate token usage from multiple calls', () => {
      const tracker = new TokenTracker();

      tracker.add({ inputTokens: 1200, outputTokens: 400, totalTokens: 1600 });
      tracker.add({ inputTokens: 800, outputTokens: 200, totalTokens: 1000 });

      const total = tracker.getTotal();
      expect(total.inputTokens).toBe(2000);
      expect(total.outputTokens).toBe(600);
      expect(total.totalTokens).toBe(2600);
    });

    it('should handle optional cached and reasoning tokens', () => {
      const tracker = new TokenTracker();

      tracker.add({
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        cachedTokens: 200,
        reasoningTokens: 100,
      });

      tracker.add({
        inputTokens: 800,
        outputTokens: 300,
        totalTokens: 1100,
        cachedTokens: 150,
      });

      const total = tracker.getTotal();
      expect(total.inputTokens).toBe(1800);
      expect(total.outputTokens).toBe(800);
      expect(total.totalTokens).toBe(2600);
      expect(total.cachedTokens).toBe(350);
      expect(total.reasoningTokens).toBe(100);
    });

    it('should handle zero values', () => {
      const tracker = new TokenTracker();

      tracker.add({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });

      const total = tracker.getTotal();
      expect(total.inputTokens).toBe(0);
      expect(total.outputTokens).toBe(0);
      expect(total.totalTokens).toBe(0);
    });
  });

  describe('getCostUsd', () => {
    it('should calculate cost for known model', () => {
      const tracker = new TokenTracker('x-ai/grok-4.1-fast');

      tracker.add({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

      const cost = tracker.getCostUsd();
      // x-ai/grok-4.1-fast: $0.2/M input, $0.6/M output
      // (1000 * 0.2 + 500 * 0.6) / 1M = 0.0005
      expect(cost).toBeCloseTo(0.0005, 6);
    });

    it('should handle cached tokens with discount', () => {
      const tracker = new TokenTracker('anthropic/claude-3.5-sonnet');

      tracker.add({
        inputTokens: 2000,
        outputTokens: 1000,
        totalTokens: 3000,
        cachedTokens: 500,
      });

      const cost = tracker.getCostUsd();
      // claude-3.5-sonnet: $3/M input, $15/M output, $0.3/M cached
      // ((2000-500)*3 + 500*0.3 + 1000*15) / 1M = 0.01965
      expect(cost).toBeCloseTo(0.01965, 5);
    });

    it('should return 0 if model not set', () => {
      const tracker = new TokenTracker();

      tracker.add({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

      expect(tracker.getCostUsd()).toBe(0);
    });

    it('should use default pricing for unknown model', () => {
      const tracker = new TokenTracker('unknown/model');

      tracker.add({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

      const cost = tracker.getCostUsd();
      // Default: $1/M input, $3/M output
      // (1000 * 1 + 500 * 3) / 1M = 0.0025
      expect(cost).toBeCloseTo(0.0025, 6);
    });
  });

  describe('getFormattedCost', () => {
    it('should format cost with appropriate precision', () => {
      const tracker = new TokenTracker('x-ai/grok-4.1-fast');

      tracker.add({ inputTokens: 10000, outputTokens: 5000, totalTokens: 15000 });

      const formatted = tracker.getFormattedCost();
      expect(formatted).toBe('$0.0050');
    });

    it('should show <$0.0001 for very small costs', () => {
      const tracker = new TokenTracker('x-ai/grok-4.1-fast');

      tracker.add({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });

      const formatted = tracker.getFormattedCost();
      expect(formatted).toBe('<$0.0001');
    });

    it('should show $0 when no model set', () => {
      const tracker = new TokenTracker();

      tracker.add({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });

      expect(tracker.getFormattedCost()).toBe('$0');
    });
  });

  describe('reset', () => {
    it('should reset all counters to zero', () => {
      const tracker = new TokenTracker('x-ai/grok-4.1-fast');

      tracker.add({
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        cachedTokens: 200,
        reasoningTokens: 100,
      });

      tracker.reset();

      const total = tracker.getTotal();
      expect(total.inputTokens).toBe(0);
      expect(total.outputTokens).toBe(0);
      expect(total.totalTokens).toBe(0);
      expect(total.cachedTokens).toBeUndefined();
      expect(total.reasoningTokens).toBeUndefined();
    });
  });

  describe('setModel / getModel', () => {
    it('should set and get model', () => {
      const tracker = new TokenTracker();

      expect(tracker.getModel()).toBeUndefined();

      tracker.setModel('x-ai/grok-4.1-fast');

      expect(tracker.getModel()).toBe('x-ai/grok-4.1-fast');
    });

    it('should update cost calculation after setting model', () => {
      const tracker = new TokenTracker();

      tracker.add({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });
      expect(tracker.getCostUsd()).toBe(0);

      tracker.setModel('x-ai/grok-4.1-fast');
      expect(tracker.getCostUsd()).toBeCloseTo(0.0005, 6);
    });
  });
});
