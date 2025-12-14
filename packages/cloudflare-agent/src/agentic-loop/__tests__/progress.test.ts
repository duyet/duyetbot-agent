/**
 * Tests for ProgressTracker
 *
 * Tests the real-time progress tracking system for agent execution.
 * Covers progress updates, formatting, summary statistics, and callback integration.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgressTracker, PROGRESS_MESSAGES, ProgressTracker } from '../progress.js';
import type { ToolResult } from '../types.js';

describe('PROGRESS_MESSAGES', () => {
  describe('thinking', () => {
    it('should return thinking message with random rotator', () => {
      // Verify behavior: thinking() returns ⏺ prefix with one of the rotator messages
      expect(PROGRESS_MESSAGES.thinking()).toMatch(/^⏺ \w+$/);
      // Call multiple times - should always match the pattern (random variety)
      for (let i = 0; i < 5; i++) {
        expect(PROGRESS_MESSAGES.thinking()).toMatch(/^⏺ \w+$/);
      }
    });
  });

  describe('tool_start', () => {
    it('should format tool start message', () => {
      expect(PROGRESS_MESSAGES.tool_start('search')).toBe('🔧 Running search...');
      expect(PROGRESS_MESSAGES.tool_start('github_api')).toBe('🔧 Running github_api...');
    });
  });

  describe('tool_complete', () => {
    it('should format tool complete message with duration', () => {
      expect(PROGRESS_MESSAGES.tool_complete('search', 123)).toBe('✅ search completed (123ms)');
      expect(PROGRESS_MESSAGES.tool_complete('fetch', 0)).toBe('✅ fetch completed (0ms)');
    });
  });

  describe('tool_error', () => {
    it('should format tool error message', () => {
      expect(PROGRESS_MESSAGES.tool_error('search', 'Connection failed')).toBe(
        '❌ search failed: Connection failed'
      );
    });

    it('should truncate long error messages to 50 chars', () => {
      const longError =
        'This is a very long error message that exceeds fifty characters and should be truncated';
      const result = PROGRESS_MESSAGES.tool_error('test', longError);
      expect(result.length).toBeLessThanOrEqual(100); // tool name + prefix + 50 chars
      expect(result).toContain('This is a very long error message that exceeds fi');
    });
  });

  describe('responding', () => {
    it('should return responding message', () => {
      expect(PROGRESS_MESSAGES.responding()).toBe('📝 Generating response...');
    });
  });
});

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;

  beforeEach(() => {
    tracker = new ProgressTracker();
  });

  describe('constructor', () => {
    it('should create tracker with default options', () => {
      const tracker = new ProgressTracker();
      expect(tracker.getAll()).toEqual([]);
    });

    it('should create tracker with custom maxDisplayedUpdates', () => {
      const tracker = new ProgressTracker({ maxDisplayedUpdates: 3 });
      // Add 5 updates
      tracker.thinking(1);
      tracker.thinking(2);
      tracker.thinking(3);
      tracker.thinking(4);
      tracker.thinking(5);

      // Format should only show last 3
      const formatted = tracker.format();
      const lines = formatted.split('\n');
      expect(lines.length).toBe(3);
    });
  });

  describe('thinking', () => {
    it('should record thinking step', async () => {
      await tracker.thinking(1);

      const updates = tracker.getAll();
      expect(updates.length).toBe(1);
      expect(updates[0].type).toBe('thinking');
      // Verify behavior: message uses ⏺ prefix with rotator text (no step number)
      expect(updates[0].message).toMatch(/^⏺ \w+$/);
      expect(updates[0].iteration).toBe(1);
      expect(updates[0].timestamp).toBeGreaterThan(0);
    });

    it('should track multiple thinking steps', async () => {
      await tracker.thinking(1);
      await tracker.thinking(2);
      await tracker.thinking(3);

      const updates = tracker.getAll();
      expect(updates.length).toBe(3);
      expect(updates.map((u) => u.iteration)).toEqual([1, 2, 3]);
    });
  });

  describe('toolStart', () => {
    it('should record tool start', async () => {
      await tracker.toolStart('search', 1);

      const updates = tracker.getAll();
      expect(updates.length).toBe(1);
      expect(updates[0].type).toBe('tool_start');
      expect(updates[0].toolName).toBe('search');
      expect(updates[0].message).toBe('🔧 Running search...');
    });
  });

  describe('toolComplete', () => {
    it('should record successful tool completion', async () => {
      const result: ToolResult = {
        success: true,
        output: 'Found results',
        durationMs: 234,
      };

      await tracker.toolComplete('search', result, 1);

      const updates = tracker.getAll();
      expect(updates.length).toBe(1);
      expect(updates[0].type).toBe('tool_complete');
      expect(updates[0].toolName).toBe('search');
      expect(updates[0].durationMs).toBe(234);
      expect(updates[0].message).toBe('✅ search completed (234ms)');
    });

    it('should record failed tool execution', async () => {
      const result: ToolResult = {
        success: false,
        output: '',
        error: 'Network timeout',
        durationMs: 5000,
      };

      await tracker.toolComplete('fetch', result, 1);

      const updates = tracker.getAll();
      expect(updates.length).toBe(1);
      expect(updates[0].type).toBe('tool_error');
      expect(updates[0].toolName).toBe('fetch');
      expect(updates[0].message).toBe('❌ fetch failed: Network timeout');
    });

    it('should handle missing error message', async () => {
      const result: ToolResult = {
        success: false,
        output: '',
        durationMs: 100,
      };

      await tracker.toolComplete('broken', result, 1);

      const updates = tracker.getAll();
      expect(updates[0].message).toContain('Unknown error');
    });
  });

  describe('responding', () => {
    it('should record responding step', async () => {
      await tracker.responding(3);

      const updates = tracker.getAll();
      expect(updates.length).toBe(1);
      expect(updates[0].type).toBe('responding');
      expect(updates[0].message).toBe('📝 Generating response...');
    });
  });

  describe('format', () => {
    it('should format updates as newline-separated messages', async () => {
      await tracker.thinking(1);
      await tracker.toolStart('search', 1);

      const formatted = tracker.format();
      const lines = formatted.split('\n');
      expect(lines.length).toBe(2);
      // First line should be thinking message with ⏺ prefix
      expect(lines[0]).toMatch(/^⏺ \w+$/);
      // Second line should be tool start message
      expect(lines[1]).toBe('🔧 Running search...');
    });

    it('should respect maxDisplayedUpdates limit', async () => {
      const tracker = new ProgressTracker({ maxDisplayedUpdates: 2 });

      await tracker.thinking(1);
      await tracker.toolStart('search', 1);
      await tracker.toolComplete('search', { success: true, output: '', durationMs: 100 }, 1);
      await tracker.thinking(2);

      const formatted = tracker.format();
      const lines = formatted.split('\n');
      expect(lines.length).toBe(2);
      // Should show last 2 updates
      expect(lines[0]).toBe('✅ search completed (100ms)');
      // Second line should be thinking message with ⏺ prefix
      expect(lines[1]).toMatch(/^⏺ \w+$/);
    });

    it('should return empty string when no updates', () => {
      expect(tracker.format()).toBe('');
    });
  });

  describe('getAll', () => {
    it('should return copy of all updates', async () => {
      await tracker.thinking(1);
      await tracker.toolStart('test', 1);

      const updates = tracker.getAll();
      expect(updates.length).toBe(2);

      // Should be a copy
      updates.push({} as any);
      expect(tracker.getAll().length).toBe(2);
    });
  });

  describe('getSummary', () => {
    it('should return summary statistics', async () => {
      await tracker.thinking(1);
      await tracker.toolStart('search', 1);
      await tracker.toolComplete('search', { success: true, output: '', durationMs: 100 }, 1);
      await tracker.thinking(2);
      await tracker.toolStart('fetch', 2);
      await tracker.toolComplete('fetch', { success: false, output: '', durationMs: 200 }, 2);
      await tracker.responding(2);

      const summary = tracker.getSummary();
      expect(summary.totalUpdates).toBe(7);
      expect(summary.iterations).toBe(2);
      expect(summary.toolsExecuted).toBe(2); // tool_complete + tool_error
      expect(summary.totalToolDurationMs).toBe(300); // 100 + 200
    });

    it('should return zeros for empty tracker', () => {
      const summary = tracker.getSummary();
      expect(summary.totalUpdates).toBe(0);
      expect(summary.iterations).toBe(0);
      expect(summary.toolsExecuted).toBe(0);
      expect(summary.totalToolDurationMs).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear all updates', async () => {
      await tracker.thinking(1);
      await tracker.toolStart('test', 1);

      tracker.reset();

      expect(tracker.getAll()).toEqual([]);
      expect(tracker.format()).toBe('');
    });
  });

  describe('onUpdate callback', () => {
    it('should call onUpdate with formatted updates', async () => {
      const onUpdate = vi.fn();
      const tracker = new ProgressTracker({ onUpdate });

      await tracker.thinking(1);

      expect(onUpdate).toHaveBeenCalledTimes(1);
      // Verify behavior: onUpdate receives formatted thinking message with ⏺ prefix
      expect(onUpdate).toHaveBeenCalledWith(expect.stringMatching(/^⏺ \w+$/));
    });

    it('should call onUpdate with accumulated updates', async () => {
      const onUpdate = vi.fn();
      const tracker = new ProgressTracker({ onUpdate, maxDisplayedUpdates: 5 });

      await tracker.thinking(1);
      await tracker.toolStart('search', 1);

      expect(onUpdate).toHaveBeenCalledTimes(2);
      // Verify behavior: last call includes thinking message + tool start
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
      expect(lastCall).toMatch(/^⏺ \w+\n🔧 Running search\.\.\.$/);
    });

    it('should handle async onUpdate callback', async () => {
      const callOrder: string[] = [];
      const onUpdate = vi.fn(async (formatted: string) => {
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push(formatted);
      });

      const tracker = new ProgressTracker({ onUpdate });

      await tracker.thinking(1);
      await tracker.thinking(2);

      expect(callOrder.length).toBe(2);
    });
  });
});

describe('createProgressTracker', () => {
  it('should create tracker with edit callback', async () => {
    const editMessage = vi.fn();

    const tracker = createProgressTracker(editMessage);
    await tracker.thinking(1);

    // Verify behavior: tracker calls editMessage with ⏺ prefix and one of the rotator messages
    expect(editMessage).toHaveBeenCalledWith(expect.stringMatching(/^⏺ \w+$/));
  });

  it('should pass through options', async () => {
    const editMessage = vi.fn();

    const tracker = createProgressTracker(editMessage, { maxDisplayedUpdates: 2 });

    await tracker.thinking(1);
    await tracker.thinking(2);
    await tracker.thinking(3);

    // Last call should only show 2 updates
    const lastCall = editMessage.mock.calls[editMessage.mock.calls.length - 1][0];
    expect(lastCall.split('\n').length).toBe(2);
  });
});

describe('Integration: Full execution flow', () => {
  it('should track complete agentic loop execution', async () => {
    const editSpy = vi.fn();
    const tracker = createProgressTracker(editSpy);

    // Simulate agentic loop execution
    await tracker.thinking(1);
    await tracker.toolStart('search', 1);
    await tracker.toolComplete('search', { success: true, output: '', durationMs: 150 }, 1);

    await tracker.thinking(2);
    await tracker.toolStart('analyze', 2);
    await tracker.toolComplete('analyze', { success: true, output: '', durationMs: 200 }, 2);

    await tracker.responding(2);

    // Verify final state
    const summary = tracker.getSummary();
    expect(summary.totalUpdates).toBe(7);
    expect(summary.iterations).toBe(2);
    expect(summary.toolsExecuted).toBe(2);
    expect(summary.totalToolDurationMs).toBe(350);

    // Verify editSpy was called for each update
    expect(editSpy).toHaveBeenCalledTimes(7);
  });

  it('should handle mixed success and failure', async () => {
    const tracker = new ProgressTracker();

    await tracker.thinking(1);
    await tracker.toolStart('api_call', 1);
    await tracker.toolComplete(
      'api_call',
      { success: false, output: '', error: 'Rate limited', durationMs: 50 },
      1
    );
    await tracker.thinking(2);
    await tracker.toolStart('api_call', 2);
    await tracker.toolComplete('api_call', { success: true, output: '', durationMs: 100 }, 2);

    const updates = tracker.getAll();
    expect(updates.filter((u) => u.type === 'tool_error').length).toBe(1);
    expect(updates.filter((u) => u.type === 'tool_complete').length).toBe(1);
  });
});
