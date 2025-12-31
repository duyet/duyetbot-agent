import { describe, expect, it } from 'vitest';
import {
  clearMetadata,
  createInitialState,
  getSessionId,
  getStateAge,
  getTimeSinceUpdate,
  isEmptyState,
  isRequestProcessed,
  isValidState,
  markRequestProcessed,
  migrateState,
  REQUEST_ID_WINDOW_SIZE,
  touchState,
  updateMetadata,
} from '../agent-state.js';
import type { CloudflareAgentState } from '../types.js';

describe('agent-state', () => {
  describe('createInitialState', () => {
    it('should create state with default values', () => {
      const state = createInitialState();

      expect(state.messages).toEqual([]);
      expect(state.userId).toBeUndefined();
      expect(state.chatId).toBeUndefined();
      expect(state.metadata).toBeUndefined();
      expect(state.processedRequestIds).toEqual([]);
      expect(state.createdAt).toBeGreaterThan(0);
      expect(state.updatedAt).toBeGreaterThan(0);
      expect(state.createdAt).toBe(state.updatedAt);
    });

    it('should create state with userId', () => {
      const state = createInitialState('user123');

      expect(state.userId).toBe('user123');
      expect(state.chatId).toBeUndefined();
    });

    it('should create state with chatId', () => {
      const state = createInitialState(undefined, 'chat456');

      expect(state.userId).toBeUndefined();
      expect(state.chatId).toBe('chat456');
    });

    it('should create state with both userId and chatId', () => {
      const state = createInitialState('user123', 'chat456');

      expect(state.userId).toBe('user123');
      expect(state.chatId).toBe('chat456');
    });

    it('should accept numeric IDs', () => {
      const state = createInitialState(123, 456);

      expect(state.userId).toBe(123);
      expect(state.chatId).toBe(456);
    });
  });

  describe('touchState', () => {
    it('should update updatedAt timestamp', () => {
      const state = createInitialState();
      const originalTimestamp = state.updatedAt;

      // Wait a bit to ensure timestamp changes
      const updatedState = touchState(state);

      expect(updatedState.updatedAt).toBeGreaterThanOrEqual(originalTimestamp);
    });

    it('should preserve other state properties', () => {
      const state = createInitialState('user123', 'chat456');
      const updatedState = touchState(state);

      expect(updatedState.userId).toBe('user123');
      expect(updatedState.chatId).toBe('chat456');
      expect(updatedState.messages).toBe(state.messages);
      expect(updatedState.createdAt).toBe(state.createdAt);
    });
  });

  describe('isRequestProcessed', () => {
    it('should return false for unprocessed request', () => {
      const state = createInitialState();
      expect(isRequestProcessed(state, 'req-1')).toBe(false);
    });

    it('should return true for processed request', () => {
      const state = markRequestProcessed(createInitialState(), 'req-1');
      expect(isRequestProcessed(state, 'req-1')).toBe(true);
    });

    it('should handle state without processedRequestIds', () => {
      const state: CloudflareAgentState = {
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(isRequestProcessed(state, 'req-1')).toBe(false);
    });
  });

  describe('markRequestProcessed', () => {
    it('should add request ID to empty list', () => {
      const state = createInitialState();
      const updatedState = markRequestProcessed(state, 'req-1');

      expect(updatedState.processedRequestIds).toEqual(['req-1']);
    });

    it('should append request ID to existing list', () => {
      let state = createInitialState();
      state = markRequestProcessed(state, 'req-1');
      state = markRequestProcessed(state, 'req-2');

      expect(state.processedRequestIds).toEqual(['req-1', 'req-2']);
    });

    it('should maintain window size limit', () => {
      let state = createInitialState();

      // Add more than window size
      for (let i = 0; i < REQUEST_ID_WINDOW_SIZE + 10; i++) {
        state = markRequestProcessed(state, `req-${i}`);
      }

      expect(state.processedRequestIds).toHaveLength(REQUEST_ID_WINDOW_SIZE);
      // Should keep the most recent ones
      expect(state.processedRequestIds![0]).toBe('req-10');
      expect(state.processedRequestIds![REQUEST_ID_WINDOW_SIZE - 1]).toBe(
        `req-${REQUEST_ID_WINDOW_SIZE + 9}`
      );
    });

    it('should update updatedAt timestamp', () => {
      const state = createInitialState();
      const originalTimestamp = state.updatedAt;

      const updatedState = markRequestProcessed(state, 'req-1');

      expect(updatedState.updatedAt).toBeGreaterThanOrEqual(originalTimestamp);
    });

    it('should handle state without processedRequestIds', () => {
      const state: CloudflareAgentState = {
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const updatedState = markRequestProcessed(state, 'req-1');

      expect(updatedState.processedRequestIds).toEqual(['req-1']);
    });
  });

  describe('updateMetadata', () => {
    it('should add metadata to state without metadata', () => {
      const state = createInitialState();
      const updatedState = updateMetadata(state, { key: 'value' });

      expect(updatedState.metadata).toEqual({ key: 'value' });
    });

    it('should merge with existing metadata', () => {
      let state = createInitialState();
      state = updateMetadata(state, { key1: 'value1' });
      state = updateMetadata(state, { key2: 'value2' });

      expect(state.metadata).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should overwrite existing keys', () => {
      let state = createInitialState();
      state = updateMetadata(state, { key: 'value1' });
      state = updateMetadata(state, { key: 'value2' });

      expect(state.metadata).toEqual({ key: 'value2' });
    });

    it('should update updatedAt timestamp', () => {
      const state = createInitialState();
      const originalTimestamp = state.updatedAt;

      const updatedState = updateMetadata(state, { key: 'value' });

      expect(updatedState.updatedAt).toBeGreaterThanOrEqual(originalTimestamp);
    });
  });

  describe('clearMetadata', () => {
    it('should clear metadata', () => {
      let state = createInitialState();
      state = updateMetadata(state, { key: 'value' });

      const clearedState = clearMetadata(state);

      expect(clearedState.metadata).toBeUndefined();
    });

    it('should update updatedAt timestamp', () => {
      let state = createInitialState();
      state = updateMetadata(state, { key: 'value' });
      const originalTimestamp = state.updatedAt;

      const clearedState = clearMetadata(state);

      expect(clearedState.updatedAt).toBeGreaterThanOrEqual(originalTimestamp);
    });
  });

  describe('isValidState', () => {
    it('should accept valid state', () => {
      const state = createInitialState('user123', 'chat456');
      expect(isValidState(state)).toBe(true);
    });

    it('should accept state with metadata', () => {
      const state = updateMetadata(createInitialState(), { key: 'value' });
      expect(isValidState(state)).toBe(true);
    });

    it('should reject null', () => {
      expect(isValidState(null)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(isValidState('not an object')).toBe(false);
      expect(isValidState(123)).toBe(false);
      expect(isValidState([])).toBe(false);
    });

    it('should reject missing messages', () => {
      const state = { createdAt: Date.now(), updatedAt: Date.now() };
      expect(isValidState(state)).toBe(false);
    });

    it('should reject non-array messages', () => {
      const state = { messages: 'not an array', createdAt: Date.now(), updatedAt: Date.now() };
      expect(isValidState(state)).toBe(false);
    });

    it('should reject missing createdAt', () => {
      const state = { messages: [], updatedAt: Date.now() };
      expect(isValidState(state)).toBe(false);
    });

    it('should reject missing updatedAt', () => {
      const state = { messages: [], createdAt: Date.now() };
      expect(isValidState(state)).toBe(false);
    });

    it('should reject invalid userId type', () => {
      const state = {
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        userId: {},
      };
      expect(isValidState(state)).toBe(false);
    });

    it('should reject invalid metadata type', () => {
      const state = {
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: 'not an object',
      };
      expect(isValidState(state)).toBe(false);
    });

    it('should reject invalid processedRequestIds type', () => {
      const state = {
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        processedRequestIds: 'not an array',
      };
      expect(isValidState(state)).toBe(false);
    });
  });

  describe('migrateState', () => {
    it('should preserve all fields from complete state', () => {
      const state = createInitialState('user123', 'chat456');
      const migrated = migrateState(state);

      expect(migrated).toEqual(state);
    });

    it('should add missing fields with defaults', () => {
      const partial: Partial<CloudflareAgentState> = {
        messages: [],
      };

      const migrated = migrateState(partial);

      expect(migrated.messages).toEqual([]);
      expect(migrated.createdAt).toBeGreaterThan(0);
      expect(migrated.updatedAt).toBeGreaterThan(0);
      expect(migrated.processedRequestIds).toEqual([]);
    });

    it('should preserve existing timestamps', () => {
      const partial: Partial<CloudflareAgentState> = {
        messages: [],
        createdAt: 1000,
        updatedAt: 2000,
      };

      const migrated = migrateState(partial);

      expect(migrated.createdAt).toBe(1000);
      expect(migrated.updatedAt).toBe(2000);
    });
  });

  describe('getSessionId', () => {
    it('should return combined ID when both present', () => {
      const state = createInitialState('user123', 'chat456');
      expect(getSessionId(state)).toBe('user123:chat456');
    });

    it('should return userId when only userId present', () => {
      const state = createInitialState('user123');
      expect(getSessionId(state)).toBe('user123');
    });

    it('should return chatId with prefix when only chatId present', () => {
      const state = createInitialState(undefined, 'chat456');
      expect(getSessionId(state)).toBe('chat:chat456');
    });

    it('should return default when neither present', () => {
      const state = createInitialState();
      expect(getSessionId(state)).toBe('default');
    });

    it('should handle numeric IDs', () => {
      const state = createInitialState(123, 456);
      expect(getSessionId(state)).toBe('123:456');
    });
  });

  describe('isEmptyState', () => {
    it('should return true for state with no messages', () => {
      const state = createInitialState();
      expect(isEmptyState(state)).toBe(true);
    });

    it('should return false for state with messages', () => {
      const state: CloudflareAgentState = {
        ...createInitialState(),
        messages: [{ role: 'user', content: 'hello' }],
      };
      expect(isEmptyState(state)).toBe(false);
    });
  });

  describe('getStateAge', () => {
    it('should return age since creation', () => {
      const state = createInitialState();
      const age = getStateAge(state);

      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(1000); // Should be less than 1 second in tests
    });

    it('should increase over time', () => {
      const state: CloudflareAgentState = {
        ...createInitialState(),
        createdAt: Date.now() - 5000, // 5 seconds ago
      };

      const age = getStateAge(state);

      expect(age).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('getTimeSinceUpdate', () => {
    it('should return time since last update', () => {
      const state = createInitialState();
      const timeSinceUpdate = getTimeSinceUpdate(state);

      expect(timeSinceUpdate).toBeGreaterThanOrEqual(0);
      expect(timeSinceUpdate).toBeLessThan(1000); // Should be less than 1 second in tests
    });

    it('should increase over time', () => {
      const state: CloudflareAgentState = {
        ...createInitialState(),
        updatedAt: Date.now() - 3000, // 3 seconds ago
      };

      const timeSinceUpdate = getTimeSinceUpdate(state);

      expect(timeSinceUpdate).toBeGreaterThanOrEqual(3000);
    });
  });
});
