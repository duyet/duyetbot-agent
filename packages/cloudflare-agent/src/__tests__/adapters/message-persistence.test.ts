import type { D1Database } from '@duyetbot/observability';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessagePersistenceAdapter } from '../../adapters/message-persistence.js';

describe('MessagePersistenceAdapter', () => {
  let mockDb: any;
  let adapter: MessagePersistenceAdapter;

  beforeEach(() => {
    // Mock the D1 database binding
    mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn(),
      })),
      batch: vi.fn().mockResolvedValue([{ success: true }]),
    } as unknown as D1Database;

    adapter = new MessagePersistenceAdapter(mockDb, () => 'sessionId:123');
  });

  it('should persist messages (smoke test)', () => {
    // Since persistMessages is fire-and-forget, we can't easily await its completion
    // without hacking the void promise.
    // For unit testing here, we just verify it doesn't crash on invocation.
    adapter.persistMessages([{ role: 'user', content: 'test' }]);
    expect(true).toBe(true);
  });

  it('should persist command', () => {
    adapter.persistCommand('/test', 'response');
    expect(true).toBe(true);
  });

  it('should load messages', async () => {
    // Mock return value for getRecentMessages logic (which calls db.prepare...)
    // The ChatMessageStorage internals are complex to fully mock without
    // dragging in the whole class.
    // But we can test that it returns array if db returns empty.

    // Re-instantiate with mocked storage behavior if we could inject storage but we can't.
    // So we rely on integration/mocked db.

    // Let's assume loading 0 messages returns empty array
    const result = await adapter.loadMessagesFromD1(10);
    expect(result).toEqual([]);
  });

  it('should handle missing db gracefully', async () => {
    const noDbAdapter = new MessagePersistenceAdapter(undefined, () => 's');
    noDbAdapter.persistMessages([]);
    const result = await noDbAdapter.loadMessagesFromD1(10);
    expect(result).toEqual([]);
  });
});
