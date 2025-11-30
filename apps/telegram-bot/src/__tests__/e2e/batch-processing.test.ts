/**
 * Batch Processing E2E Tests
 *
 * Tests Durable Object batch processing with alarms.
 * Verifies that messages are properly queued and processed
 * within the configured batching window (500ms).
 *
 * Uses runInDurableObject for direct storage access to avoid
 * JSRPC isolated storage frame tracking issues.
 * See: https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/#isolated-storage
 */

import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { CHATS, USERS, resetFixtureCounters } from './helpers/fixtures';
import { getAgentStub } from './helpers/utils';

/** Message structure with extended fields */
interface QueuedMessage {
  id: number;
  text: string;
  userId?: number;
  chatId?: number;
  timestamp: number;
}

describe('Batch Processing E2E', () => {
  beforeEach(() => {
    resetFixtureCounters();
  });

  it('triggers alarm after single message', async () => {
    const stub = getAgentStub(USERS.authorized.id, CHATS.private.id);

    // Use runInDurableObject to directly manipulate storage
    await runInDurableObject(stub, async (instance) => {
      // Clear any existing state
      await instance.ctx.storage.deleteAll();

      // Add a message to the queue directly
      const message: QueuedMessage = {
        id: 1,
        text: 'Hello',
        userId: USERS.authorized.id,
        chatId: CHATS.private.id,
        timestamp: Date.now(),
      };
      await instance.ctx.storage.put('messageQueue', [message]);

      // Schedule an alarm
      await instance.ctx.storage.setAlarm(Date.now() + 500);

      // Verify message is in queue
      const queue = await instance.ctx.storage.get<QueuedMessage[]>('messageQueue');
      expect(queue).toHaveLength(1);
      expect(queue![0].text).toBe('Hello');

      // Verify alarm is scheduled
      const alarm = await instance.ctx.storage.getAlarm();
      expect(alarm).not.toBeNull();
    });

    // Trigger the alarm manually
    const alarmRan = await runDurableObjectAlarm(stub);
    expect(alarmRan).toBe(true);

    // Verify batch was processed
    await runInDurableObject(stub, async (instance) => {
      const batches = await instance.ctx.storage.get<QueuedMessage[][]>('processedBatches');
      expect(batches).toHaveLength(1);
      expect(batches![0]).toHaveLength(1);
      expect(batches![0][0].text).toBe('Hello');

      // Verify queue is now empty
      const queue = await instance.ctx.storage.get<QueuedMessage[]>('messageQueue');
      expect(queue).toEqual([]);
    });
  });

  it('batches rapid messages within 500ms window', async () => {
    const stub = getAgentStub(USERS.authorized.id, CHATS.private.id);
    const messages = ['First', 'Second', 'Third', 'Fourth'];

    // Use runInDurableObject to set up test state directly
    await runInDurableObject(stub, async (instance) => {
      // Clear any existing state
      await instance.ctx.storage.deleteAll();

      // Add all messages to queue (simulating rapid messages)
      const queue: QueuedMessage[] = messages.map((text, i) => ({
        id: i + 1,
        text,
        userId: USERS.authorized.id,
        chatId: CHATS.private.id,
        timestamp: Date.now() + i, // Slight offset to preserve order
      }));
      await instance.ctx.storage.put('messageQueue', queue);

      // Schedule alarm (as would happen with first message)
      await instance.ctx.storage.setAlarm(Date.now() + 500);

      // Verify all messages are queued
      const storedQueue = await instance.ctx.storage.get<QueuedMessage[]>('messageQueue');
      expect(storedQueue).toHaveLength(4);
      expect(storedQueue!.map((m) => m.text)).toEqual(messages);
    });

    // Trigger alarm - should process all messages as single batch
    const alarmRan = await runDurableObjectAlarm(stub);
    expect(alarmRan).toBe(true);

    // Verify single batch with all messages
    await runInDurableObject(stub, async (instance) => {
      const batches = await instance.ctx.storage.get<QueuedMessage[][]>('processedBatches');
      expect(batches).toHaveLength(1);
      expect(batches![0]).toHaveLength(4);
      expect(batches![0].map((m) => m.text)).toEqual(messages);

      // Verify queue is empty
      const queue = await instance.ctx.storage.get<QueuedMessage[]>('messageQueue');
      expect(queue).toEqual([]);
    });
  });

  it('processes batch when alarm fires', async () => {
    const stub = getAgentStub(USERS.authorized.id, CHATS.private.id);

    // Set up initial state using runInDurableObject
    await runInDurableObject(stub, async (instance) => {
      // Clear any existing state
      await instance.ctx.storage.deleteAll();

      // Queue a message
      const message: QueuedMessage = {
        id: 1,
        text: 'Test message',
        userId: USERS.authorized.id,
        chatId: CHATS.private.id,
        timestamp: Date.now(),
      };
      await instance.ctx.storage.put('messageQueue', [message]);

      // Schedule alarm
      await instance.ctx.storage.setAlarm(Date.now() + 500);

      // Verify initial state
      const queue = await instance.ctx.storage.get<QueuedMessage[]>('messageQueue');
      expect(queue).toBeDefined();
      expect(queue).toHaveLength(1);
      expect(queue![0].text).toBe('Test message');

      const alarm = await instance.ctx.storage.getAlarm();
      expect(alarm).not.toBeNull();
    });

    // Trigger alarm
    const alarmRan = await runDurableObjectAlarm(stub);
    expect(alarmRan).toBe(true);

    // Verify processing
    await runInDurableObject(stub, async (instance) => {
      // Queue should be empty after processing
      const queue = await instance.ctx.storage.get<QueuedMessage[]>('messageQueue');
      expect(queue).toEqual([]);

      // Processed batches should have one entry
      const batches = await instance.ctx.storage.get<QueuedMessage[][]>('processedBatches');
      expect(batches).toHaveLength(1);
      expect(batches![0][0].text).toBe('Test message');
    });
  });
});
