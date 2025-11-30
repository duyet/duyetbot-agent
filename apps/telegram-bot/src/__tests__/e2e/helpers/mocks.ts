/**
 * Mock utilities for E2E tests
 *
 * Provides mock responses for external APIs (Telegram, LLM providers)
 * using Miniflare's fetch mock capabilities
 */

import { fetchMock } from 'cloudflare:test';

/**
 * Options for configuring mock behavior
 */
export interface MockOptions {
  /** Make Telegram API calls fail */
  telegramFail?: boolean;
  /** Make LLM provider calls fail */
  llmFail?: boolean;
  /** Custom LLM response content */
  llmResponse?: string;
}

/**
 * Captured request information for assertions
 */
export interface CapturedRequest {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

/** Store for captured requests */
const capturedRequests: CapturedRequest[] = [];

/**
 * Get all captured requests (for assertions)
 */
export function getCapturedRequests(): CapturedRequest[] {
  return [...capturedRequests];
}

/**
 * Get Telegram API requests only
 */
export function getTelegramRequests(): CapturedRequest[] {
  return capturedRequests.filter((r) => r.url.includes('api.telegram.org'));
}

/**
 * Get LLM provider requests only
 */
export function getLLMRequests(): CapturedRequest[] {
  return capturedRequests.filter(
    (r) => r.url.includes('gateway.ai.cloudflare.com') || r.url.includes('openrouter.ai')
  );
}

/**
 * Setup mocks for external API calls
 *
 * Must be called in beforeEach to configure mock behavior
 *
 * @param options - Configuration for mock behavior
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   setupMocks(); // Default: all APIs succeed
 * });
 *
 * it("handles Telegram API failure", async () => {
 *   setupMocks({ telegramFail: true });
 *   // ... test code
 * });
 * ```
 */
export function setupMocks(options: MockOptions = {}): void {
  const { telegramFail = false, llmFail = false, llmResponse } = options;

  // Activate the mock - this intercepts all fetch calls
  fetchMock.activate();

  // Clear captured requests
  capturedRequests.length = 0;

  // Disallow unmocked requests by default
  fetchMock.disableNetConnect();

  // Mock Telegram API endpoints
  setupTelegramMocks(telegramFail);

  // Mock LLM provider endpoints
  setupLLMMocks(llmFail, llmResponse);
}

/**
 * Setup Telegram API mocks
 */
function setupTelegramMocks(shouldFail: boolean): void {
  const baseUrl = 'https://api.telegram.org';

  // sendMessage endpoint
  fetchMock
    .get(baseUrl)
    .intercept({ path: /\/bot[^/]+\/sendMessage/, method: 'POST' })
    .reply(() => {
      if (shouldFail) {
        return {
          status: 500,
          body: JSON.stringify({
            ok: false,
            description: 'Internal Server Error',
          }),
        };
      }
      return {
        status: 200,
        body: JSON.stringify({
          ok: true,
          result: { message_id: Math.floor(Math.random() * 10000) },
        }),
      };
    })
    .persist();

  // editMessageText endpoint
  fetchMock
    .get(baseUrl)
    .intercept({ path: /\/bot[^/]+\/editMessageText/, method: 'POST' })
    .reply(() => {
      if (shouldFail) {
        return {
          status: 500,
          body: JSON.stringify({
            ok: false,
            description: 'Internal Server Error',
          }),
        };
      }
      return {
        status: 200,
        body: JSON.stringify({
          ok: true,
          result: { message_id: 1 },
        }),
      };
    })
    .persist();

  // sendChatAction endpoint (typing indicator)
  fetchMock
    .get(baseUrl)
    .intercept({ path: /\/bot[^/]+\/sendChatAction/, method: 'POST' })
    .reply(() => ({
      status: 200,
      body: JSON.stringify({ ok: true, result: true }),
    }))
    .persist();
}

/**
 * Setup LLM provider mocks (AI Gateway and OpenRouter)
 */
function setupLLMMocks(shouldFail: boolean, customResponse?: string): void {
  const defaultResponse = customResponse || 'Hello! How can I help you today?';

  // Mock AI Gateway (Cloudflare)
  const aiGatewayUrl = 'https://gateway.ai.cloudflare.com';
  fetchMock
    .get(aiGatewayUrl)
    .intercept({ path: /.*/, method: 'POST' })
    .reply(() => {
      if (shouldFail) {
        return {
          status: 500,
          body: JSON.stringify({ error: 'LLM service unavailable' }),
        };
      }
      return createLLMResponse(defaultResponse);
    })
    .persist();

  // Mock OpenRouter
  const openRouterUrl = 'https://openrouter.ai';
  fetchMock
    .get(openRouterUrl)
    .intercept({ path: /\/api\/v1\/chat\/completions/, method: 'POST' })
    .reply(() => {
      if (shouldFail) {
        return {
          status: 500,
          body: JSON.stringify({ error: 'LLM service unavailable' }),
        };
      }
      return createLLMResponse(defaultResponse);
    })
    .persist();
}

/**
 * Create a mock LLM response in OpenAI format
 */
function createLLMResponse(content: string): { status: number; body: string } {
  return {
    status: 200,
    body: JSON.stringify({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'x-ai/grok-4.1-fast',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    }),
  };
}

/**
 * Reset all mocks (call in afterEach)
 */
export function resetMocks(): void {
  fetchMock.deactivate();
  capturedRequests.length = 0;
}
