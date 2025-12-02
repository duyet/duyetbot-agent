import { beforeEach, describe, expect, it } from 'vitest';
import { SleepTool, sleepTool } from '../sleep.js';

describe('SleepTool', () => {
  let tool: SleepTool;

  beforeEach(() => {
    tool = new SleepTool();
  });

  describe('properties', () => {
    it('should have name "sleep"', () => {
      expect(tool.name).toBe('sleep');
    });

    it('should have a description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(0);
    });

    it('should have an input schema', () => {
      expect(tool.inputSchema).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should validate positive duration', () => {
      expect(tool.validate({ content: { duration: 100 } })).toBe(true);
    });

    it('should validate duration object', () => {
      expect(tool.validate({ content: { duration: 100 } })).toBe(true);
    });

    it('should validate duration with unit', () => {
      expect(tool.validate({ content: { duration: 1, unit: 'seconds' } })).toBe(true);
    });

    it('should reject negative duration', () => {
      expect(tool.validate({ content: { duration: -100 } })).toBe(false);
    });

    it('should reject zero duration', () => {
      expect(tool.validate({ content: { duration: 0 } })).toBe(false);
    });

    it('should reject duration exceeding maximum', () => {
      // Max is 5 minutes = 300000ms
      expect(tool.validate({ content: { duration: 400000 } })).toBe(false);
    });

    it('should validate string number input', () => {
      expect(tool.validate({ content: '100' })).toBe(true);
    });
  });

  describe('execute', () => {
    it('should sleep for specified milliseconds', async () => {
      const start = Date.now();
      const result = await tool.execute({ content: { duration: 50 } });
      const elapsed = Date.now() - start;

      expect(result.status).toBe('success');
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
    });

    it('should sleep for specified seconds', async () => {
      const start = Date.now();
      const result = await tool.execute({
        content: { duration: 0.05, unit: 'seconds' },
      });
      const elapsed = Date.now() - start;

      expect(result.status).toBe('success');
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });

    it('should return success with metadata', async () => {
      const result = await tool.execute({ content: { duration: 10 } });

      expect(result.status).toBe('success');
      expect(result.content).toContain('10ms');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.duration).toBe(10);
      expect(result.metadata?.startTime).toBeDefined();
      expect(result.metadata?.endTime).toBeDefined();
      expect(result.metadata?.actualDuration).toBeDefined();
    });

    it('should return error for invalid input', async () => {
      const result = await tool.execute({ content: { duration: -100 } });

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return error for duration too long', async () => {
      const result = await tool.execute({ content: { duration: 10 * 60 * 1000 } }); // 10 minutes

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('DURATION_TOO_LONG');
    });

    it('should handle abort signal', async () => {
      const controller = new AbortController();

      // Abort after 20ms
      setTimeout(() => controller.abort(), 20);

      const result = await tool.execute({
        content: { duration: 1000 },
        metadata: { signal: controller.signal },
      });

      expect(result.status).toBe('cancelled');
      expect(result.error?.code).toBe('ABORTED');
    });

    it('should handle already aborted signal', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await tool.execute({
        content: { duration: 100 },
        metadata: { signal: controller.signal },
      });

      expect(result.status).toBe('cancelled');
      expect(result.error?.code).toBe('ABORTED');
    });

    it('should include reason in metadata when provided', async () => {
      const result = await tool.execute({
        content: { duration: 10 },
        metadata: { reason: 'Rate limiting' },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.reason).toBe('Rate limiting');
    });

    it('should convert string input to duration', async () => {
      const result = await tool.execute({ content: '50' });

      expect(result.status).toBe('success');
      expect(result.metadata?.duration).toBe(50);
    });

    it('should handle minutes unit', async () => {
      // Use a small fraction of a minute
      const result = await tool.execute({
        content: { duration: 0.001, unit: 'minutes' }, // 60ms
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.duration).toBe(60);
    });
  });
});

describe('sleepTool singleton', () => {
  it('should be an instance of SleepTool', () => {
    expect(sleepTool).toBeInstanceOf(SleepTool);
  });

  it('should have name "sleep"', () => {
    expect(sleepTool.name).toBe('sleep');
  });
});
