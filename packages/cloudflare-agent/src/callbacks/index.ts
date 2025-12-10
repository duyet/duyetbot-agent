/**
 * Telegram Inline Keyboard Callback Routing
 *
 * Exports all callback-related utilities for handling Telegram inline button presses.
 */

export type { CallbackHandler } from './handlers.js';
// Handlers
export { callbackHandlers } from './handlers.js';
// Parser
export {
  getCallbackDataSize,
  isValidAction,
  parseCallbackData,
  serializeCallbackData,
} from './parser.js';
// Types
export type { CallbackAction, CallbackContext, CallbackResult, ParsedCallback } from './types.js';
