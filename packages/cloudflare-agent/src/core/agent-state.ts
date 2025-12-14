/**
 * Agent state management utilities
 *
 * This module provides utilities for managing CloudflareAgent state,
 * including initialization, validation, and state transitions.
 *
 * @module core/agent-state
 */

import type { CloudflareAgentState } from './types.js';

/**
 * Request ID deduplication window size
 *
 * Limits the number of request IDs stored for deduplication.
 * Older IDs are discarded to prevent unbounded memory growth.
 */
export const REQUEST_ID_WINDOW_SIZE = 100;

/**
 * Creates initial agent state
 *
 * Provides a clean starting state for a new agent session.
 * All timestamps are set to the current time.
 *
 * @param userId - Optional user ID for the session
 * @param chatId - Optional chat ID for the session
 * @returns Fresh agent state ready for use
 */
export function createInitialState(
  userId?: string | number,
  chatId?: string | number
): CloudflareAgentState {
  const now = Date.now();

  const state: CloudflareAgentState = {
    messages: [],
    createdAt: now,
    updatedAt: now,
    processedRequestIds: [],
  };

  // Only set userId and chatId if provided (exactOptionalPropertyTypes compliance)
  if (userId !== undefined) {
    state.userId = userId;
  }
  if (chatId !== undefined) {
    state.chatId = chatId;
  }

  return state;
}

/**
 * Updates the state timestamp
 *
 * Marks the state as modified at the current time.
 * Should be called after any state mutation.
 *
 * @param state - State to update
 * @returns Updated state with new timestamp
 */
export function touchState(state: CloudflareAgentState): CloudflareAgentState {
  return {
    ...state,
    updatedAt: Date.now(),
  };
}

/**
 * Checks if a request ID has been processed
 *
 * Uses the rolling window of processed request IDs for deduplication.
 *
 * @param state - Current agent state
 * @param requestId - Request ID to check
 * @returns True if request ID has been processed
 */
export function isRequestProcessed(state: CloudflareAgentState, requestId: string): boolean {
  return state.processedRequestIds?.includes(requestId) ?? false;
}

/**
 * Marks a request ID as processed
 *
 * Adds the request ID to the rolling window and maintains the window size limit.
 * Oldest IDs are discarded when the window exceeds REQUEST_ID_WINDOW_SIZE.
 *
 * @param state - Current agent state
 * @param requestId - Request ID to mark as processed
 * @returns Updated state with request ID added
 */
export function markRequestProcessed(
  state: CloudflareAgentState,
  requestId: string
): CloudflareAgentState {
  const processedIds = state.processedRequestIds ?? [];

  // Add new ID and maintain window size
  const updatedIds = [...processedIds, requestId];
  if (updatedIds.length > REQUEST_ID_WINDOW_SIZE) {
    updatedIds.shift(); // Remove oldest ID
  }

  return {
    ...state,
    processedRequestIds: updatedIds,
    updatedAt: Date.now(),
  };
}

/**
 * Updates metadata in state
 *
 * Merges new metadata with existing metadata.
 *
 * @param state - Current agent state
 * @param metadata - Metadata to merge
 * @returns Updated state with merged metadata
 */
export function updateMetadata(
  state: CloudflareAgentState,
  metadata: Record<string, unknown>
): CloudflareAgentState {
  return {
    ...state,
    metadata: {
      ...state.metadata,
      ...metadata,
    },
    updatedAt: Date.now(),
  };
}

/**
 * Clears metadata from state
 *
 * @param state - Current agent state
 * @returns Updated state with cleared metadata
 */
export function clearMetadata(state: CloudflareAgentState): CloudflareAgentState {
  const newState = {
    ...state,
    updatedAt: Date.now(),
  };

  // Remove metadata property entirely (exactOptionalPropertyTypes compliance)
  delete newState.metadata;

  return newState;
}

/**
 * Validates state structure
 *
 * Ensures state has all required fields and correct types.
 *
 * @param state - State to validate
 * @returns True if state is valid
 */
export function isValidState(state: unknown): state is CloudflareAgentState {
  if (typeof state !== 'object' || state === null) {
    return false;
  }

  const s = state as Partial<CloudflareAgentState>;

  // Check required fields
  if (!Array.isArray(s.messages)) return false;
  if (typeof s.createdAt !== 'number') return false;
  if (typeof s.updatedAt !== 'number') return false;

  // Check optional fields if present
  if (s.userId !== undefined && typeof s.userId !== 'string' && typeof s.userId !== 'number') {
    return false;
  }

  if (s.chatId !== undefined && typeof s.chatId !== 'string' && typeof s.chatId !== 'number') {
    return false;
  }

  if (s.metadata !== undefined && (typeof s.metadata !== 'object' || s.metadata === null)) {
    return false;
  }

  if (s.processedRequestIds !== undefined && !Array.isArray(s.processedRequestIds)) {
    return false;
  }

  return true;
}

/**
 * Migrates old state to current version
 *
 * Handles backward compatibility by adding missing fields with defaults.
 *
 * @param state - State to migrate
 * @returns Migrated state with all current fields
 */
export function migrateState(state: Partial<CloudflareAgentState>): CloudflareAgentState {
  const now = Date.now();

  const migrated: CloudflareAgentState = {
    messages: state.messages ?? [],
    createdAt: state.createdAt ?? now,
    updatedAt: state.updatedAt ?? now,
    processedRequestIds: state.processedRequestIds ?? [],
  };

  // Only set optional fields if they were present (exactOptionalPropertyTypes compliance)
  if (state.userId !== undefined) {
    migrated.userId = state.userId;
  }
  if (state.chatId !== undefined) {
    migrated.chatId = state.chatId;
  }
  if (state.metadata !== undefined) {
    migrated.metadata = state.metadata;
  }

  return migrated;
}

/**
 * Gets session ID from state
 *
 * Creates a consistent session ID from userId and chatId.
 * Falls back to 'default' if both are undefined.
 *
 * @param state - Agent state
 * @returns Session ID string
 */
export function getSessionId(state: CloudflareAgentState): string {
  const { userId, chatId } = state;

  if (userId !== undefined && chatId !== undefined) {
    return `${userId}:${chatId}`;
  }

  if (userId !== undefined) {
    return `${userId}`;
  }

  if (chatId !== undefined) {
    return `chat:${chatId}`;
  }

  return 'default';
}

/**
 * Checks if state is empty (no messages)
 *
 * @param state - Agent state to check
 * @returns True if state has no messages
 */
export function isEmptyState(state: CloudflareAgentState): boolean {
  return state.messages.length === 0;
}

/**
 * Gets state age in milliseconds
 *
 * @param state - Agent state
 * @returns Age of state since creation in milliseconds
 */
export function getStateAge(state: CloudflareAgentState): number {
  return Date.now() - state.createdAt;
}

/**
 * Gets time since last update in milliseconds
 *
 * @param state - Agent state
 * @returns Time since last update in milliseconds
 */
export function getTimeSinceUpdate(state: CloudflareAgentState): number {
  return Date.now() - state.updatedAt;
}
