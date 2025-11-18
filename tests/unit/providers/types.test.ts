import {
  type LLMMessage,
  type LLMProvider,
  LLMProviderError,
  type LLMResponse,
  type ProviderConfig,
  formatProvider,
  parseProviderFormat,
} from '@providers/types';
import { describe, expect, it } from 'vitest';

describe('Provider Types', () => {
  describe('ProviderConfig', () => {
    it('should have required provider and model fields', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-key',
      };

      expect(config.provider).toBe('claude');
      expect(config.model).toBe('claude-3-5-sonnet-20241022');
      expect(config.apiKey).toBe('test-key');
    });

    it('should support optional parameters', () => {
      const config: ProviderConfig = {
        provider: 'openai',
        model: 'gpt-4-turbo',
        apiKey: 'test-key',
        temperature: 0.7,
        maxTokens: 4096,
        timeout: 30000,
      };

      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(4096);
      expect(config.timeout).toBe(30000);
    });
  });

  describe('LLMMessage', () => {
    it('should support user messages', () => {
      const message: LLMMessage = {
        role: 'user',
        content: 'Hello, how are you?',
      };

      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, how are you?');
    });

    it('should support assistant messages', () => {
      const message: LLMMessage = {
        role: 'assistant',
        content: 'I am doing well, thank you!',
      };

      expect(message.role).toBe('assistant');
      expect(message.content).toBe('I am doing well, thank you!');
    });

    it('should support system messages', () => {
      const message: LLMMessage = {
        role: 'system',
        content: 'You are a helpful assistant.',
      };

      expect(message.role).toBe('system');
      expect(message.content).toBe('You are a helpful assistant.');
    });
  });

  describe('LLMResponse', () => {
    it('should have content and metadata', () => {
      const response: LLMResponse = {
        content: 'This is the response',
        model: 'claude-3-5-sonnet-20241022',
        provider: 'claude',
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
        },
      };

      expect(response.content).toBe('This is the response');
      expect(response.model).toBe('claude-3-5-sonnet-20241022');
      expect(response.provider).toBe('claude');
      expect(response.usage.totalTokens).toBe(15);
    });

    it('should support optional stop reason', () => {
      const response: LLMResponse = {
        content: 'Response',
        model: 'gpt-4',
        provider: 'openai',
        stopReason: 'end_turn',
        usage: {
          inputTokens: 5,
          outputTokens: 3,
          totalTokens: 8,
        },
      };

      expect(response.stopReason).toBe('end_turn');
    });
  });
});

describe('LLMProvider Interface', () => {
  it('should define query method', () => {
    // This test verifies the interface structure through TypeScript compilation
    const mockProvider: LLMProvider = {
      name: 'test-provider',
      query: async function* (_messages, options) {
        yield {
          content: 'test response',
          model: options?.model || 'default-model',
          provider: 'test',
          usage: {
            inputTokens: 1,
            outputTokens: 1,
            totalTokens: 2,
          },
        };
      },
      configure: (config) => {
        expect(config.provider).toBeDefined();
      },
    };

    expect(mockProvider.name).toBe('test-provider');
    expect(typeof mockProvider.query).toBe('function');
    expect(typeof mockProvider.configure).toBe('function');
  });

  it('should support streaming responses', async () => {
    const mockProvider: LLMProvider = {
      name: 'streaming-provider',
      query: async function* (_messages) {
        yield {
          content: 'First chunk',
          model: 'test-model',
          provider: 'test',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        };
        yield {
          content: 'Second chunk',
          model: 'test-model',
          provider: 'test',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        };
      },
      configure: () => {},
    };

    const responses = [];
    for await (const response of mockProvider.query([{ role: 'user', content: 'test' }])) {
      responses.push(response);
    }

    expect(responses).toHaveLength(2);
    expect(responses[0]?.content).toBe('First chunk');
    expect(responses[1]?.content).toBe('Second chunk');
  });
});

describe('Provider Format Parser', () => {
  describe('parseProviderFormat', () => {
    it('should parse Claude provider format', () => {
      const result = parseProviderFormat('claude:claude-3-5-sonnet-20241022');

      expect(result.provider).toBe('claude');
      expect(result.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.original).toBe('claude:claude-3-5-sonnet-20241022');
    });

    it('should parse OpenAI provider format', () => {
      const result = parseProviderFormat('openai:gpt-4-turbo');

      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4-turbo');
    });

    it('should parse OpenRouter provider format', () => {
      const result = parseProviderFormat('openrouter:anthropic/claude-3.5-sonnet');

      expect(result.provider).toBe('openrouter');
      expect(result.model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should trim whitespace', () => {
      const result = parseProviderFormat('  claude  :  claude-3-5-sonnet-20241022  ');

      expect(result.provider).toBe('claude');
      expect(result.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should throw error for invalid format without colon', () => {
      expect(() => parseProviderFormat('claude-3-5-sonnet')).toThrow('Invalid provider format');
    });

    it('should throw error for empty provider', () => {
      expect(() => parseProviderFormat(':claude-3-5-sonnet')).toThrow('Invalid provider format');
    });

    it('should throw error for empty model', () => {
      expect(() => parseProviderFormat('claude:')).toThrow('Invalid provider format');
    });

    it('should throw error for multiple colons', () => {
      expect(() => parseProviderFormat('claude:openai:gpt-4')).toThrow('Invalid provider format');
    });
  });

  describe('formatProvider', () => {
    it('should format provider and model', () => {
      const result = formatProvider('claude', 'claude-3-5-sonnet-20241022');

      expect(result).toBe('claude:claude-3-5-sonnet-20241022');
    });

    it('should format OpenAI provider', () => {
      const result = formatProvider('openai', 'gpt-4-turbo');

      expect(result).toBe('openai:gpt-4-turbo');
    });

    it('should format OpenRouter provider with slash in model', () => {
      const result = formatProvider('openrouter', 'anthropic/claude-3.5-sonnet');

      expect(result).toBe('openrouter:anthropic/claude-3.5-sonnet');
    });
  });
});

describe('LLMProviderError', () => {
  it('should create error with provider and message', () => {
    const error = new LLMProviderError('Test error', 'claude');

    expect(error.message).toBe('Test error');
    expect(error.provider).toBe('claude');
    expect(error.name).toBe('LLMProviderError');
  });

  it('should support error code and status code', () => {
    const error = new LLMProviderError('API error', 'openai', 'rate_limit', 429);

    expect(error.code).toBe('rate_limit');
    expect(error.statusCode).toBe(429);
  });

  it('should support cause error', () => {
    const cause = new Error('Network error');
    const error = new LLMProviderError('Failed to connect', 'claude', undefined, undefined, cause);

    expect(error.cause).toBe(cause);
  });
});
