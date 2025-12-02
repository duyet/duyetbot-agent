/**
 * Minimal test worker for E2E tests
 *
 * This worker is used instead of the full telegram-bot worker
 * to avoid bundling issues with CJS dependencies (ajv, etc.)
 * that are not compatible with the workerd runtime.
 *
 * Supports:
 * - Webhook message handling
 * - Command processing (/start, /help, /clear)
 * - User authorization
 * - Batch processing with alarm-based queue
 * - Storage operations for testing
 */

import { DurableObject } from 'cloudflare:workers';

export interface Env {
  TelegramAgent: import('@cloudflare/workers-types').DurableObjectNamespace;
  ENVIRONMENT: string;
  MODEL: string;
  AI_GATEWAY_NAME: string;
  AI_GATEWAY_PROVIDER: string;
  TELEGRAM_ADMIN: string;
  TELEGRAM_ALLOWED_USERS: string;
}

/** Message queued for batch processing */
interface QueuedMessage {
  id: number;
  text: string;
  userId: number;
  chatId: number;
  timestamp: number;
}

/** Batch processing configuration */
const BATCH_WINDOW_MS = 500; // 500ms batching window

/**
 * Test Durable Object with batch processing support
 *
 * Implements alarm-based message batching for E2E testing
 */
export class TelegramAgent extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle incoming message (queue for batch processing)
    if (url.pathname === '/message') {
      const body = (await request.json()) as QueuedMessage;
      return this.queueMessage(body);
    }

    // Get current queue state
    if (url.pathname === '/queue') {
      const queue = (await this.ctx.storage.get<QueuedMessage[]>('messageQueue')) || [];
      return new Response(JSON.stringify({ queue, length: queue.length }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get processed batches
    if (url.pathname === '/batches') {
      const batches = (await this.ctx.storage.get<QueuedMessage[][]>('processedBatches')) || [];
      return new Response(JSON.stringify({ batches, count: batches.length }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Clear state for test isolation
    if (url.pathname === '/reset') {
      await this.ctx.storage.deleteAll();
      this.messageQueue = [];
      this.processedBatches = [];
      return new Response(JSON.stringify({ status: 'reset' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('TelegramAgent test stub', { status: 200 });
  }

  /**
   * Queue a message for batch processing
   * Sets an alarm if one is not already scheduled
   */
  private async queueMessage(message: QueuedMessage): Promise<Response> {
    // Load existing queue from storage
    const queue = (await this.ctx.storage.get<QueuedMessage[]>('messageQueue')) || [];

    // Add message to queue with timestamp
    const queuedMessage: QueuedMessage = {
      ...message,
      timestamp: Date.now(),
    };
    queue.push(queuedMessage);
    await this.ctx.storage.put('messageQueue', queue);

    // Schedule alarm if not already set
    const existingAlarm = await this.ctx.storage.getAlarm();
    if (existingAlarm === null) {
      await this.ctx.storage.setAlarm(Date.now() + BATCH_WINDOW_MS);
    }

    return new Response(
      JSON.stringify({
        queued: true,
        batchId: `batch-${Date.now()}`,
        queueLength: queue.length,
        alarmScheduled: existingAlarm === null,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Alarm handler - processes the message batch
   */
  async alarm(): Promise<void> {
    // Get queued messages
    const queue = (await this.ctx.storage.get<QueuedMessage[]>('messageQueue')) || [];

    if (queue.length === 0) {
      return;
    }

    // Process the batch (store in processed batches)
    const processedBatches =
      (await this.ctx.storage.get<QueuedMessage[][]>('processedBatches')) || [];
    processedBatches.push([...queue]);
    await this.ctx.storage.put('processedBatches', processedBatches);

    // Clear the queue
    await this.ctx.storage.put('messageQueue', []);
  }
}

/** Telegram webhook update structure (simplified) */
interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string };
    chat: { id: number };
    text?: string;
  };
}

/**
 * Check if user is authorized based on TELEGRAM_ALLOWED_USERS env var
 */
function isUserAuthorized(env: Env, userId: number): boolean {
  if (!env.TELEGRAM_ALLOWED_USERS) {
    return true;
  }

  const allowed = env.TELEGRAM_ALLOWED_USERS.split(',')
    .map((id) => Number.parseInt(id.trim(), 10))
    .filter((id) => !Number.isNaN(id));

  if (allowed.length === 0) {
    return true;
  }

  return allowed.includes(userId);
}

/**
 * Check if user is admin
 */
function isAdmin(env: Env, username?: string): boolean {
  if (!env.TELEGRAM_ADMIN || !username) {
    return false;
  }
  return env.TELEGRAM_ADMIN.toLowerCase() === username.toLowerCase();
}

/**
 * Handle bot commands
 */
function handleCommand(
  command: string,
  env: Env,
  username?: string
): { response: string; handled: boolean } {
  const userIsAdmin = isAdmin(env, username);

  switch (command) {
    case '/start':
      return {
        response: 'Welcome! I am DuyetBot. How can I help you today?',
        handled: true,
      };
    case '/help':
      return {
        response:
          'Available commands:\n/start - Start conversation\n/help - Show this help\n/clear - Clear conversation history',
        handled: true,
      };
    case '/clear':
      return {
        response: 'Conversation history cleared.',
        handled: true,
      };
    case '/debug':
      if (!userIsAdmin) {
        return { response: 'Admin command - access denied', handled: true };
      }
      return {
        response: 'Debug information: System operational',
        handled: true,
      };
    case '/status':
      if (!userIsAdmin) {
        return { response: 'Admin command - access denied', handled: true };
      }
      return { response: 'Status: All systems operational', handled: true };
    default:
      return { response: '', handled: false };
  }
}

/**
 * Minimal worker for testing environment bindings and webhook flows
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          environment: env.ENVIRONMENT,
          model: env.MODEL,
          admin: env.TELEGRAM_ADMIN,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.pathname === '/test-do') {
      // Test Durable Object access
      const id = env.TelegramAgent.idFromName('test-session');
      const stub = env.TelegramAgent.get(id);
      const response = await stub.fetch(new Request('http://do/health'));
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle webhook requests (Telegram-style)
    if (url.pathname === '/webhook' && request.method === 'POST') {
      // Parse request body
      let update: TelegramUpdate;
      try {
        const text = await request.text();
        if (!text) {
          // Empty body - skip gracefully
          return new Response('OK');
        }
        update = JSON.parse(text);
      } catch {
        // Invalid JSON - skip gracefully
        return new Response('OK');
      }

      // Skip if no message
      if (!update.message) {
        return new Response('OK');
      }

      const { from, chat, message_id, text } = update.message;
      const userId = from.id;
      const chatId = chat.id;
      const username = from.username;

      // Skip if missing text
      if (!text) {
        return new Response('OK');
      }

      // Check authorization
      if (!isUserAuthorized(env, userId)) {
        return new Response(
          JSON.stringify({
            ok: true,
            rejected: true,
            reason: 'unauthorized',
            userId,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Handle commands
      if (text.startsWith('/')) {
        const { response, handled } = handleCommand(text, env, username);
        if (handled) {
          const userIsAdmin = isAdmin(env, username);
          return new Response(
            JSON.stringify({
              ok: true,
              command: text,
              response,
              isAdmin: userIsAdmin,
              // Include debug footer for admin users
              debugFooter: userIsAdmin ? `Debug: userId=${userId}, chatId=${chatId}` : undefined,
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // Route to the appropriate Durable Object
      const sessionId = `telegram:${userId}:${chatId}`;
      const id = env.TelegramAgent.idFromName(sessionId);
      const stub = env.TelegramAgent.get(id);

      // Queue the message in the DO
      const queueResponse = await stub.fetch(
        new Request('http://do/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: message_id,
            text,
            userId,
            chatId,
          }),
        })
      );

      const queueResult = (await queueResponse.json()) as Record<string, unknown>;

      // Acknowledge with queue info
      return new Response(
        JSON.stringify({
          ok: true,
          queued: true,
          ...queueResult,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Test worker', { status: 200 });
  },
};
