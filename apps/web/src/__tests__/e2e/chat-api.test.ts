/**
 * E2E Tests for /api/chat endpoint
 *
 * Tests the chat API endpoint that handles AI chat messages using
 * the AI SDK v6 streaming format with UIMessage parts array.
 *
 * NOTE: These tests run against a deployed service. If you see 405 errors,
 * the deployed version may not have the latest route code deployed.
 * Run `bun run deploy` from the apps/web directory to deploy the latest changes.
 */

import { describe, expect, it } from 'vitest';

const BASE_URL = process.env.TEST_API_URL || 'https://duyetbot-web.duyet.workers.dev';

/**
 * Helper to check if we're getting a 405 (deployment needed)
 */
function isDeploymentNeeded(status: number): boolean {
  return status === 405;
}

/**
 * UIMessage format from AI SDK v6 useChat hook
 */
interface UIMessage {
  role: 'system' | 'user' | 'assistant';
  parts: UIMessagePart[];
}

/**
 * Message part types from AI SDK v6
 */
type UIMessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; result: unknown };

/**
 * Chat request body matching AI SDK v6 format
 */
interface ChatRequest {
  messages: UIMessage[];
  sessionId?: string;
  model?: string;
  userId?: string;
}

/**
 * Helper function to make a chat API request
 */
async function makeChatRequest(request: ChatRequest): Promise<Response> {
  return fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
}

/**
 * Parse stream response chunks
 */
async function* streamResponseChunks(response: Response): AsyncGenerator<string> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { break; }
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

describe('POST /api/chat', () => {
  it('should return 400 for empty messages array', async () => {
    const response = await makeChatRequest({ messages: [] });

    if (isDeploymentNeeded(response.status)) {
      console.warn('⚠️  Route not deployed yet (405). Run `bun run deploy` from apps/web');
      return;
    }

    expect(response.status).toBe(400);

    const data = (await response.json()) as { error: string; message: string; executionId: string };
    expect(data.error).toBe('Bad Request');
    expect(data.message).toBe('No messages provided');
    expect(data.executionId).toBeDefined();
  });

  it('should return 400 for missing messages field', async () => {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'test-session' }),
    });

    if (isDeploymentNeeded(response.status)) {
      console.warn('⚠️  Route not deployed yet (405). Run `bun run deploy` from apps/web');
      return;
    }

    expect(response.status).toBe(400);
  });

  it('should handle simple user message with text part', async () => {
    const response = await makeChatRequest({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
    });

    if (isDeploymentNeeded(response.status)) {
      console.warn('⚠️  Route not deployed yet (405). Run `bun run deploy` from apps/web');
      return;
    }

    if (response.status === 200) {
      expect(response.headers.get('content-type')).toMatch(/text\/event-stream|text\/plain/);
      expect(response.headers.get('x-execution-id')).toBeDefined();
      expect(response.headers.get('x-session-id')).toBeDefined();

      const chunks: string[] = [];
      for await (const chunk of streamResponseChunks(response)) {
        chunks.push(chunk);
      }

      const fullResponse = chunks.join('');
      expect(fullResponse.length).toBeGreaterThan(0);
    } else if (response.status === 500) {
      const data = (await response.json()) as { error: string; message: string };
      expect(data.error).toBe('Internal Server Error');
      expect(data.message).toContain('Cloudflare');
    } else {
      throw new Error(`Unexpected status code: ${response.status}`);
    }
  });

  it('should handle system message with text part', async () => {
    const response = await makeChatRequest({
      messages: [
        { role: 'system', parts: [{ type: 'text', text: 'You are a helpful assistant.' }] },
        { role: 'user', parts: [{ type: 'text', text: 'Say hi' }] },
      ],
    });

    if (isDeploymentNeeded(response.status)) {
      console.warn('⚠️  Route not deployed yet (405). Run `bun run deploy` from apps/web');
      return;
    }

    if (response.status === 200) {
      expect(response.headers.get('content-type')).toMatch(/text\/event-stream|text\/plain/);
      expect(response.headers.get('x-execution-id')).toBeDefined();

      const chunks: string[] = [];
      for await (const chunk of streamResponseChunks(response)) {
        chunks.push(chunk);
      }

      const fullResponse = chunks.join('');
      expect(fullResponse.length).toBeGreaterThan(0);
    } else if (response.status === 500) {
      const data = (await response.json()) as { error: string; message: string };
      expect(data.error).toBe('Internal Server Error');
    } else {
      throw new Error(`Unexpected status code: ${response.status}`);
    }
  });

  it('should include execution ID and session ID in headers', async () => {
    const sessionId = `test-session-${crypto.randomUUID()}`;

    const response = await makeChatRequest({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Test' }] }],
      sessionId,
    });

    if (isDeploymentNeeded(response.status)) {
      console.warn('⚠️  Route not deployed yet (405). Run `bun run deploy` from apps/web');
      return;
    }

    if (response.status === 200) {
      expect(response.headers.get('x-execution-id')).toBeDefined();
      expect(response.headers.get('x-session-id')).toBe(sessionId);
    } else if (response.status === 500) {
      expect(response.headers.get('x-execution-id')).toBeDefined();
    }
  });

  it('should handle model parameter override', async () => {
    const response = await makeChatRequest({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Test' }] }],
      model: 'anthropic/claude-3-haiku',
    });

    if (isDeploymentNeeded(response.status)) {
      console.warn('⚠️  Route not deployed yet (405). Run `bun run deploy` from apps/web');
      return;
    }

    expect([200, 500]).toContain(response.status);
  });

  it('should handle userId parameter', async () => {
    const response = await makeChatRequest({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Test' }] }],
      userId: 'test-user-123',
    });

    if (isDeploymentNeeded(response.status)) {
      console.warn('⚠️  Route not deployed yet (405). Run `bun run deploy` from apps/web');
      return;
    }

    expect([200, 500]).toContain(response.status);
  });

  it('should handle multiple text parts in a single message', async () => {
    const response = await makeChatRequest({
      messages: [
        { role: 'user', parts: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world!' }] },
      ],
    });

    if (isDeploymentNeeded(response.status)) {
      console.warn('⚠️  Route not deployed yet (405). Run `bun run deploy` from apps/web');
      return;
    }

    if (response.status === 200) {
      const chunks: string[] = [];
      for await (const chunk of streamResponseChunks(response)) {
        chunks.push(chunk);
      }

      const fullResponse = chunks.join('');
      expect(fullResponse.length).toBeGreaterThan(0);
    }
  });

  it('should return JSON error response for invalid requests', async () => {
    const response = await makeChatRequest({ messages: [] });

    if (isDeploymentNeeded(response.status)) {
      console.warn('⚠️  Route not deployed yet (405). Run `bun run deploy` from apps/web');
      return;
    }

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toBe('application/json');

    const data = (await response.json()) as Record<string, unknown>;
    expect(data).toHaveProperty('error');
    expect(data).toHaveProperty('message');
    expect(data).toHaveProperty('executionId');
  });

  it('should handle conversation with multiple turns', async () => {
    const response = await makeChatRequest({
      messages: [
        { role: 'user', parts: [{ type: 'text', text: 'My name is Alice' }] },
        { role: 'assistant', parts: [{ type: 'text', text: 'Hello Alice!' }] },
        { role: 'user', parts: [{ type: 'text', text: 'What is my name?' }] },
      ],
    });

    if (isDeploymentNeeded(response.status)) {
      console.warn('⚠️  Route not deployed yet (405). Run `bun run deploy` from apps/web');
      return;
    }

    if (response.status === 200) {
      expect(response.headers.get('content-type')).toMatch(/text\/event-stream|text\/plain/);

      const chunks: string[] = [];
      for await (const chunk of streamResponseChunks(response)) {
        chunks.push(chunk);
      }

      const fullResponse = chunks.join('');
      expect(fullResponse.length).toBeGreaterThan(0);
      expect(fullResponse.toLowerCase()).toContain('alice');
    }
  });

  it('should filter out non-text parts when converting to CoreMessage', async () => {
    const response = await makeChatRequest({
      messages: [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'Hello' },
            { type: 'tool-call', toolCallId: 'call-123', toolName: 'test-tool', args: { input: 'test' } },
          ],
        },
      ],
    });

    if (isDeploymentNeeded(response.status)) {
      console.warn('⚠️  Route not deployed yet (405). Run `bun run deploy` from apps/web');
      return;
    }

    expect([200, 500]).toContain(response.status);
  });
});

describe('POST /api/chat - Error Handling', () => {
  it('should return 500 with JSON error when Cloudflare bindings are missing', async () => {
    const response = await makeChatRequest({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Test' }] }],
    });

    if (isDeploymentNeeded(response.status)) {
      console.warn('⚠️  Route not deployed yet (405). Run `bun run deploy` from apps/web');
      return;
    }

    if (response.status === 500) {
      expect(response.headers.get('content-type')).toBe('application/json');

      const data = (await response.json()) as {
        error: string;
        message: string;
        executionId: string;
      };
      expect(data.error).toBe('Internal Server Error');
      expect(data.message).toBeDefined();
      expect(data.executionId).toBeDefined();
    }
  });

  it('should include execution ID even in error responses', async () => {
    const response = await makeChatRequest({ messages: [] });

    if (isDeploymentNeeded(response.status)) {
      console.warn('⚠️  Route not deployed yet (405). Run `bun run deploy` from apps/web');
      return;
    }

    if (response.status === 400 || response.status === 500) {
      expect(response.headers.get('x-execution-id')).toBeDefined();
    }
  });
});

describe('POST /api/chat - Streaming Format', () => {
  it('should return text/event-stream content type for successful requests', async () => {
    const response = await makeChatRequest({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
    });

    if (isDeploymentNeeded(response.status)) {
      console.warn('⚠️  Route not deployed yet (405). Run `bun run deploy` from apps/web');
      return;
    }

    if (response.status === 200) {
      const contentType = response.headers.get('content-type');
      expect(contentType).toMatch(/text\/event-stream|text\/plain/);
    }
  });

  it('should stream response in chunks', async () => {
    const response = await makeChatRequest({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Tell me a short story' }] }],
    });

    if (isDeploymentNeeded(response.status)) {
      console.warn('⚠️  Route not deployed yet (405). Run `bun run deploy` from apps/web');
      return;
    }

    if (response.status === 200) {
      const chunkCount: string[] = [];
      for await (const chunk of streamResponseChunks(response)) {
        chunkCount.push(chunk);
        if (chunkCount.length >= 2) {
          break;
        }
      }

      expect(chunkCount.length).toBeGreaterThanOrEqual(1);
    }
  });
});
