/**
 * Persistence Module
 *
 * Provides clean facades over message persistence adapters.
 * Exports unified API for message storage and session management.
 */

// Re-export types from adapters for convenience
export type { IMessagePersistence, SessionId } from '../adapters/message-persistence/types.js';
export { MessageStore } from './message-store.js';
export { createSessionId, formatSessionKey, parseSessionKey } from './session-manager.js';
