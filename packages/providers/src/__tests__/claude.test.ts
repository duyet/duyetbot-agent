import type { ProviderConfig } from '@duyetbot/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { ClaudeProvider, claudeProvider } from '../claude.js';

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider;

  beforeEach(() => {
    provider = new ClaudeProvider();
  });

  describe('name', () => {
    it('should have name "claude"', () => {
      expect(provider.name).toBe('claude');
    });
  });

  describe('configure', () => {
    it('should configure with basic settings', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-api-key',
      };

      provider.configure(config);

      const result = provider.getConfig();
      expect(result).toBeDefined();
      expect(result?.provider).toBe('claude');
      expect(result?.model).toBe('claude-3-5-sonnet-20241022');
      expect(result?.apiKey).toBe('test-api-key');
    });

    it('should set default temperature', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-api-key',
      };

      provider.configure(config);

      const result = provider.getConfig();
      expect(result?.temperature).toBe(0.7);
    });

    it('should set default maxTokens', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-api-key',
      };

      provider.configure(config);

      const result = provider.getConfig();
      expect(result?.maxTokens).toBe(4096);
    });

    it('should set default timeout', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-api-key',
      };

      provider.configure(config);

      const result = provider.getConfig();
      expect(result?.timeout).toBe(60000);
    });

    it('should override defaults with provided values', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-api-key',
        temperature: 0.5,
        maxTokens: 8192,
        timeout: 120000,
      };

      provider.configure(config);

      const result = provider.getConfig();
      expect(result?.temperature).toBe(0.5);
      expect(result?.maxTokens).toBe(8192);
      expect(result?.timeout).toBe(120000);
    });

    it('should configure with baseURL for Z.AI', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        model: 'glm-4.6',
        apiKey: 'zai-api-key',
        baseURL: 'https://api.z.ai/api/anthropic',
      };

      provider.configure(config);

      const result = provider.getConfig();
      expect(result?.baseURL).toBe('https://api.z.ai/api/anthropic');
    });

    it('should not include baseURL when not provided', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-api-key',
      };

      provider.configure(config);

      const result = provider.getConfig();
      expect(result?.baseURL).toBeUndefined();
    });

    it('should reconfigure when called multiple times', () => {
      provider.configure({
        provider: 'claude',
        model: 'model-1',
        apiKey: 'key-1',
      });

      provider.configure({
        provider: 'claude',
        model: 'model-2',
        apiKey: 'key-2',
      });

      const result = provider.getConfig();
      expect(result?.model).toBe('model-2');
      expect(result?.apiKey).toBe('key-2');
    });
  });

  describe('getConfig', () => {
    it('should return undefined when not configured', () => {
      expect(provider.getConfig()).toBeUndefined();
    });

    it('should return config after configuration', () => {
      provider.configure({
        provider: 'claude',
        model: 'test-model',
        apiKey: 'test-key',
      });

      expect(provider.getConfig()).toBeDefined();
    });
  });

  describe('validateConfig', () => {
    it('should return true for valid config', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-api-key',
      };

      expect(provider.validateConfig(config)).toBe(true);
    });

    it('should return false when apiKey is missing', () => {
      const config = {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: '',
      } as ProviderConfig;

      expect(provider.validateConfig(config)).toBe(false);
    });

    it('should return false when model is missing', () => {
      const config = {
        provider: 'claude',
        model: '',
        apiKey: 'test-api-key',
      } as ProviderConfig;

      expect(provider.validateConfig(config)).toBe(false);
    });

    it('should return true with baseURL', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        model: 'glm-4.6',
        apiKey: 'zai-api-key',
        baseURL: 'https://api.z.ai/api/anthropic',
      };

      expect(provider.validateConfig(config)).toBe(true);
    });
  });

  describe('query', () => {
    it('should throw error when not configured', async () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      await expect(
        (async () => {
          const generator = provider.query(messages);
          await generator.next();
        })()
      ).rejects.toThrow('Provider not configured');
    });

    it('should throw error with empty messages', async () => {
      provider.configure({
        provider: 'claude',
        model: 'test-model',
        apiKey: 'test-key',
      });

      await expect(
        (async () => {
          const generator = provider.query([]);
          await generator.next();
        })()
      ).rejects.toThrow('Messages array cannot be empty');
    });
  });
});

describe('claudeProvider singleton', () => {
  it('should be an instance of ClaudeProvider', () => {
    expect(claudeProvider).toBeInstanceOf(ClaudeProvider);
  });

  it('should have name "claude"', () => {
    expect(claudeProvider.name).toBe('claude');
  });
});
