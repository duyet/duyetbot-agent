/**
 * Offline Queue Manager for CLI
 *
 * Queues messages when offline and syncs when connection is restored
 */

import { webcrypto } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

// Use Node.js crypto for compatibility with Node 18
const crypto = webcrypto as unknown as Crypto;

export interface QueuedMessage {
  id: string;
  sessionId?: string | undefined;
  message: string;
  model?: string | undefined;
  timestamp: number;
  retries: number;
}

export interface OfflineQueueStats {
  totalMessages: number;
  oldestMessage?: number | undefined;
  newestMessage?: number | undefined;
}

/**
 * Offline Queue Manager
 */
export class OfflineQueue {
  private queuePath: string;

  constructor(queuePath?: string) {
    this.queuePath = queuePath || path.join(os.homedir(), '.duyetbot', 'offline-queue.json');
  }

  /**
   * Get queue file path
   */
  getQueuePath(): string {
    return this.queuePath;
  }

  /**
   * Ensure queue directory exists
   */
  private async ensureQueueDirectory(): Promise<void> {
    const dir = path.dirname(this.queuePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Load queue from disk
   */
  private async loadQueue(): Promise<QueuedMessage[]> {
    try {
      await this.ensureQueueDirectory();
      const data = await fs.readFile(this.queuePath, 'utf-8');
      return JSON.parse(data);
    } catch (_error) {
      // Queue file doesn't exist or is invalid
      return [];
    }
  }

  /**
   * Save queue to disk
   */
  private async saveQueue(queue: QueuedMessage[]): Promise<void> {
    await this.ensureQueueDirectory();
    await fs.writeFile(this.queuePath, JSON.stringify(queue, null, 2), {
      mode: 0o600,
    });
  }

  /**
   * Add message to queue
   */
  async enqueue(message: Omit<QueuedMessage, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    const queue = await this.loadQueue();

    const queuedMessage: QueuedMessage = {
      id: crypto.randomUUID(),
      sessionId: message.sessionId,
      message: message.message,
      model: message.model,
      timestamp: Date.now(),
      retries: 0,
    };

    queue.push(queuedMessage);
    await this.saveQueue(queue);

    return queuedMessage.id;
  }

  /**
   * Get all queued messages
   */
  async getAll(): Promise<QueuedMessage[]> {
    return await this.loadQueue();
  }

  /**
   * Get next message to process
   */
  async peek(): Promise<QueuedMessage | null> {
    const queue = await this.loadQueue();
    return queue.length > 0 ? queue[0] : null;
  }

  /**
   * Remove message from queue
   */
  async dequeue(messageId: string): Promise<boolean> {
    const queue = await this.loadQueue();
    const index = queue.findIndex((msg) => msg.id === messageId);

    if (index === -1) {
      return false;
    }

    queue.splice(index, 1);
    await this.saveQueue(queue);
    return true;
  }

  /**
   * Increment retry count for a message
   */
  async incrementRetry(messageId: string): Promise<boolean> {
    const queue = await this.loadQueue();
    const message = queue.find((msg) => msg.id === messageId);

    if (!message) {
      return false;
    }

    message.retries++;
    await this.saveQueue(queue);
    return true;
  }

  /**
   * Clear all messages from queue
   */
  async clear(): Promise<void> {
    await this.saveQueue([]);
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<OfflineQueueStats> {
    const queue = await this.loadQueue();

    if (queue.length === 0) {
      return { totalMessages: 0 };
    }

    const timestamps = queue.map((msg) => msg.timestamp);

    return {
      totalMessages: queue.length,
      oldestMessage: Math.min(...timestamps),
      newestMessage: Math.max(...timestamps),
    };
  }

  /**
   * Remove old messages (older than maxAge milliseconds)
   */
  async pruneOldMessages(maxAge: number): Promise<number> {
    const queue = await this.loadQueue();
    const cutoff = Date.now() - maxAge;

    const filtered = queue.filter((msg) => msg.timestamp >= cutoff);
    const removed = queue.length - filtered.length;

    if (removed > 0) {
      await this.saveQueue(filtered);
    }

    return removed;
  }

  /**
   * Check if queue is empty
   */
  async isEmpty(): Promise<boolean> {
    const queue = await this.loadQueue();
    return queue.length === 0;
  }

  /**
   * Get queue size
   */
  async size(): Promise<number> {
    const queue = await this.loadQueue();
    return queue.length;
  }
}

/**
 * Check if we can reach the API
 */
export async function isOnline(apiUrl: string, timeout = 5000): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}

/**
 * Sync queued messages to server
 */
export async function syncQueue(
  queue: OfflineQueue,
  sendMessage: (message: QueuedMessage) => Promise<void>,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  const messages = await queue.getAll();
  let success = 0;
  let failed = 0;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    try {
      await sendMessage(message);
      await queue.dequeue(message.id);
      success++;
    } catch (_error) {
      await queue.incrementRetry(message.id);
      failed++;

      // Remove messages that have failed too many times (after incrementing)
      if (message.retries >= 2) {
        // After increment, this will be >= 3
        await queue.dequeue(message.id);
      }
    }

    if (onProgress) {
      onProgress(i + 1, messages.length);
    }
  }

  return { success, failed };
}
