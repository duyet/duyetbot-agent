/**
 * Telegram Inline Keyboard Generation for HITL
 *
 * Provides keyboard builders for confirmation workflows, feedback collection,
 * and quick action responses. All callback_data payloads are strictly limited
 * to 64 bytes per Telegram Bot API specifications.
 */

import type { InlineKeyboardMarkup, InlineKeyboardRow } from '@duyetbot/types';

/**
 * Create an inline keyboard for simple yes/no confirmation
 *
 * @param confirmationId Optional ID to identify which confirmation is being responded to
 * @returns InlineKeyboardMarkup with approve/reject buttons
 *
 * @example
 * ```typescript
 * const keyboard = createConfirmationKeyboard('confirm_abc123');
 * // Produces buttons with callback_data: 'hitl_approve:confirm_abc123', 'hitl_reject:confirm_abc123'
 * ```
 */
export function createConfirmationKeyboard(confirmationId?: string): InlineKeyboardMarkup {
  const approveData = confirmationId ? `hitl_approve:${confirmationId}` : 'hitl_approve';
  const rejectData = confirmationId ? `hitl_reject:${confirmationId}` : 'hitl_reject';

  return {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: approveData },
        { text: '❌ Reject', callback_data: rejectData },
      ],
    ],
  };
}

/**
 * Create an inline keyboard for handling multiple pending confirmations
 *
 * Shows individual approve/reject buttons for up to 3 confirmations,
 * plus batch "Approve All" / "Reject All" buttons. This prevents UI bloat
 * while allowing both granular and bulk control.
 *
 * @param confirmationIds Array of confirmation IDs to create buttons for
 * @returns InlineKeyboardMarkup with individual and batch action buttons
 *
 * @example
 * ```typescript
 * const keyboard = createMultiConfirmationKeyboard(['id1', 'id2', 'id3', 'id4']);
 * // Shows buttons for first 3 IDs individually, plus batch approve/reject
 * ```
 */
export function createMultiConfirmationKeyboard(confirmationIds: string[]): InlineKeyboardMarkup {
  const rows: InlineKeyboardRow[] = [];

  // Add individual buttons for first 3 confirmations (UI sanity limit)
  // Use truncated IDs (first 4 chars) to fit within 64-byte callback_data limit
  const limitedIds = confirmationIds.slice(0, 3);
  for (const id of limitedIds) {
    const shortId = id.slice(0, 4);
    rows.push([
      { text: `✅ #${shortId}`, callback_data: `hitl_approve:${id}` },
      { text: `❌ #${shortId}`, callback_data: `hitl_reject:${id}` },
    ]);
  }

  // Add "Approve All" / "Reject All" row for batch operations
  rows.push([
    { text: '✅ Approve All', callback_data: 'hitl_approve_all' },
    { text: '❌ Reject All', callback_data: 'hitl_reject_all' },
  ]);

  return { inline_keyboard: rows };
}

/**
 * Create an inline keyboard for collecting feedback on responses
 *
 * Provides thumbs up/down buttons for users to rate response quality.
 * Useful for improving agent responses and collecting signal data.
 *
 * @param responseId Optional ID to identify which response is being rated
 * @returns InlineKeyboardMarkup with feedback buttons
 *
 * @example
 * ```typescript
 * const keyboard = createFeedbackKeyboard('resp_xyz789');
 * // Produces buttons with callback_data: 'feedback_up:resp_xyz789', 'feedback_down:resp_xyz789'
 * ```
 */
export function createFeedbackKeyboard(responseId?: string): InlineKeyboardMarkup {
  const upData = responseId ? `feedback_up:${responseId}` : 'feedback_up';
  const downData = responseId ? `feedback_down:${responseId}` : 'feedback_down';

  return {
    inline_keyboard: [
      [
        { text: '👍', callback_data: upData },
        { text: '👎', callback_data: downData },
      ],
    ],
  };
}

/**
 * Create an inline keyboard for quick action responses
 *
 * Allows users to request regeneration, expansion, or simplification
 * of responses without typing additional commands.
 *
 * @returns InlineKeyboardMarkup with quick action buttons
 *
 * @example
 * ```typescript
 * const keyboard = createQuickActionsKeyboard();
 * // Produces buttons with callback_data: 'regenerate', 'expand', 'simplify'
 * ```
 */
export function createQuickActionsKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🔄 Regenerate', callback_data: 'regenerate' },
        { text: '📝 Expand', callback_data: 'expand' },
        { text: '✂️ Simplify', callback_data: 'simplify' },
      ],
    ],
  };
}

/**
 * Validate that callback_data doesn't exceed Telegram's 64-byte limit
 *
 * @param callbackData The callback data string to validate
 * @returns true if valid (≤64 bytes), false otherwise
 *
 * @internal Used internally to ensure compliance with Telegram API constraints
 *
 * @example
 * ```typescript
 * if (!isValidCallbackData(data)) {
 *   throw new Error('callback_data exceeds 64 bytes');
 * }
 * ```
 */
export function isValidCallbackData(callbackData: string): boolean {
  return Buffer.byteLength(callbackData, 'utf-8') <= 64;
}

/**
 * Validate that an entire keyboard structure complies with Telegram limits
 *
 * @param keyboard The InlineKeyboardMarkup to validate
 * @returns Array of validation errors (empty if valid)
 *
 * @internal Used internally to ensure entire keyboard structure is valid
 *
 * @example
 * ```typescript
 * const errors = validateKeyboard(keyboard);
 * if (errors.length > 0) {
 *   console.error('Keyboard validation failed:', errors);
 * }
 * ```
 */
export function validateKeyboard(keyboard: InlineKeyboardMarkup): string[] {
  const errors: string[] = [];

  for (let rowIdx = 0; rowIdx < keyboard.inline_keyboard.length; rowIdx++) {
    const row = keyboard.inline_keyboard[rowIdx];
    if (!row) {
      continue;
    }

    for (let btnIdx = 0; btnIdx < row.length; btnIdx++) {
      const btn = row[btnIdx];
      if (!btn) {
        continue;
      }

      // Validate callback_data if present
      if (btn.callback_data && !isValidCallbackData(btn.callback_data)) {
        errors.push(
          `Row ${rowIdx}, Button ${btnIdx}: callback_data exceeds 64 bytes (${Buffer.byteLength(btn.callback_data, 'utf-8')} bytes)`
        );
      }

      // Validate that button has either callback_data or url (but not both)
      const hasCallback = btn.callback_data !== undefined && btn.callback_data.length > 0;
      const hasUrl = btn.url !== undefined && btn.url.length > 0;

      if (!hasCallback && !hasUrl) {
        errors.push(`Row ${rowIdx}, Button ${btnIdx}: must have either callback_data or url`);
      }

      if (hasCallback && hasUrl) {
        errors.push(
          `Row ${rowIdx}, Button ${btnIdx}: must have either callback_data or url, not both`
        );
      }
    }
  }

  return errors;
}
