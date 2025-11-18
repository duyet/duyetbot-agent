import { SleepTool } from '@/tools/sleep';
import type { ToolInput } from '@/tools/types';
import { beforeEach, describe, expect, it } from 'vitest';

describe('SleepTool', () => {
  let sleepTool: SleepTool;

  beforeEach(() => {
    sleepTool = new SleepTool();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(sleepTool.name).toBe('sleep');
    });

    it('should have description', () => {
      expect(sleepTool.description).toBeDefined();
      expect(sleepTool.description.length).toBeGreaterThan(0);
    });

    it('should have input schema', () => {
      expect(sleepTool.inputSchema).toBeDefined();
    });
  });

  describe('validation', () => {
    it('should validate correct input with duration in milliseconds', () => {
      const input: ToolInput = {
        content: { duration: 1000 },
      };

      const result = sleepTool.validate?.(input);
      expect(result).toBe(true);
    });

    it('should validate input with duration in seconds', () => {
      const input: ToolInput = {
        content: { duration: 5, unit: 'seconds' },
      };

      const result = sleepTool.validate?.(input);
      expect(result).toBe(true);
    });

    it('should reject negative duration', () => {
      const input: ToolInput = {
        content: { duration: -1000 },
      };

      const result = sleepTool.validate?.(input);
      expect(result).toBe(false);
    });

    it('should reject zero duration', () => {
      const input: ToolInput = {
        content: { duration: 0 },
      };

      const result = sleepTool.validate?.(input);
      expect(result).toBe(false);
    });

    it('should reject non-number duration', () => {
      const input: ToolInput = {
        content: { duration: 'invalid' },
      };

      const result = sleepTool.validate?.(input);
      expect(result).toBe(false);
    });
  });

  describe('execution', () => {
    it('should sleep for specified duration in milliseconds', async () => {
      const startTime = Date.now();
      const duration = 100;

      const result = await sleepTool.execute({
        content: { duration },
      });

      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      expect(result.status).toBe('success');
      expect(actualDuration).toBeGreaterThanOrEqual(duration);
      expect(actualDuration).toBeLessThan(duration + 50); // Allow 50ms tolerance
    });

    it('should convert seconds to milliseconds', async () => {
      const startTime = Date.now();

      const result = await sleepTool.execute({
        content: { duration: 0.1, unit: 'seconds' }, // 100ms
      });

      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      expect(result.status).toBe('success');
      expect(actualDuration).toBeGreaterThanOrEqual(100);
    });

    it('should return success status with metadata', async () => {
      const result = await sleepTool.execute({
        content: { duration: 10 },
      });

      expect(result.status).toBe('success');
      expect(result.content).toContain('Slept');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.duration).toBe(10);
    });

    it('should handle very short durations', async () => {
      const result = await sleepTool.execute({
        content: { duration: 1 },
      });

      expect(result.status).toBe('success');
    });

    it('should support cancellation via AbortSignal', async () => {
      const controller = new AbortController();

      // Start sleep and cancel after 50ms
      const sleepPromise = sleepTool.execute({
        content: { duration: 1000 },
        metadata: { signal: controller.signal },
      });

      setTimeout(() => controller.abort(), 50);

      const result = await sleepPromise;

      expect(result.status).toBe('cancelled');
      expect(result.error?.code).toBe('ABORTED');
    });

    it('should include start and end timestamps in metadata', async () => {
      const result = await sleepTool.execute({
        content: { duration: 10 },
      });

      expect(result.metadata?.startTime).toBeDefined();
      expect(result.metadata?.endTime).toBeDefined();
      expect(result.metadata?.endTime).toBeGreaterThan(result.metadata?.startTime as number);
    });
  });

  describe('error handling', () => {
    it('should return error for missing duration', async () => {
      const result = await sleepTool.execute({
        content: {},
      });

      expect(result.status).toBe('error');
      expect(result.error?.message).toContain('duration');
    });

    it('should return error for invalid input type', async () => {
      const result = await sleepTool.execute({
        content: 'invalid',
      });

      expect(result.status).toBe('error');
    });

    it('should respect maximum duration limit', async () => {
      const result = await sleepTool.execute({
        content: { duration: 1000000 }, // Very long duration
      });

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('DURATION_TOO_LONG');
    });
  });

  describe('integration', () => {
    it('should work with string content', async () => {
      const result = await sleepTool.execute({
        content: '50', // 50ms as string
      });

      expect(result.status).toBe('success');
    });

    it('should support reason in metadata', async () => {
      const result = await sleepTool.execute({
        content: { duration: 10 },
        metadata: { reason: 'Rate limiting' },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.reason).toBe('Rate limiting');
    });
  });
});
