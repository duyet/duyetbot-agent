/**
 * Tests for Offline Queue
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { OfflineQueue, isOnline, syncQueue } from '@/client/offline-queue';
import type { QueuedMessage } from '@/client/offline-queue';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('OfflineQueue', () => {
  let testQueuePath: string;
  let queue: OfflineQueue;

  beforeEach(async () => {
    // Use a temporary test queue file
    testQueuePath = path.join(os.tmpdir(), `test-queue-${Date.now()}.json`);
    queue = new OfflineQueue(testQueuePath);
  });

  afterEach(async () => {
    // Clean up test file
    try {
      await fs.unlink(testQueuePath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('enqueue', () => {
    it('should add message to queue', async () => {
      const messageId = await queue.enqueue({
        sessionId: 'test-session',
        message: 'Hello, world!',
        model: 'claude-3-5-sonnet-20241022',
      });

      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe('string');

      const messages = await queue.getAll();
      expect(messages).toHaveLength(1);
      expect(messages[0]!.id).toBe(messageId);
      expect(messages[0]!.message).toBe('Hello, world!');
      expect(messages[0]!.sessionId).toBe('test-session');
      expect(messages[0]!.model).toBe('claude-3-5-sonnet-20241022');
      expect(messages[0]!.retries).toBe(0);
    });

    it('should queue multiple messages', async () => {
      await queue.enqueue({ message: 'Message 1' });
      await queue.enqueue({ message: 'Message 2' });
      await queue.enqueue({ message: 'Message 3' });

      const messages = await queue.getAll();
      expect(messages).toHaveLength(3);
      expect(messages[0]!.message).toBe('Message 1');
      expect(messages[1]!.message).toBe('Message 2');
      expect(messages[2]!.message).toBe('Message 3');
    });

    it('should persist queue to disk', async () => {
      await queue.enqueue({ message: 'Persisted message' });

      // Create new queue instance with same path
      const queue2 = new OfflineQueue(testQueuePath);
      const messages = await queue2.getAll();

      expect(messages).toHaveLength(1);
      expect(messages[0]!.message).toBe('Persisted message');
    });
  });

  describe('dequeue', () => {
    it('should remove message from queue', async () => {
      const messageId = await queue.enqueue({ message: 'Test message' });

      const removed = await queue.dequeue(messageId);
      expect(removed).toBe(true);

      const messages = await queue.getAll();
      expect(messages).toHaveLength(0);
    });

    it('should return false for non-existent message', async () => {
      const removed = await queue.dequeue('non-existent-id');
      expect(removed).toBe(false);
    });

    it('should maintain order of remaining messages', async () => {
      const id1 = await queue.enqueue({ message: 'Message 1' });
      await queue.enqueue({ message: 'Message 2' });
      const id3 = await queue.enqueue({ message: 'Message 3' });

      await queue.dequeue(id1);

      const messages = await queue.getAll();
      expect(messages).toHaveLength(2);
      expect(messages[0]!.message).toBe('Message 2');
      expect(messages[1]!.message).toBe('Message 3');
      expect(messages[1]!.id).toBe(id3);
    });
  });

  describe('peek', () => {
    it('should return first message without removing it', async () => {
      await queue.enqueue({ message: 'First' });
      await queue.enqueue({ message: 'Second' });

      const first = await queue.peek();
      expect(first).not.toBeNull();
      expect(first?.message).toBe('First');

      const messages = await queue.getAll();
      expect(messages).toHaveLength(2);
    });

    it('should return null for empty queue', async () => {
      const first = await queue.peek();
      expect(first).toBeNull();
    });
  });

  describe('incrementRetry', () => {
    it('should increment retry count', async () => {
      const messageId = await queue.enqueue({ message: 'Test' });

      await queue.incrementRetry(messageId);
      let messages = await queue.getAll();
      expect(messages[0]!.retries).toBe(1);

      await queue.incrementRetry(messageId);
      messages = await queue.getAll();
      expect(messages[0]!.retries).toBe(2);
    });

    it('should return false for non-existent message', async () => {
      const result = await queue.incrementRetry('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all messages', async () => {
      await queue.enqueue({ message: 'Message 1' });
      await queue.enqueue({ message: 'Message 2' });
      await queue.enqueue({ message: 'Message 3' });

      await queue.clear();

      const messages = await queue.getAll();
      expect(messages).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', async () => {
      await queue.enqueue({ message: 'Message 1' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await queue.enqueue({ message: 'Message 2' });

      const stats = await queue.getStats();
      expect(stats.totalMessages).toBe(2);
      expect(stats.oldestMessage).toBeDefined();
      expect(stats.newestMessage).toBeDefined();
      if (stats.oldestMessage === undefined || stats.newestMessage === undefined) {
        throw new Error('Expected oldestMessage and newestMessage to be defined');
      }
      expect(stats.newestMessage).toBeGreaterThanOrEqual(stats.oldestMessage);
    });

    it('should return zero stats for empty queue', async () => {
      const stats = await queue.getStats();
      expect(stats.totalMessages).toBe(0);
      expect(stats.oldestMessage).toBeUndefined();
      expect(stats.newestMessage).toBeUndefined();
    });
  });

  describe('pruneOldMessages', () => {
    it('should remove messages older than maxAge', async () => {
      // Enqueue a message and manually set old timestamp
      // @ts-expect-error unused variable
      const _messageId = await queue.enqueue({ message: 'Old message' });
      const messages = await queue.getAll();
      messages[0]!.timestamp = Date.now() - 10000; // 10 seconds ago

      // Save modified queue
      await fs.writeFile(testQueuePath, JSON.stringify(messages), { mode: 0o600 });

      // Enqueue a new message
      await queue.enqueue({ message: 'New message' });

      // Prune messages older than 5 seconds
      const removed = await queue.pruneOldMessages(5000);

      expect(removed).toBe(1);
      const remaining = await queue.getAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.message).toBe('New message');
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty queue', async () => {
      const empty = await queue.isEmpty();
      expect(empty).toBe(true);
    });

    it('should return false for non-empty queue', async () => {
      await queue.enqueue({ message: 'Test' });
      const empty = await queue.isEmpty();
      expect(empty).toBe(false);
    });
  });

  describe('size', () => {
    it('should return correct queue size', async () => {
      expect(await queue.size()).toBe(0);

      await queue.enqueue({ message: 'Message 1' });
      expect(await queue.size()).toBe(1);

      await queue.enqueue({ message: 'Message 2' });
      expect(await queue.size()).toBe(2);

      const messages = await queue.getAll();
      await queue.dequeue(messages[0]!.id);
      expect(await queue.size()).toBe(1);
    });
  });
});

describe('isOnline', () => {
  it('should return false for unreachable URL', async () => {
    const online = await isOnline('http://localhost:99999', 100);
    expect(online).toBe(false);
  });

  it('should timeout quickly', async () => {
    const start = Date.now();
    await isOnline('http://localhost:99999', 100);
    const duration = Date.now() - start;

    // Should timeout within 200ms (100ms timeout + some overhead)
    expect(duration).toBeLessThan(200);
  });
});

describe('syncQueue', () => {
  let testQueuePath: string;
  let queue: OfflineQueue;

  beforeEach(async () => {
    testQueuePath = path.join(os.tmpdir(), `test-sync-queue-${Date.now()}.json`);
    queue = new OfflineQueue(testQueuePath);
  });

  afterEach(async () => {
    try {
      await fs.unlink(testQueuePath);
    } catch {
      // Ignore
    }
  });

  it('should sync all messages successfully', async () => {
    await queue.enqueue({ message: 'Message 1' });
    await queue.enqueue({ message: 'Message 2' });
    await queue.enqueue({ message: 'Message 3' });

    const sentMessages: QueuedMessage[] = [];
    const result = await syncQueue(queue, async (msg) => {
      sentMessages.push(msg);
    });

    expect(result.success).toBe(3);
    expect(result.failed).toBe(0);
    expect(sentMessages).toHaveLength(3);
    expect(await queue.isEmpty()).toBe(true);
  });

  it('should handle failures and retry', async () => {
    await queue.enqueue({ message: 'Success' });
    await queue.enqueue({ message: 'Fail' });

    let attempts = 0;
    const result = await syncQueue(queue, async (msg) => {
      attempts++;
      if (msg.message === 'Fail') {
        throw new Error('Send failed');
      }
    });

    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
    expect(attempts).toBe(2);

    // Failed message should still be in queue with incremented retry count
    const remaining = await queue.getAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.message).toBe('Fail');
    expect(remaining[0]!.retries).toBe(1);
  });

  it('should remove messages after 3 failed retries', async () => {
    // @ts-expect-error unused variable
    const _messageId = await queue.enqueue({ message: 'Fail' });

    // Set retries to 2 (so next failure will be 3rd retry)
    const messages = await queue.getAll();
    messages[0]!.retries = 2;
    await fs.writeFile(testQueuePath, JSON.stringify(messages), { mode: 0o600 });

    await syncQueue(queue, async (_msg) => {
      throw new Error('Send failed');
    });

    // Message should be removed after 3rd failure
    const remaining = await queue.getAll();
    expect(remaining).toHaveLength(0);
  });

  it('should call progress callback', async () => {
    await queue.enqueue({ message: 'Message 1' });
    await queue.enqueue({ message: 'Message 2' });

    const progressCalls: Array<{ current: number; total: number }> = [];

    await syncQueue(
      queue,
      async (_msg) => {
        // Success
      },
      (current, total) => {
        progressCalls.push({ current, total });
      }
    );

    expect(progressCalls).toHaveLength(2);
    expect(progressCalls[0]).toEqual({ current: 1, total: 2 });
    expect(progressCalls[1]).toEqual({ current: 2, total: 2 });
  });
});
