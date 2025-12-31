/**
 * Telegram Inline Keyboard Callback Type Definitions
 *
 * Defines callback actions triggered by inline keyboard button presses.
 * Supports HITL (Human-in-the-Loop) confirmations and message interactions.
 */

/**
 * Supported callback actions from inline keyboard buttons
 *
 * HITL Actions:
 * - hitl_approve: Approve a single tool execution request
 * - hitl_reject: Reject a single tool execution request
 * - hitl_approve_all: Approve all pending tool execution requests
 * - hitl_reject_all: Reject all pending tool execution requests
 *
 * Message Actions:
 * - regenerate: Regenerate the previous response
 * - expand: Expand on the previous response
 * - simplify: Simplify the previous response
 * - feedback_up: Positive feedback (thumbs up)
 * - feedback_down: Negative feedback (thumbs down)
 */
export type CallbackAction =
  | 'hitl_approve'
  | 'hitl_reject'
  | 'hitl_approve_all'
  | 'hitl_reject_all'
  | 'regenerate'
  | 'expand'
  | 'simplify'
  | 'feedback_up'
  | 'feedback_down';

/**
 * Parsed callback data from Telegram inline button press
 *
 * Format: "action" or "action:payload"
 * Example:
 * - "feedback_up" → { action: 'feedback_up' }
 * - "hitl_approve:confirm_123" → { action: 'hitl_approve', payload: 'confirm_123' }
 */
export interface ParsedCallback {
  /** The callback action being triggered */
  action: CallbackAction;
  /** Optional payload data (e.g., confirmation ID, message ID) */
  payload?: string;
}

/**
 * Context information for a callback query from Telegram
 *
 * This contains all data needed to process and respond to a callback query.
 */
export interface CallbackContext {
  /** Telegram callback query ID (used for answer callback query) */
  callbackQueryId: string;
  /** Telegram chat ID where button was pressed */
  chatId: number;
  /** Telegram message ID of the message containing the button */
  messageId: number;
  /** Telegram user ID who pressed the button */
  userId: number;
  /** Telegram username of the user (optional) */
  username?: string;
  /** Raw callback data from the button press */
  data: string;
}

/**
 * Result of processing a callback action
 *
 * Indicates success/failure and optional user-facing message and UI updates.
 */
export interface CallbackResult {
  /** Whether the callback was handled successfully */
  success: boolean;
  /** Optional user-facing message to display in popup/notification */
  message?: string;
  /** Whether to remove the keyboard after this action */
  removeKeyboard?: boolean;
}
