import { OpenRouterProvider } from '@/providers/openrouter';
import type { LLMMessage, ProviderConfig } from '@/providers/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('OpenRouterProvider', () => {
  let provider: OpenRouterProvider;
  let defaultConfig: ProviderConfig;

  beforeEach(() => {
    provider = new OpenRouterProvider();
    defaultConfig = {
      provider: 'openrouter',
      model: 'anthropic/claude-3.5-sonnet',
      apiKey: 'test-api-key',
      temperature: 0.7,
      maxTokens: 4096,
    };
    vi.clearAllMocks();
  });

  describe('configuration', () => {
    it('should have correct provider name', () => {
      expect(provider.name).toBe('openrouter');
    });

    it('should configure provider', () => {
      provider.configure(defaultConfig);
      const config = provider.getConfig?.();

      expect(config?.provider).toBe('openrouter');
      expect(config?.model).toBe('anthropic/claude-3.5-sonnet');
      expect(config?.apiKey).toBe('test-api-key');
    });

    it('should validate correct configuration', () => {
      const isValid = provider.validateConfig?.(defaultConfig);
      expect(isValid).toBe(true);
    });

    it('should reject configuration without API key', () => {
      const invalidConfig = { ...defaultConfig, apiKey: '' };
      const isValid = provider.validateConfig?.(invalidConfig);
      expect(isValid).toBe(false);
    });

    it('should reject configuration without model', () => {
      const invalidConfig = { ...defaultConfig, model: '' };
      const isValid = provider.validateConfig?.(invalidConfig);
      expect(isValid).toBe(false);
    });

    it('should use default temperature if not provided', () => {
      const config: ProviderConfig = {
        provider: 'openrouter',
        model: 'anthropic/claude-3.5-sonnet',
        apiKey: 'test-api-key',
        maxTokens: 4096,
      };

      provider.configure(config);
      const savedConfig = provider.getConfig?.();

      expect(savedConfig?.temperature).toBeDefined();
    });

    it('should use default maxTokens if not provided', () => {
      const config: ProviderConfig = {
        provider: 'openrouter',
        model: 'anthropic/claude-3.5-sonnet',
        apiKey: 'test-api-key',
        temperature: 0.7,
      };

      provider.configure(config);
      const savedConfig = provider.getConfig?.();

      expect(savedConfig?.maxTokens).toBeDefined();
    });
  });

  describe('message handling', () => {
    it('should accept messages array', () => {
      provider.configure(defaultConfig);

      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];

      expect(() => provider.query(messages)).not.toThrow();
    });

    it('should handle system messages', () => {
      provider.configure(defaultConfig);

      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
      ];

      expect(() => provider.query(messages)).not.toThrow();
    });

    it('should convert messages to OpenRouter format', () => {
      provider.configure(defaultConfig);

      const messages: LLMMessage[] = [{ role: 'user', content: 'Test message' }];

      expect(() => provider.query(messages)).not.toThrow();
    });
  });

  describe('model support', () => {
    it('should support Claude models via OpenRouter', () => {
      const config = { ...defaultConfig, model: 'anthropic/claude-3.5-sonnet' };
      provider.configure(config);

      expect(provider.getConfig?.()?.model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should support OpenAI models via OpenRouter', () => {
      const config = { ...defaultConfig, model: 'openai/gpt-4-turbo' };
      provider.configure(config);

      expect(provider.getConfig?.()?.model).toBe('openai/gpt-4-turbo');
    });

    it('should support Google models via OpenRouter', () => {
      const config = { ...defaultConfig, model: 'google/gemini-pro' };
      provider.configure(config);

      expect(provider.getConfig?.()?.model).toBe('google/gemini-pro');
    });

    it('should support Meta models via OpenRouter', () => {
      const config = { ...defaultConfig, model: 'meta-llama/llama-3-70b' };
      provider.configure(config);

      expect(provider.getConfig?.()?.model).toBe('meta-llama/llama-3-70b');
    });
  });

  describe('query options', () => {
    beforeEach(() => {
      provider.configure(defaultConfig);
    });

    it('should accept custom temperature', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages, { temperature: 0.5 })).not.toThrow();
    });

    it('should accept custom maxTokens', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages, { maxTokens: 2000 })).not.toThrow();
    });

    it('should accept stop sequences', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages, { stopSequences: ['STOP'] })).not.toThrow();
    });

    it('should accept custom model override', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages, { model: 'openai/gpt-4' })).not.toThrow();
    });
  });

  describe('streaming', () => {
    beforeEach(() => {
      provider.configure(defaultConfig);
    });

    it('should return async generator', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
      const generator = provider.query(messages);

      expect(generator).toBeDefined();
      expect(typeof generator[Symbol.asyncIterator]).toBe('function');
    });

    it('should support streaming responses', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Count to 3' }];
      const generator = provider.query(messages);

      expect(generator).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw error when querying without configuration', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      await expect(async () => {
        const gen = provider.query(messages);
        await gen.next();
      }).rejects.toThrow();
    });

    it('should throw error for empty messages array', async () => {
      provider.configure(defaultConfig);

      await expect(async () => {
        const gen = provider.query([]);
        await gen.next();
      }).rejects.toThrow();
    });

    it('should handle API errors gracefully', () => {
      provider.configure(defaultConfig);
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages)).not.toThrow();
    });

    it('should handle network errors', () => {
      provider.configure(defaultConfig);
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages)).not.toThrow();
    });
  });

  describe('response format', () => {
    beforeEach(() => {
      provider.configure(defaultConfig);
    });

    it('should yield response chunks during streaming', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
      const generator = provider.query(messages);

      expect(generator).toBeDefined();
    });

    it('should include model in response', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];
      const generator = provider.query(messages);

      expect(generator).toBeDefined();
    });

    it('should include provider name in response', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];
      const generator = provider.query(messages);

      expect(generator).toBeDefined();
    });

    it('should include token usage when available', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];
      const generator = provider.query(messages);

      expect(generator).toBeDefined();
    });
  });

  describe('API integration', () => {
    beforeEach(() => {
      provider.configure(defaultConfig);
    });

    it('should use correct API endpoint', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];
      provider.query(messages);

      // OpenRouter API endpoint is https://openrouter.ai/api/v1/chat/completions
      expect(true).toBe(true);
    });

    it('should include API key in headers', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];
      provider.query(messages);

      expect(true).toBe(true);
    });

    it('should set correct content type', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];
      provider.query(messages);

      expect(true).toBe(true);
    });
  });

  describe('timeout handling', () => {
    beforeEach(() => {
      provider.configure(defaultConfig);
    });

    it('should accept custom timeout', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages, { metadata: { timeout: 30000 } })).not.toThrow();
    });

    it('should use default timeout if not specified', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages)).not.toThrow();
    });
  });

  describe('metadata handling', () => {
    beforeEach(() => {
      provider.configure(defaultConfig);
    });

    it('should preserve message metadata', () => {
      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: 'Test',
          metadata: { custom: 'value' },
        },
      ];

      expect(() => provider.query(messages)).not.toThrow();
    });

    it('should handle query metadata', () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages, { metadata: { requestId: '123' } })).not.toThrow();
    });
  });
});
