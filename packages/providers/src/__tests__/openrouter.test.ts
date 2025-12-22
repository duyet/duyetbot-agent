import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOpenRouterProvider } from '../openrouter.js';

describe('OpenRouter Provider', () => {
  const mockFetch = vi.fn();
  const mockGetUrl = vi.fn().mockResolvedValue('https://gateway.example.com');
  const mockEnv = {
    AI: {
      gateway: () => ({ getUrl: mockGetUrl }),
    },
    AI_GATEWAY_NAME: 'test-gateway',
    AI_GATEWAY_API_KEY: 'test-key',
    MODEL: 'test-model',
  };

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    // Reset mocks
    mockFetch.mockReset();
    mockGetUrl.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send correct request to AI Gateway', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hello' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });

    const provider = createOpenRouterProvider(mockEnv as any);
    const response = await provider.chat([{ role: 'user', content: 'Hi' }]);

    expect(response.content).toBe('Hello');
    expect(mockGetUrl).toHaveBeenCalledWith('openrouter');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://gateway.example.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'cf-aig-authorization': 'Bearer test-key',
        }),
        body: expect.stringContaining('"model":"test-model"'),
      })
    );
  });

  it('should handle tool calls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  type: 'function',
                  function: { name: 'test_tool', arguments: '{}' },
                },
              ],
            },
          },
        ],
      }),
    });

    const provider = createOpenRouterProvider(mockEnv as any);
    const response = await provider.chat(
      [{ role: 'user', content: 'Use tool' }],
      [{ type: 'function', function: { name: 'test_tool', description: 'desc', parameters: {} } }]
    );

    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls![0].name).toBe('test_tool');
  });

  it('should handle streaming responses', async () => {
    const streamData = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" World"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    // Mock ReadableStream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        streamData.forEach((chunk) => {
          controller.enqueue(encoder.encode(chunk));
        });
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      body: stream,
    });

    const provider = createOpenRouterProvider(mockEnv as any);
    const generator = provider.streamChat!([{ role: 'user', content: 'Hi' }]);

    const chunks: string[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk.content);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[chunks.length - 1]).toBe('Hello World');
  });

  it('should handle errors gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const provider = createOpenRouterProvider(mockEnv as any);
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
      'OpenRouter error: HTTP 500: Internal Server Error'
    );
  });
});
