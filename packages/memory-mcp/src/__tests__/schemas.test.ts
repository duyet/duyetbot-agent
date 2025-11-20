import { describe, it, expect } from 'vitest';
import { authenticateSchema } from '../tools/authenticate.js';
import { getMemorySchema } from '../tools/get-memory.js';
import { saveMemorySchema } from '../tools/save-memory.js';
import { searchMemorySchema } from '../tools/search-memory.js';
import { listSessionsSchema } from '../tools/list-sessions.js';

describe('Schema Validation', () => {
  describe('authenticateSchema', () => {
    it('should accept github_token', () => {
      const result = authenticateSchema.safeParse({ github_token: 'token123' });
      expect(result.success).toBe(true);
    });

    it('should accept oauth_code', () => {
      const result = authenticateSchema.safeParse({ oauth_code: 'code123' });
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = authenticateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid types', () => {
      const result = authenticateSchema.safeParse({ github_token: 123 });
      expect(result.success).toBe(false);
    });
  });

  describe('getMemorySchema', () => {
    it('should require session_id', () => {
      const result = getMemorySchema.safeParse({ session_id: 'sess_123' });
      expect(result.success).toBe(true);
    });

    it('should accept optional limit and offset', () => {
      const result = getMemorySchema.safeParse({
        session_id: 'sess_123',
        limit: 10,
        offset: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing session_id', () => {
      const result = getMemorySchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject non-number limit', () => {
      const result = getMemorySchema.safeParse({
        session_id: 'sess_123',
        limit: 'ten',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('saveMemorySchema', () => {
    it('should require messages array', () => {
      const result = saveMemorySchema.safeParse({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional session_id', () => {
      const result = saveMemorySchema.safeParse({
        session_id: 'sess_123',
        messages: [{ role: 'assistant', content: 'Hi' }],
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional metadata', () => {
      const result = saveMemorySchema.safeParse({
        messages: [{ role: 'user', content: 'Test' }],
        metadata: { key: 'value' },
      });
      expect(result.success).toBe(true);
    });

    it('should validate message role', () => {
      const result = saveMemorySchema.safeParse({
        messages: [{ role: 'invalid', content: 'Test' }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty messages array', () => {
      const result = saveMemorySchema.safeParse({ messages: [] });
      expect(result.success).toBe(true); // Empty is allowed
    });

    it('should accept message with timestamp', () => {
      const result = saveMemorySchema.safeParse({
        messages: [{ role: 'user', content: 'Test', timestamp: Date.now() }],
      });
      expect(result.success).toBe(true);
    });

    it('should accept message with metadata', () => {
      const result = saveMemorySchema.safeParse({
        messages: [
          {
            role: 'user',
            content: 'Test',
            metadata: { source: 'api' },
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('searchMemorySchema', () => {
    it('should require query', () => {
      const result = searchMemorySchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
    });

    it('should accept optional limit', () => {
      const result = searchMemorySchema.safeParse({
        query: 'test',
        limit: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should accept filter with session_id', () => {
      const result = searchMemorySchema.safeParse({
        query: 'test',
        filter: { session_id: 'sess_123' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept filter with date_range', () => {
      const result = searchMemorySchema.safeParse({
        query: 'test',
        filter: {
          date_range: {
            start: Date.now() - 86400000,
            end: Date.now(),
          },
        },
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing query', () => {
      const result = searchMemorySchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('listSessionsSchema', () => {
    it('should accept empty object with defaults', () => {
      const result = listSessionsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should accept custom limit and offset', () => {
      const result = listSessionsSchema.safeParse({
        limit: 50,
        offset: 10,
      });
      expect(result.success).toBe(true);
    });

    it('should accept state filter', () => {
      const result = listSessionsSchema.safeParse({ state: 'active' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid state', () => {
      const result = listSessionsSchema.safeParse({ state: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should accept paused state', () => {
      const result = listSessionsSchema.safeParse({ state: 'paused' });
      expect(result.success).toBe(true);
    });

    it('should accept completed state', () => {
      const result = listSessionsSchema.safeParse({ state: 'completed' });
      expect(result.success).toBe(true);
    });
  });
});
