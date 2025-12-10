/**
 * Callback Routing Tests
 *
 * Tests for Telegram inline keyboard callback handling, parsing, and action routing.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  type CallbackAction,
  type CallbackContext,
  callbackHandlers,
  getCallbackDataSize,
  isValidAction,
  parseCallbackData,
  serializeCallbackData,
} from '../callbacks/index.js';

// =============================================================================
// Parser Tests
// =============================================================================

describe('Callback Parser', () => {
  describe('parseCallbackData', () => {
    it('parses simple action without payload', () => {
      const result = parseCallbackData('feedback_up');
      expect(result).toEqual({
        action: 'feedback_up',
      });
    });

    it('parses action with payload', () => {
      const result = parseCallbackData('hitl_approve:confirm_123');
      expect(result).toEqual({
        action: 'hitl_approve',
        payload: 'confirm_123',
      });
    });

    it('parses action with payload containing colons', () => {
      const result = parseCallbackData('hitl_approve:id:with:colons');
      expect(result).toEqual({
        action: 'hitl_approve',
        payload: 'id:with:colons',
      });
    });

    it('returns null for invalid action', () => {
      const result = parseCallbackData('invalid_action');
      expect(result).toBeNull();
    });

    it('returns null for incomplete format (action with empty payload)', () => {
      const result = parseCallbackData('feedback_up:');
      expect(result).toBeNull();
    });

    it('returns null for empty string', () => {
      const result = parseCallbackData('');
      expect(result).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      const result = parseCallbackData('   ');
      expect(result).toBeNull();
    });

    it('returns null for non-string input', () => {
      const result = parseCallbackData(null as any);
      expect(result).toBeNull();
    });

    it('trims whitespace from input', () => {
      const result = parseCallbackData('  feedback_up  ');
      expect(result).toEqual({
        action: 'feedback_up',
      });
    });

    it('handles all valid HITL actions', () => {
      const actions: CallbackAction[] = [
        'hitl_approve',
        'hitl_reject',
        'hitl_approve_all',
        'hitl_reject_all',
      ];

      for (const action of actions) {
        const result = parseCallbackData(action);
        expect(result).toEqual({ action });
      }
    });

    it('handles all valid message interaction actions', () => {
      const actions: CallbackAction[] = [
        'regenerate',
        'expand',
        'simplify',
        'feedback_up',
        'feedback_down',
      ];

      for (const action of actions) {
        const result = parseCallbackData(action);
        expect(result).toEqual({ action });
      }
    });
  });

  describe('serializeCallbackData', () => {
    it('serializes action without payload', () => {
      const result = serializeCallbackData('feedback_up');
      expect(result).toBe('feedback_up');
    });

    it('serializes action with payload', () => {
      const result = serializeCallbackData('hitl_approve', 'confirm_123');
      expect(result).toBe('hitl_approve:confirm_123');
    });

    it('throws error if total length exceeds 64 bytes', () => {
      // hitl_approve is 12 chars, colon is 1, so max payload is 51 chars
      const longPayload = 'x'.repeat(53);
      expect(() => {
        serializeCallbackData('hitl_approve', longPayload);
      }).toThrow(/exceeds Telegram's 64-byte limit/);
    });

    it('handles UTF-8 multi-byte characters', () => {
      // Each emoji is multiple bytes
      const result = serializeCallbackData('feedback_up', '😀');
      expect(result).toBe('feedback_up:😀');
      // Verify the byte length is within limit
      expect(Buffer.byteLength(result, 'utf-8')).toBeLessThanOrEqual(64);
    });

    it('accepts payloads up to 64-byte limit', () => {
      // "hitl_approve:" = 13 bytes, so payload can be up to 51 bytes
      const maxPayload = 'x'.repeat(51);
      const result = serializeCallbackData('hitl_approve', maxPayload);
      expect(Buffer.byteLength(result, 'utf-8')).toBeLessThanOrEqual(64);
    });

    it('roundtrips through parse', () => {
      const serialized = serializeCallbackData('hitl_approve', 'id_123');
      const parsed = parseCallbackData(serialized);
      expect(parsed).toEqual({
        action: 'hitl_approve',
        payload: 'id_123',
      });
    });
  });

  describe('isValidAction', () => {
    it('returns true for valid action', () => {
      expect(isValidAction('feedback_up')).toBe(true);
      expect(isValidAction('hitl_approve')).toBe(true);
      expect(isValidAction('regenerate')).toBe(true);
    });

    it('returns false for invalid action', () => {
      expect(isValidAction('invalid')).toBe(false);
      expect(isValidAction('unknown_action')).toBe(false);
      expect(isValidAction('')).toBe(false);
    });
  });

  describe('getCallbackDataSize', () => {
    it('returns correct byte size for simple action', () => {
      const size = getCallbackDataSize('feedback_up');
      expect(size).toBe(Buffer.byteLength('feedback_up', 'utf-8'));
      expect(size).toBe(11); // feedback_up is 11 characters
    });

    it('returns correct byte size for action with payload', () => {
      const size = getCallbackDataSize('hitl_approve', 'id_123');
      expect(size).toBe(Buffer.byteLength('hitl_approve:id_123', 'utf-8'));
      expect(size).toBe(19); // hitl_approve:id_123
    });

    it('handles multi-byte characters', () => {
      const size = getCallbackDataSize('feedback_up', '😀');
      // 😀 is 4 bytes in UTF-8
      expect(size).toBe(11 + 1 + 4); // "feedback_up" + ":" + emoji
    });
  });
});

// =============================================================================
// Handler Tests
// =============================================================================

describe('Callback Handlers', () => {
  const mockContext: CallbackContext = {
    callbackQueryId: 'cq_123',
    chatId: 12345,
    messageId: 789,
    userId: 999,
    username: 'testuser',
    data: 'test_action',
  };

  describe('Handler Map', () => {
    it('has handler for each callback action', () => {
      const actions: CallbackAction[] = [
        'hitl_approve',
        'hitl_reject',
        'hitl_approve_all',
        'hitl_reject_all',
        'regenerate',
        'expand',
        'simplify',
        'feedback_up',
        'feedback_down',
      ];

      for (const action of actions) {
        expect(callbackHandlers[action]).toBeDefined();
        expect(typeof callbackHandlers[action]).toBe('function');
      }
    });
  });

  describe('hitl_approve handler', () => {
    it('returns success result with message when payload provided', async () => {
      const result = await callbackHandlers.hitl_approve(mockContext, 'confirm_123');
      expect(result).toEqual({
        success: true,
        message: 'Tool execution approved',
      });
    });

    it('returns error when no payload provided', async () => {
      const result = await callbackHandlers.hitl_approve(mockContext);
      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });
  });

  describe('hitl_reject handler', () => {
    it('returns success result with message when payload provided', async () => {
      const result = await callbackHandlers.hitl_reject(mockContext, 'confirm_123');
      expect(result).toEqual({
        success: true,
        message: 'Tool execution rejected',
      });
    });

    it('returns error when no payload provided', async () => {
      const result = await callbackHandlers.hitl_reject(mockContext);
      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });
  });

  describe('hitl_approve_all handler', () => {
    it('returns success and removes keyboard', async () => {
      const result = await callbackHandlers.hitl_approve_all(mockContext);
      expect(result).toEqual({
        success: true,
        message: 'All pending tool executions approved',
        removeKeyboard: true,
      });
    });
  });

  describe('hitl_reject_all handler', () => {
    it('returns success and removes keyboard', async () => {
      const result = await callbackHandlers.hitl_reject_all(mockContext);
      expect(result).toEqual({
        success: true,
        message: 'All pending tool executions rejected',
        removeKeyboard: true,
      });
    });
  });

  describe('regenerate handler', () => {
    it('returns success message', async () => {
      const result = await callbackHandlers.regenerate(mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });
  });

  describe('expand handler', () => {
    it('returns success message', async () => {
      const result = await callbackHandlers.expand(mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });
  });

  describe('simplify handler', () => {
    it('returns success message', async () => {
      const result = await callbackHandlers.simplify(mockContext);
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });
  });

  describe('feedback_up handler', () => {
    it('returns success and removes keyboard', async () => {
      const result = await callbackHandlers.feedback_up(mockContext);
      expect(result.success).toBe(true);
      expect(result.removeKeyboard).toBe(true);
      expect(result.message).toBeDefined();
    });
  });

  describe('feedback_down handler', () => {
    it('returns success and removes keyboard', async () => {
      const result = await callbackHandlers.feedback_down(mockContext);
      expect(result.success).toBe(true);
      expect(result.removeKeyboard).toBe(true);
      expect(result.message).toBeDefined();
    });
  });

  describe('Handler Error Handling', () => {
    it('handlers are async functions', async () => {
      const handler = callbackHandlers.feedback_up;
      const result = await handler(mockContext);
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('handlers return CallbackResult with success property', async () => {
      for (const action of Object.values(callbackHandlers)) {
        const result = await action(mockContext);
        expect(result).toHaveProperty('success');
        expect(typeof result.success).toBe('boolean');
      }
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Callback Integration', () => {
  const mockContext: CallbackContext = {
    callbackQueryId: 'cq_456',
    chatId: 54321,
    messageId: 456,
    userId: 777,
    username: 'anotheruser',
    data: '',
  };

  describe('End-to-end callback processing', () => {
    it('parses and routes feedback_up callback', async () => {
      const data = 'feedback_up';
      const parsed = parseCallbackData(data);
      expect(parsed).not.toBeNull();
      expect(parsed!.action).toBe('feedback_up');

      const handler = callbackHandlers[parsed!.action];
      const result = await handler(mockContext, parsed!.payload);
      expect(result.success).toBe(true);
    });

    it('parses and routes hitl_approve callback with payload', async () => {
      const data = 'hitl_approve:confirm_xyz';
      const parsed = parseCallbackData(data);
      expect(parsed).not.toBeNull();
      expect(parsed!.action).toBe('hitl_approve');
      expect(parsed!.payload).toBe('confirm_xyz');

      const handler = callbackHandlers[parsed!.action];
      const result = await handler(mockContext, parsed!.payload);
      expect(result.success).toBe(true);
    });

    it('handles invalid callback data gracefully', () => {
      const data = 'invalid_callback_data';
      const parsed = parseCallbackData(data);
      expect(parsed).toBeNull();
    });

    it('validates all serialized callbacks are parseable', () => {
      const testCases: Array<[CallbackAction, string | undefined]> = [
        ['feedback_up', undefined],
        ['feedback_down', undefined],
        ['hitl_approve', 'id_1'],
        ['hitl_reject', 'id_2'],
        ['regenerate', undefined],
        ['expand', undefined],
        ['simplify', undefined],
        ['hitl_approve_all', undefined],
        ['hitl_reject_all', undefined],
      ];

      for (const [action, payload] of testCases) {
        const serialized = serializeCallbackData(action, payload);
        const parsed = parseCallbackData(serialized);
        expect(parsed).not.toBeNull();
        expect(parsed!.action).toBe(action);
        expect(parsed!.payload).toBe(payload);
      }
    });
  });

  describe('Telegram Limits', () => {
    it('enforces 64-byte limit for all callback data', () => {
      // The longest action is 'hitl_approve_all' (16 chars)
      // With colon, max payload is 64 - 17 = 47 chars
      const maxPayload = 'x'.repeat(47);
      expect(() => {
        serializeCallbackData('hitl_approve_all', maxPayload);
      }).not.toThrow();

      // One more char should fail
      const tooLongPayload = 'x'.repeat(48);
      expect(() => {
        serializeCallbackData('hitl_approve_all', tooLongPayload);
      }).toThrow();
    });

    it('provides helpful error message for oversized data', () => {
      const longPayload = 'x'.repeat(60);
      expect(() => {
        serializeCallbackData('hitl_approve', longPayload);
      }).toThrow(/64-byte limit/);
    });
  });
});
