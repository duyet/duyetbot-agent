/**
 * Telegram Inline Keyboard Callback Data Parser
 *
 * Handles parsing and serialization of callback data from inline button presses.
 * Enforces Telegram's 64-byte limit on callback data.
 */

import type { CallbackAction, ParsedCallback } from './types.js';

/**
 * All valid callback actions
 *
 * Used for validation when parsing callback data.
 */
const VALID_ACTIONS = new Set<CallbackAction>([
  'hitl_approve',
  'hitl_reject',
  'hitl_approve_all',
  'hitl_reject_all',
  'regenerate',
  'expand',
  'simplify',
  'feedback_up',
  'feedback_down',
]);

/**
 * Parse callback data string into structured CallbackAction and optional payload
 *
 * Format: "action" or "action:payload"
 * Examples:
 * - "feedback_up" → { action: 'feedback_up' }
 * - "hitl_approve:confirm_123" → { action: 'hitl_approve', payload: 'confirm_123' }
 * - "invalid_action" → null
 * - "incomplete:" → null
 *
 * @param data - Raw callback data from Telegram button press
 * @returns Parsed callback object or null if invalid
 */
export function parseCallbackData(data: string): ParsedCallback | null {
  if (!data || typeof data !== 'string') {
    return null;
  }

  const trimmed = data.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Split on first colon only to support payloads with colons
  const colonIndex = trimmed.indexOf(':');
  const action = colonIndex > 0 ? trimmed.slice(0, colonIndex) : trimmed;
  const payload = colonIndex > 0 ? trimmed.slice(colonIndex + 1) : undefined;

  // Validate action
  if (!VALID_ACTIONS.has(action as CallbackAction)) {
    return null;
  }

  // Reject empty payload (incomplete format like "action:")
  if (colonIndex > 0 && payload === '') {
    return null;
  }

  const result: ParsedCallback = {
    action: action as CallbackAction,
  };

  // Only add payload property if it exists
  if (payload !== undefined) {
    result.payload = payload;
  }

  return result;
}

/**
 * Serialize callback action and optional payload into callback data string
 *
 * Format: "action" or "action:payload"
 * Enforces Telegram's 64-byte limit on callback data.
 *
 * @param action - The callback action
 * @param payload - Optional payload data (e.g., confirmation ID)
 * @returns Serialized callback data string
 * @throws Error if total length exceeds 64 bytes (Telegram limit)
 *
 * @example
 * serializeCallbackData('feedback_up')
 * // → "feedback_up"
 *
 * serializeCallbackData('hitl_approve', 'confirm_abc123')
 * // → "hitl_approve:confirm_abc123"
 */
export function serializeCallbackData(action: CallbackAction, payload?: string): string {
  // Build the callback data
  let callbackData: string;
  if (payload) {
    callbackData = `${action}:${payload}`;
  } else {
    callbackData = action;
  }

  // Check Telegram's 64-byte limit
  const byteLength = Buffer.byteLength(callbackData, 'utf-8');
  if (byteLength > 64) {
    throw new Error(
      `Callback data exceeds Telegram's 64-byte limit: "${callbackData}" ` +
        `(${byteLength} bytes). Consider shortening the payload.`
    );
  }

  return callbackData;
}

/**
 * Check if a string is a valid callback action
 *
 * @param action - String to validate
 * @returns True if the action is valid
 */
export function isValidAction(action: string): action is CallbackAction {
  return VALID_ACTIONS.has(action as CallbackAction);
}

/**
 * Get the size of serialized callback data in bytes
 *
 * Useful for checking if a payload will fit within Telegram's 64-byte limit
 * before serialization.
 *
 * @param action - The callback action
 * @param payload - Optional payload data
 * @returns Size in bytes
 *
 * @example
 * getCallbackDataSize('hitl_approve', 'confirm_abc123')
 * // → 32 (bytes)
 *
 * // Check if payload will fit
 * if (getCallbackDataSize('hitl_approve', longId) > 64) {
 *   // Use shorter identifier
 * }
 */
export function getCallbackDataSize(action: CallbackAction, payload?: string): number {
  const callbackData = payload ? `${action}:${payload}` : action;
  return Buffer.byteLength(callbackData, 'utf-8');
}
