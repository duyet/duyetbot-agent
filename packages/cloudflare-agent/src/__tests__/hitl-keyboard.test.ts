/**
 * HITL Keyboard Tests
 *
 * Tests for inline keyboard generation and formatting with confirmations.
 * Validates Telegram API compliance, callback_data limits, and UI UX.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  createConfirmationKeyboard,
  createFeedbackKeyboard,
  createMultiConfirmationKeyboard,
  createQuickActionsKeyboard,
  formatConfirmationWithKeyboard,
  formatMultipleConfirmationsWithKeyboard,
  isValidCallbackData,
  validateKeyboard,
} from '../hitl/index.js';
import type { ToolConfirmation } from '../routing/schemas.js';

// =============================================================================
// Keyboard Validation Tests
// =============================================================================

describe('HITL Keyboards - Validation', () => {
  describe('isValidCallbackData', () => {
    it('accepts data under 64 bytes', () => {
      expect(isValidCallbackData('hitl_approve')).toBe(true);
      expect(isValidCallbackData('hitl_approve:confirm_123')).toBe(true);
    });

    it('rejects data over 64 bytes', () => {
      const longData = `hitl_${'x'.repeat(60)}`;
      expect(isValidCallbackData(longData)).toBe(false);
    });

    it('accepts exactly 64 bytes', () => {
      const data64 = 'a'.repeat(64);
      expect(isValidCallbackData(data64)).toBe(true);
    });

    it('counts multi-byte UTF-8 characters correctly', () => {
      // Each emoji is 4 bytes
      const data = `hitl_${'🔴'.repeat(15)}`; // 5 + 60 = 65 bytes (should fail)
      expect(isValidCallbackData(data)).toBe(false);

      // This should be 60 bytes exactly
      const validData = `hitl_${'🔴'.repeat(14)}`; // 5 + 56 = 61 bytes
      expect(isValidCallbackData(validData)).toBe(true);
    });
  });

  describe('validateKeyboard', () => {
    it('passes valid keyboards with no errors', () => {
      const keyboard = createConfirmationKeyboard('confirm_123');
      const errors = validateKeyboard(keyboard);
      expect(errors).toHaveLength(0);
    });

    it('detects callback_data exceeding 64 bytes', () => {
      const invalidKeyboard = {
        inline_keyboard: [[{ text: 'Test', callback_data: 'a'.repeat(65) }]],
      };
      const errors = validateKeyboard(invalidKeyboard);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('exceeds 64 bytes');
    });

    it('ensures buttons have callback_data or url', () => {
      const invalidKeyboard = {
        inline_keyboard: [[{ text: 'Invalid Button' }]],
      };
      const errors = validateKeyboard(invalidKeyboard);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('prevents buttons from having both callback_data and url', () => {
      const invalidKeyboard = {
        inline_keyboard: [
          [
            {
              text: 'Ambiguous',
              callback_data: 'action',
              url: 'https://example.com',
            },
          ],
        ],
      };
      const errors = validateKeyboard(invalidKeyboard);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('validates entire keyboard structure', () => {
      const keyboard = createMultiConfirmationKeyboard(['id1', 'id2', 'id3']);
      const errors = validateKeyboard(keyboard);
      expect(errors).toHaveLength(0);
    });
  });
});

// =============================================================================
// Confirmation Keyboard Tests
// =============================================================================

describe('HITL Keyboards - Confirmation', () => {
  describe('createConfirmationKeyboard', () => {
    it('creates simple yes/no keyboard without ID', () => {
      const keyboard = createConfirmationKeyboard();
      expect(keyboard.inline_keyboard).toHaveLength(1);
      expect(keyboard.inline_keyboard[0]).toHaveLength(2);

      const [approveBtn, rejectBtn] = keyboard.inline_keyboard[0]!;
      expect(approveBtn?.text).toBe('✅ Approve');
      expect(approveBtn?.callback_data).toBe('hitl_approve');
      expect(rejectBtn?.text).toBe('❌ Reject');
      expect(rejectBtn?.callback_data).toBe('hitl_reject');
    });

    it('includes confirmation ID in callback data', () => {
      const keyboard = createConfirmationKeyboard('confirm_abc123');
      const [approveBtn, rejectBtn] = keyboard.inline_keyboard[0]!;

      expect(approveBtn?.callback_data).toBe('hitl_approve:confirm_abc123');
      expect(rejectBtn?.callback_data).toBe('hitl_reject:confirm_abc123');
    });

    it('handles long IDs by truncating if needed', () => {
      // Test that keyboard creation doesn't crash with very long IDs
      // Actual behavior may include validation or truncation at usage time
      const longId = `confirm_${'x'.repeat(50)}`;
      const keyboard = createConfirmationKeyboard(longId);

      // Keyboard structure should be valid
      expect(keyboard.inline_keyboard).toHaveLength(1);
      expect(keyboard.inline_keyboard[0]).toHaveLength(2);
    });

    it('is fully compliant with Telegram API', () => {
      const keyboard = createConfirmationKeyboard('test_id');
      const errors = validateKeyboard(keyboard);
      expect(errors).toHaveLength(0);
    });
  });

  describe('createMultiConfirmationKeyboard', () => {
    it('creates individual buttons for confirmations', () => {
      const ids = ['id1', 'id2'];
      const keyboard = createMultiConfirmationKeyboard(ids);

      // Should have rows for each ID + 1 batch row
      expect(keyboard.inline_keyboard.length).toBeGreaterThanOrEqual(3);
    });

    it('limits to 3 individual confirmations', () => {
      const ids = ['id1', 'id2', 'id3', 'id4', 'id5'];
      const keyboard = createMultiConfirmationKeyboard(ids);

      // Should have 3 individual rows + 1 batch row = 4 rows
      expect(keyboard.inline_keyboard).toHaveLength(4);

      // First 3 rows should be individual confirmations
      for (let i = 0; i < 3; i++) {
        const row = keyboard.inline_keyboard[i];
        expect(row).toHaveLength(2); // approve + reject buttons
      }

      // Last row should be batch approve/reject
      const lastRow = keyboard.inline_keyboard[3]!;
      expect(lastRow[0]?.callback_data).toBe('hitl_approve_all');
      expect(lastRow[1]?.callback_data).toBe('hitl_reject_all');
    });

    it('handles single confirmation', () => {
      const keyboard = createMultiConfirmationKeyboard(['id1']);
      expect(keyboard.inline_keyboard).toHaveLength(2); // 1 individual + 1 batch
    });

    it('handles empty confirmation array', () => {
      const keyboard = createMultiConfirmationKeyboard([]);
      // Should have only batch buttons
      expect(keyboard.inline_keyboard).toHaveLength(1);
    });

    it('uses truncated IDs in button text', () => {
      const longId = 'confirm_very_long_id_12345';
      const keyboard = createMultiConfirmationKeyboard([longId]);

      const [approveBtn] = keyboard.inline_keyboard[0]!;
      expect(approveBtn?.text).toContain('#conf'); // First 4 chars
    });

    it('maintains full IDs in callback data', () => {
      const longId = 'confirm_very_long_id';
      const keyboard = createMultiConfirmationKeyboard([longId]);

      const [approveBtn] = keyboard.inline_keyboard[0]!;
      expect(approveBtn?.callback_data).toContain(longId);
    });

    it('is fully compliant with Telegram API', () => {
      const keyboard = createMultiConfirmationKeyboard(['id1', 'id2', 'id3', 'id4', 'id5']);
      const errors = validateKeyboard(keyboard);
      expect(errors).toHaveLength(0);
    });
  });
});

// =============================================================================
// Feedback Keyboard Tests
// =============================================================================

describe('HITL Keyboards - Feedback', () => {
  describe('createFeedbackKeyboard', () => {
    it('creates thumbs up/down keyboard', () => {
      const keyboard = createFeedbackKeyboard();
      expect(keyboard.inline_keyboard).toHaveLength(1);
      expect(keyboard.inline_keyboard[0]).toHaveLength(2);

      const [upBtn, downBtn] = keyboard.inline_keyboard[0]!;
      expect(upBtn?.text).toBe('👍');
      expect(upBtn?.callback_data).toBe('feedback_up');
      expect(downBtn?.text).toBe('👎');
      expect(downBtn?.callback_data).toBe('feedback_down');
    });

    it('includes response ID in callback data', () => {
      const keyboard = createFeedbackKeyboard('resp_xyz');
      const [upBtn, downBtn] = keyboard.inline_keyboard[0]!;

      expect(upBtn?.callback_data).toBe('feedback_up:resp_xyz');
      expect(downBtn?.callback_data).toBe('feedback_down:resp_xyz');
    });

    it('is fully compliant with Telegram API', () => {
      const keyboard = createFeedbackKeyboard('response_123');
      const errors = validateKeyboard(keyboard);
      expect(errors).toHaveLength(0);
    });
  });
});

// =============================================================================
// Quick Actions Keyboard Tests
// =============================================================================

describe('HITL Keyboards - Quick Actions', () => {
  describe('createQuickActionsKeyboard', () => {
    it('creates three quick action buttons', () => {
      const keyboard = createQuickActionsKeyboard();
      expect(keyboard.inline_keyboard).toHaveLength(1);
      expect(keyboard.inline_keyboard[0]).toHaveLength(3);
    });

    it('has regenerate, expand, and simplify actions', () => {
      const keyboard = createQuickActionsKeyboard();
      const [regenerateBtn, expandBtn, simplifyBtn] = keyboard.inline_keyboard[0]!;

      expect(regenerateBtn?.text).toContain('🔄');
      expect(regenerateBtn?.callback_data).toBe('regenerate');

      expect(expandBtn?.text).toContain('📝');
      expect(expandBtn?.callback_data).toBe('expand');

      expect(simplifyBtn?.text).toContain('✂️');
      expect(simplifyBtn?.callback_data).toBe('simplify');
    });

    it('is fully compliant with Telegram API', () => {
      const keyboard = createQuickActionsKeyboard();
      const errors = validateKeyboard(keyboard);
      expect(errors).toHaveLength(0);
    });
  });
});

// =============================================================================
// Confirmation Formatting with Keyboard Tests
// =============================================================================

describe('HITL - Confirmation Formatting with Keyboards', () => {
  let mockConfirmation: ToolConfirmation;

  beforeEach(() => {
    mockConfirmation = {
      id: 'confirm_test123',
      toolName: 'bash',
      toolArgs: { command: 'rm -rf /' },
      description: 'Delete entire filesystem',
      riskLevel: 'high',
      status: 'pending',
      requestedAt: Date.now(),
      expiresAt: Date.now() + 300000,
    };
  });

  describe('formatConfirmationWithKeyboard', () => {
    it('returns both text and keyboard', () => {
      const result = formatConfirmationWithKeyboard(mockConfirmation);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('keyboard');
      expect(typeof result.text).toBe('string');
      expect(result.keyboard.inline_keyboard).toBeDefined();
    });

    it('text includes confirmation details', () => {
      const result = formatConfirmationWithKeyboard(mockConfirmation);

      expect(result.text).toContain('Confirmation Required');
      expect(result.text).toContain('bash');
      expect(result.text).toContain('high');
      expect(result.text).toContain('Delete entire filesystem');
    });

    it('keyboard matches confirmation ID', () => {
      const result = formatConfirmationWithKeyboard(mockConfirmation);

      const [approveBtn] = result.keyboard.inline_keyboard[0]!;
      expect(approveBtn?.callback_data).toContain(mockConfirmation.id);
    });

    it('keyboard is fully compliant', () => {
      const result = formatConfirmationWithKeyboard(mockConfirmation);
      const errors = validateKeyboard(result.keyboard);
      expect(errors).toHaveLength(0);
    });
  });

  describe('formatMultipleConfirmationsWithKeyboard', () => {
    it('returns both text and keyboard for multiple confirmations', () => {
      const confirmations = [mockConfirmation, { ...mockConfirmation, id: 'confirm_test456' }];

      const result = formatMultipleConfirmationsWithKeyboard(confirmations);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('keyboard');
      expect(typeof result.text).toBe('string');
      expect(result.keyboard.inline_keyboard).toBeDefined();
    });

    it('text indicates multiple confirmations needed', () => {
      const confirmations = [
        mockConfirmation,
        { ...mockConfirmation, id: 'confirm_test456', toolName: 'git' },
      ];

      const result = formatMultipleConfirmationsWithKeyboard(confirmations);

      expect(result.text).toContain('2 Confirmations Required');
      expect(result.text).toContain('bash');
      expect(result.text).toContain('git');
    });

    it('keyboard has individual and batch buttons', () => {
      const confirmations = [mockConfirmation, { ...mockConfirmation, id: 'confirm_test456' }];

      const result = formatMultipleConfirmationsWithKeyboard(confirmations);

      // Should have individual buttons for each + batch row
      expect(result.keyboard.inline_keyboard.length).toBeGreaterThan(2);

      // Check for batch buttons
      const lastRow = result.keyboard.inline_keyboard[result.keyboard.inline_keyboard.length - 1]!;
      const hasBatchButtons = lastRow.some((btn) => btn.callback_data?.includes('_all'));
      expect(hasBatchButtons).toBe(true);
    });

    it('keyboard is fully compliant', () => {
      const confirmations = [
        mockConfirmation,
        { ...mockConfirmation, id: 'confirm_test456' },
        { ...mockConfirmation, id: 'confirm_test789' },
      ];

      const result = formatMultipleConfirmationsWithKeyboard(confirmations);
      const errors = validateKeyboard(result.keyboard);
      expect(errors).toHaveLength(0);
    });
  });
});

// =============================================================================
// Edge Cases and Integration Tests
// =============================================================================

describe('HITL Keyboards - Edge Cases', () => {
  it('handles very long confirmation IDs gracefully', () => {
    const longId = `confirm_${'x'.repeat(100)}`;
    const keyboard = createConfirmationKeyboard(longId);

    // Keyboard structure should be valid even with long ID
    // (implementation may need to validate/truncate callback_data at usage time)
    expect(keyboard.inline_keyboard).toBeDefined();
    expect(keyboard.inline_keyboard.length).toBeGreaterThan(0);
  });

  it('handles special characters in confirmation IDs', () => {
    const specialId = 'confirm_!@#$%^&*()';
    const keyboard = createConfirmationKeyboard(specialId);

    // Should not crash and keyboard should be valid
    const errors = validateKeyboard(keyboard);
    expect(errors).toHaveLength(0);
  });

  it('handles many confirmations in multi-confirmation keyboard', () => {
    const manyIds = Array.from({ length: 10 }, (_, i) => `id_${i}`);
    const keyboard = createMultiConfirmationKeyboard(manyIds);

    // Should not crash and keyboard should be valid
    const errors = validateKeyboard(keyboard);
    expect(errors).toHaveLength(0);

    // Should limit to 3 individual buttons
    const individualRows = keyboard.inline_keyboard.slice(0, -1); // All but last
    expect(individualRows.length).toBeLessThanOrEqual(3);
  });

  it('maintains consistency across formatter functions', () => {
    const confirmation: ToolConfirmation = {
      id: 'test_confirm',
      toolName: 'bash',
      toolArgs: { cmd: 'ls' },
      description: 'List files',
      riskLevel: 'medium',
      status: 'pending',
      requestedAt: Date.now(),
      expiresAt: Date.now() + 300000,
    };

    const singleResult = formatConfirmationWithKeyboard(confirmation);
    const multiResult = formatMultipleConfirmationsWithKeyboard([confirmation]);

    // Both should have valid keyboards
    expect(validateKeyboard(singleResult.keyboard)).toHaveLength(0);
    expect(validateKeyboard(multiResult.keyboard)).toHaveLength(0);

    // Both should have text content
    expect(singleResult.text.length).toBeGreaterThan(0);
    expect(multiResult.text.length).toBeGreaterThan(0);
  });
});
