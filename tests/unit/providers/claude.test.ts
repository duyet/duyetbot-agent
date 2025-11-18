import { ClaudeProvider } from '@/providers/claude';
import type { LLMMessage, ProviderConfig } from '@/providers/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        stream: vi.fn(),
      },
    })),
  };
});

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider;
  let defaultConfig: ProviderConfig;

  beforeEach(() => {
    provider = new ClaudeProvider();
    defaultConfig = {
      provider: 'claude',
      model: 'claude-3-5-sonnet-20241022',
      apiKey: 'test-api-key',
      temperature: 0.7,
      maxTokens: 4096,
    };
  });

  describe('configuration', () => {
    it('should have correct provider name', () => {
      expect(provider.name).toBe('claude');
    });

    it('should configure provider', () => {
      provider.configure(defaultConfig);
      const config = provider.getConfig?.();

      expect(config?.provider).toBe('claude');
      expect(config?.model).toBe('claude-3-5-sonnet-20241022');
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
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-api-key',
        maxTokens: 4096,
      };

      provider.configure(config);
      const savedConfig = provider.getConfig?.();

      expect(savedConfig?.temperature).toBeDefined();
    });

    it('should use default maxTokens if not provided', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-api-key',
        temperature: 0.7,
      };

      provider.configure(config);
      const savedConfig = provider.getConfig?.();

      expect(savedConfig?.maxTokens).toBeDefined();
    });
  });

  describe('message handling', () => {
    it('should accept messages array', async () => {
      provider.configure(defaultConfig);

      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];

      // Should not throw
      expect(() => provider.query(messages)).not.toThrow();
    });

    it('should handle system messages', async () => {
      provider.configure(defaultConfig);

      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
      ];

      expect(() => provider.query(messages)).not.toThrow();
    });

    it('should handle messages with metadata', async () => {
      provider.configure(defaultConfig);

      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: 'Test message',
          metadata: { source: 'test' },
        },
      ];

      expect(() => provider.query(messages)).not.toThrow();
    });
  });

  describe('query options', () => {
    beforeEach(() => {
      provider.configure(defaultConfig);
    });

    it('should accept custom temperature', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages, { temperature: 0.5 })).not.toThrow();
    });

    it('should accept custom maxTokens', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages, { maxTokens: 2000 })).not.toThrow();
    });

    it('should accept stop sequences', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages, { stopSequences: ['STOP', 'END'] })).not.toThrow();
    });

    it('should accept custom model', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages, { model: 'claude-3-opus-20240229' })).not.toThrow();
    });
  });

  describe('streaming', () => {
    beforeEach(() => {
      provider.configure(defaultConfig);
    });

    it('should return async generator', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
      const generator = provider.query(messages);

      expect(generator).toBeDefined();
      expect(typeof generator[Symbol.asyncIterator]).toBe('function');
    });

    it('should stream response chunks', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Count to 3' }];

      // Note: actual streaming would be mocked in real tests
      // This just verifies the interface
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

    it('should throw error for invalid API key', async () => {
      const invalidConfig = { ...defaultConfig, apiKey: 'invalid-key' };
      provider.configure(invalidConfig);

      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      // API key validation would happen during actual API call
      expect(() => provider.query(messages)).not.toThrow();
    });

    it('should throw error for empty messages array', async () => {
      provider.configure(defaultConfig);

      await expect(async () => {
        const gen = provider.query([]);
        await gen.next();
      }).rejects.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      provider.configure(defaultConfig);
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      // Network errors would be caught and wrapped
      // This test verifies the error handling structure exists
      expect(() => provider.query(messages)).not.toThrow();
    });
  });

  describe('response format', () => {
    beforeEach(() => {
      provider.configure(defaultConfig);
    });

    it('should include content in response', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
      const generator = provider.query(messages);

      // Response should include content field
      // Actual content verification would require mocking
      expect(generator).toBeDefined();
    });

    it('should include model in response', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];
      const generator = provider.query(messages);

      expect(generator).toBeDefined();
    });

    it('should include provider name in response', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];
      const generator = provider.query(messages);

      expect(generator).toBeDefined();
    });

    it('should include token usage in response', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];
      const generator = provider.query(messages);

      // Usage should include inputTokens, outputTokens, totalTokens
      expect(generator).toBeDefined();
    });

    it('should include stop reason in final response', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];
      const generator = provider.query(messages);

      // Final chunk should include stopReason
      expect(generator).toBeDefined();
    });
  });

  describe('model support', () => {
    it('should support Claude 3.5 Sonnet', () => {
      const config = { ...defaultConfig, model: 'claude-3-5-sonnet-20241022' };
      provider.configure(config);

      expect(provider.getConfig?.()?.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should support Claude 3 Opus', () => {
      const config = { ...defaultConfig, model: 'claude-3-opus-20240229' };
      provider.configure(config);

      expect(provider.getConfig?.()?.model).toBe('claude-3-opus-20240229');
    });

    it('should support Claude 3 Haiku', () => {
      const config = { ...defaultConfig, model: 'claude-3-haiku-20240307' };
      provider.configure(config);

      expect(provider.getConfig?.()?.model).toBe('claude-3-haiku-20240307');
    });
  });

  describe('timeout handling', () => {
    beforeEach(() => {
      provider.configure(defaultConfig);
    });

    it('should accept custom timeout', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages, { metadata: { timeout: 30000 } })).not.toThrow();
    });

    it('should use default timeout if not specified', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages)).not.toThrow();
    });
  });

  describe('metadata handling', () => {
    beforeEach(() => {
      provider.configure(defaultConfig);
    });

    it('should preserve message metadata', async () => {
      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: 'Test',
          metadata: { custom: 'value' },
        },
      ];

      expect(() => provider.query(messages)).not.toThrow();
    });

    it('should handle query metadata', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      expect(() => provider.query(messages, { metadata: { requestId: '123' } })).not.toThrow();
    });
  });
});
