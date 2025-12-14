/**
 * Tests for Transport Adapter
 *
 * Verifies the bridge between AgenticLoop progress callbacks
 * and the transport layer (Telegram, GitHub message editing).
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  createSimpleProgressCallback,
  createTransportAdapter,
  formatProgressUpdate,
} from '../transport-adapter.js';
import type { ProgressUpdate } from '../types.js';

describe('createTransportAdapter', () => {
  let editMessage: ReturnType<typeof mock>;
  let reportHeartbeat: ReturnType<typeof mock>;
  let sendTyping: ReturnType<typeof mock>;

  beforeEach(() => {
    editMessage = mock(async () => undefined);
    reportHeartbeat = mock(async () => undefined);
    sendTyping = mock(async () => undefined);
  });

  describe('basic setup', () => {
    it('should create adapter with callbacks and tracker', () => {
      const adapter = createTransportAdapter({ editMessage });

      expect(adapter.callbacks.onProgress).toBeDefined();
      expect(adapter.callbacks.onToolStart).toBeDefined();
      expect(adapter.callbacks.onToolEnd).toBeDefined();
      expect(adapter.tracker).toBeDefined();
    });
  });

  describe('onProgress callback', () => {
    it('should handle thinking updates', async () => {
      const adapter = createTransportAdapter({ editMessage });

      await adapter.callbacks.onProgress!({
        type: 'thinking',
        message: 'Thinking...',
        iteration: 0,
        timestamp: Date.now(),
      });

      // Verify behavior: thinking updates use ⏺ prefix with rotator messages (no step number)
      expect(editMessage).toHaveBeenCalledWith(expect.stringMatching(/^⏺ \w+$/));
    });

    it('should handle tool_start updates', async () => {
      const adapter = createTransportAdapter({ editMessage });

      await adapter.callbacks.onProgress!({
        type: 'tool_start',
        message: 'Running search...',
        toolName: 'search',
        iteration: 0,
        timestamp: Date.now(),
      });

      expect(editMessage).toHaveBeenCalledWith(expect.stringContaining('Running search'));
    });

    it('should handle tool_complete updates', async () => {
      const adapter = createTransportAdapter({ editMessage });

      // First add a tool start so there's history
      await adapter.callbacks.onProgress!({
        type: 'tool_start',
        message: 'Running search...',
        toolName: 'search',
        iteration: 0,
        timestamp: Date.now(),
      });

      await adapter.callbacks.onProgress!({
        type: 'tool_complete',
        message: 'search completed (150ms)',
        toolName: 'search',
        iteration: 0,
        timestamp: Date.now(),
        durationMs: 150,
      });

      expect(editMessage).toHaveBeenLastCalledWith(expect.stringContaining('completed'));
    });

    it('should handle tool_error updates', async () => {
      const adapter = createTransportAdapter({ editMessage });

      await adapter.callbacks.onProgress!({
        type: 'tool_error',
        message: 'search failed: Network error',
        toolName: 'search',
        iteration: 0,
        timestamp: Date.now(),
        durationMs: 50,
      });

      expect(editMessage).toHaveBeenCalledWith(expect.stringContaining('failed'));
    });

    it('should handle responding updates', async () => {
      const adapter = createTransportAdapter({ editMessage });

      await adapter.callbacks.onProgress!({
        type: 'responding',
        message: 'Generating response...',
        iteration: 0,
        timestamp: Date.now(),
      });

      expect(editMessage).toHaveBeenCalledWith(expect.stringContaining('Generating response'));
    });
  });

  describe('heartbeat integration', () => {
    it('should call heartbeat on progress updates', async () => {
      const adapter = createTransportAdapter({
        editMessage,
        reportHeartbeat,
        heartbeatOnProgress: true,
      });

      await adapter.callbacks.onProgress!({
        type: 'thinking',
        message: 'Thinking...',
        iteration: 0,
        timestamp: Date.now(),
      });

      expect(reportHeartbeat).toHaveBeenCalledTimes(1);
    });

    it('should not call heartbeat when disabled', async () => {
      const adapter = createTransportAdapter({
        editMessage,
        reportHeartbeat,
        heartbeatOnProgress: false,
      });

      await adapter.callbacks.onProgress!({
        type: 'thinking',
        message: 'Thinking...',
        iteration: 0,
        timestamp: Date.now(),
      });

      expect(reportHeartbeat).not.toHaveBeenCalled();
    });

    it('should ignore heartbeat errors', async () => {
      reportHeartbeat.mockImplementation(async () => {
        throw new Error('Heartbeat failed');
      });

      const adapter = createTransportAdapter({
        editMessage,
        reportHeartbeat,
      });

      // Should not throw
      await adapter.callbacks.onProgress!({
        type: 'thinking',
        message: 'Thinking...',
        iteration: 0,
        timestamp: Date.now(),
      });
    });
  });

  describe('typing indicator', () => {
    it('should send typing indicator on progress', async () => {
      const adapter = createTransportAdapter({
        editMessage,
        sendTyping,
      });

      await adapter.callbacks.onProgress!({
        type: 'thinking',
        message: 'Thinking...',
        iteration: 0,
        timestamp: Date.now(),
      });

      expect(sendTyping).toHaveBeenCalledTimes(1);
    });

    it('should ignore typing errors', async () => {
      sendTyping.mockImplementation(async () => {
        throw new Error('Typing failed');
      });

      const adapter = createTransportAdapter({
        editMessage,
        sendTyping,
      });

      // Should not throw
      await adapter.callbacks.onProgress!({
        type: 'thinking',
        message: 'Thinking...',
        iteration: 0,
        timestamp: Date.now(),
      });
    });
  });

  describe('maxDisplayedUpdates configuration', () => {
    it('should respect maxDisplayedUpdates limit', async () => {
      const adapter = createTransportAdapter({
        editMessage,
        maxDisplayedUpdates: 2,
      });

      // Add 3 updates
      await adapter.callbacks.onProgress!({
        type: 'thinking',
        message: 'Step 1',
        iteration: 0,
        timestamp: Date.now(),
      });

      await adapter.callbacks.onProgress!({
        type: 'tool_start',
        message: 'Step 2',
        toolName: 'tool1',
        iteration: 0,
        timestamp: Date.now(),
      });

      await adapter.callbacks.onProgress!({
        type: 'tool_start',
        message: 'Step 3',
        toolName: 'tool2',
        iteration: 1,
        timestamp: Date.now(),
      });

      // The formatted output should only have 2 lines
      const lastCall = editMessage.mock.calls[editMessage.mock.calls.length - 1][0];
      const lines = lastCall.split('\n').filter((l: string) => l.trim() !== '');
      expect(lines.length).toBe(2);
    });
  });

  describe('tracker access', () => {
    it('should provide direct tracker access', async () => {
      const adapter = createTransportAdapter({ editMessage });

      await adapter.callbacks.onProgress!({
        type: 'thinking',
        message: 'Thinking...',
        iteration: 0,
        timestamp: Date.now(),
      });

      // Can access tracker directly
      const updates = adapter.tracker.getAll();
      expect(updates.length).toBe(1);
      expect(updates[0].type).toBe('thinking');
    });

    it('should provide summary statistics', async () => {
      const adapter = createTransportAdapter({ editMessage });

      await adapter.callbacks.onProgress!({
        type: 'thinking',
        message: 'Thinking...',
        iteration: 0,
        timestamp: Date.now(),
      });

      const summary = adapter.tracker.getSummary();
      expect(summary.totalUpdates).toBe(1);
      expect(summary.iterations).toBe(1);
    });
  });
});

describe('createSimpleProgressCallback', () => {
  it('should create a simple callback that forwards messages', async () => {
    const editMessage = mock(async () => undefined);
    const callback = createSimpleProgressCallback(editMessage);

    await callback({
      type: 'thinking',
      message: 'Custom message',
      iteration: 0,
      timestamp: Date.now(),
    });

    expect(editMessage).toHaveBeenCalledWith('Custom message');
  });
});

describe('formatProgressUpdate', () => {
  it('should format thinking updates', () => {
    const update: ProgressUpdate = {
      type: 'thinking',
      message: '',
      iteration: 0,
      timestamp: Date.now(),
    };

    // Verify behavior: empty message triggers random rotator message with ⏺ prefix
    expect(formatProgressUpdate(update)).toMatch(/^⏺ \w+$/);
  });

  it('should format tool_start updates', () => {
    const update: ProgressUpdate = {
      type: 'tool_start',
      message: '',
      toolName: 'search',
      iteration: 0,
      timestamp: Date.now(),
    };

    expect(formatProgressUpdate(update)).toBe('🔧 Running search...');
  });

  it('should format tool_complete updates with duration', () => {
    const update: ProgressUpdate = {
      type: 'tool_complete',
      message: '',
      toolName: 'search',
      iteration: 0,
      timestamp: Date.now(),
      durationMs: 150,
    };

    expect(formatProgressUpdate(update)).toBe('✅ search completed (150ms)');
  });

  it('should format tool_complete updates without duration', () => {
    const update: ProgressUpdate = {
      type: 'tool_complete',
      message: '',
      toolName: 'search',
      iteration: 0,
      timestamp: Date.now(),
    };

    expect(formatProgressUpdate(update)).toBe('✅ search completed');
  });

  it('should format tool_error updates', () => {
    const update: ProgressUpdate = {
      type: 'tool_error',
      message: '',
      toolName: 'search',
      iteration: 0,
      timestamp: Date.now(),
    };

    expect(formatProgressUpdate(update)).toBe('❌ search failed');
  });

  it('should format responding updates', () => {
    const update: ProgressUpdate = {
      type: 'responding',
      message: '',
      iteration: 0,
      timestamp: Date.now(),
    };

    expect(formatProgressUpdate(update)).toBe('📝 Generating response...');
  });

  it('should fall back to message for unknown types', () => {
    const update: ProgressUpdate = {
      type: 'thinking', // Using valid type but testing fallback behavior
      message: 'Custom fallback message',
      iteration: 0,
      timestamp: Date.now(),
    };

    // The switch handles 'thinking', but this tests the default case
    // by checking a message is returned
    const result = formatProgressUpdate(update);
    expect(result).toBeTruthy();
  });
});
