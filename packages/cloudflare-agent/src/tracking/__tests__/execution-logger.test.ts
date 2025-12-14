import { describe, expect, it, vi } from 'vitest';
import type { ExecutionLog } from '../execution-logger.js';
import { ExecutionLogger } from '../execution-logger.js';

describe('ExecutionLogger', () => {
  const mockContext = {
    platform: 'telegram',
    userId: '12345',
    chatId: '67890',
    model: 'x-ai/grok-4.1-fast',
  };

  describe('log levels', () => {
    it('should log debug step', () => {
      const onLog = vi.fn();
      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
        onLog,
      });

      logger.debug({ type: 'preparing', timestamp: Date.now() });

      expect(onLog).toHaveBeenCalledTimes(1);
      const log = onLog.mock.calls[0]?.[0] as ExecutionLog;
      expect(log.level).toBe('debug');
      expect(log.step.type).toBe('preparing');
    });

    it('should log info step', () => {
      const onLog = vi.fn();
      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
        onLog,
      });

      logger.info({ type: 'thinking', timestamp: Date.now(), thinking: 'Analyzing...' });

      expect(onLog).toHaveBeenCalledTimes(1);
      const log = onLog.mock.calls[0]?.[0] as ExecutionLog;
      expect(log.level).toBe('info');
      expect(log.step.type).toBe('thinking');
    });

    it('should log warn step', () => {
      const onLog = vi.fn();
      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
        onLog,
      });

      logger.warn({
        type: 'tool_error',
        timestamp: Date.now(),
        toolName: 'search',
        error: 'Timeout',
      });

      expect(onLog).toHaveBeenCalledTimes(1);
      const log = onLog.mock.calls[0]?.[0] as ExecutionLog;
      expect(log.level).toBe('warn');
      expect(log.step.type).toBe('tool_error');
    });

    it('should log error step', () => {
      const onLog = vi.fn();
      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
        onLog,
      });

      logger.error({
        type: 'tool_error',
        timestamp: Date.now(),
        toolName: 'git',
        error: 'Command failed',
      });

      expect(onLog).toHaveBeenCalledTimes(1);
      const log = onLog.mock.calls[0]?.[0] as ExecutionLog;
      expect(log.level).toBe('error');
      expect(log.step.type).toBe('tool_error');
    });
  });

  describe('log structure', () => {
    it('should include trace and event IDs', () => {
      const onLog = vi.fn();
      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
        onLog,
      });

      logger.info({ type: 'preparing', timestamp: Date.now() });

      const log = onLog.mock.calls[0]?.[0] as ExecutionLog;
      expect(log.traceId).toBe('trace-123');
      expect(log.eventId).toBe('event-456');
    });

    it('should include execution context', () => {
      const onLog = vi.fn();
      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
        onLog,
      });

      logger.info({ type: 'preparing', timestamp: Date.now() });

      const log = onLog.mock.calls[0]?.[0] as ExecutionLog;
      expect(log.context).toEqual(mockContext);
    });

    it('should include timestamp', () => {
      const onLog = vi.fn();
      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
        onLog,
      });

      const before = Date.now();
      logger.info({ type: 'preparing', timestamp: before });
      const after = Date.now();

      const log = onLog.mock.calls[0]?.[0] as ExecutionLog;
      expect(log.timestamp).toBeGreaterThanOrEqual(before);
      expect(log.timestamp).toBeLessThanOrEqual(after);
    });

    it('should preserve step details', () => {
      const onLog = vi.fn();
      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
        onLog,
      });

      const step = {
        type: 'tool_start' as const,
        timestamp: Date.now(),
        toolName: 'search',
        args: { query: 'test' },
      };

      logger.info(step);

      const log = onLog.mock.calls[0]?.[0] as ExecutionLog;
      expect(log.step).toEqual(step);
    });
  });

  describe('updateContext', () => {
    it('should update context fields', () => {
      const onLog = vi.fn();
      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
        onLog,
      });

      logger.updateContext({ model: 'anthropic/claude-3.5-sonnet' });

      logger.info({ type: 'preparing', timestamp: Date.now() });

      const log = onLog.mock.calls[0]?.[0] as ExecutionLog;
      expect(log.context.model).toBe('anthropic/claude-3.5-sonnet');
      expect(log.context.platform).toBe('telegram');
    });

    it('should add token usage', () => {
      const onLog = vi.fn();
      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
        onLog,
      });

      logger.updateContext({
        tokenUsage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
        },
      });

      logger.info({ type: 'preparing', timestamp: Date.now() });

      const log = onLog.mock.calls[0]?.[0] as ExecutionLog;
      expect(log.context.tokenUsage).toEqual({
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });
    });
  });

  describe('getters', () => {
    it('should get trace ID', () => {
      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
      });

      expect(logger.getTraceId()).toBe('trace-123');
    });

    it('should get event ID', () => {
      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
      });

      expect(logger.getEventId()).toBe('event-456');
    });

    it('should get context (as copy)', () => {
      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
      });

      const context = logger.getContext();
      expect(context).toEqual(mockContext);

      // Verify it's a copy
      context.platform = 'github';
      expect(logger.getContext().platform).toBe('telegram');
    });
  });

  describe('default console logging', () => {
    it('should use console when no onLog provided', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
      });

      logger.info({ type: 'preparing', timestamp: Date.now() });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0]?.[0]).toContain('[INFO]');
      expect(consoleSpy.mock.calls[0]?.[0]).toContain('[telegram:67890]');

      consoleSpy.mockRestore();
    });

    it('should format tool_start steps', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
      });

      logger.debug({
        type: 'tool_start',
        timestamp: Date.now(),
        toolName: 'search',
        args: { query: 'test' },
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0]?.[1]).toContain('search');

      consoleSpy.mockRestore();
    });

    it('should format routing steps', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const logger = new ExecutionLogger({
        traceId: 'trace-123',
        eventId: 'event-456',
        context: mockContext,
      });

      logger.info({
        type: 'routing',
        timestamp: Date.now(),
        agentName: 'simple-agent',
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0]?.[1]).toContain('simple-agent');

      consoleSpy.mockRestore();
    });
  });
});
