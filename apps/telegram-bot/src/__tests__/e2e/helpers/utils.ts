/**
 * Utility functions for E2E tests
 *
 * Provides helpers for working with Durable Objects and creating test requests
 */

import { env } from 'cloudflare:test';
import type { TelegramUpdate } from './fixtures.js';

/**
 * Get a Durable Object stub for testing
 *
 * Creates a stub using the session ID format: telegram:{userId}:{chatId}
 *
 * @param userId - Telegram user ID
 * @param chatId - Telegram chat ID
 * @returns DurableObjectStub for the TelegramAgent
 *
 * @example
 * ```typescript
 * const stub = getAgentStub(12345, 12345);
 * const response = await stub.fetch(request);
 * ```
 */
export function getAgentStub(userId: number, chatId: number) {
  const sessionId = `telegram:${userId}:${chatId}`;
  const id = env.TelegramAgent.idFromName(sessionId);
  return env.TelegramAgent.get(id);
}

/**
 * Create a webhook Request object for testing
 *
 * Creates a properly formatted POST request to the /webhook endpoint
 *
 * @param body - Telegram Update object (webhook payload)
 * @param options - Optional configuration
 * @returns Request object ready for testing
 *
 * @example
 * ```typescript
 * const update = createUpdate({ text: "Hello" });
 * const request = createWebhookRequest(update);
 * const response = await app.fetch(request, env);
 * ```
 */
export function createWebhookRequest(
  body: TelegramUpdate,
  options: {
    /** Custom webhook secret for authentication */
    webhookSecret?: string;
    /** Base URL for the worker */
    baseUrl?: string;
  } = {}
): Request {
  const { baseUrl = 'https://telegram-bot.test' } = options;

  const url = new URL('/webhook', baseUrl);

  return new Request(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Telegram webhook secret header (if configured)
      ...(options.webhookSecret && {
        'X-Telegram-Bot-Api-Secret-Token': options.webhookSecret,
      }),
    },
    body: JSON.stringify(body),
  });
}

/**
 * Create a health check request
 *
 * @param baseUrl - Base URL for the worker
 * @returns Request object for health endpoint
 */
export function createHealthRequest(baseUrl = 'https://telegram-bot.test'): Request {
  return new Request(new URL('/health', baseUrl).toString(), {
    method: 'GET',
  });
}

/**
 * Wait for a condition with timeout
 *
 * Useful for waiting for async operations in tests
 *
 * @param condition - Function that returns true when condition is met
 * @param timeout - Maximum time to wait (ms)
 * @param interval - Check interval (ms)
 * @returns Promise that resolves when condition is met
 * @throws Error if timeout is exceeded
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`waitFor timeout after ${timeout}ms`);
}

/**
 * Extract JSON from a Response object
 *
 * @param response - Fetch Response object
 * @returns Parsed JSON body
 */
export async function getResponseJson<T = unknown>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

/**
 * Assert that a response is OK (2xx status)
 *
 * @param response - Fetch Response object
 * @param message - Optional error message
 */
export function assertOk(response: Response, message?: string): void {
  if (!response.ok) {
    throw new Error(message || `Expected OK response, got ${response.status}`);
  }
}
