import type {
  LLMMessage,
  LLMProvider,
  LLMResponse,
  ProviderConfig,
  QueryOptions,
} from '@duyetbot/types';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  type CustomProviderConfig,
  ProviderFactory,
  createProviderConfig,
  createZAIConfig,
  providerFactory,
} from '../factory.js';

// Mock provider for testing
class MockProvider implements LLMProvider {
  name = 'mock';
  private config?: ProviderConfig;

  configure(config: ProviderConfig): void {
    this.config = config;
  }

  getConfig(): ProviderConfig | undefined {
    return this.config;
  }

  validateConfig(config: ProviderConfig): boolean {
    return !!config.apiKey && !!config.model;
  }

  async *query(
    _messages: LLMMessage[],
    _options?: QueryOptions
  ): AsyncGenerator<LLMResponse, void, unknown> {
    yield {
      content: 'mock response',
      model: this.config?.model || 'mock-model',
      provider: this.name,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    };
  }
}

describe('ProviderFactory', () => {
  let factory: ProviderFactory;

  beforeEach(() => {
    factory = new ProviderFactory();
  });

  describe('register', () => {
    it('should register a provider', () => {
      const provider = new MockProvider();
      factory.register('test', provider);

      expect(factory.has('test')).toBe(true);
    });

    it('should throw error when registering duplicate provider', () => {
      const provider = new MockProvider();
      factory.register('test', provider);

      expect(() => factory.register('test', new MockProvider())).toThrow(
        'Provider "test" is already registered'
      );
    });
  });

  describe('get', () => {
    it('should get a registered provider', () => {
      const provider = new MockProvider();
      factory.register('test', provider);

      expect(factory.get('test')).toBe(provider);
    });

    it('should throw error for unregistered provider', () => {
      expect(() => factory.get('unknown')).toThrow('Provider "unknown" is not registered');
    });
  });

  describe('has', () => {
    it('should return true for registered provider', () => {
      factory.register('test', new MockProvider());
      expect(factory.has('test')).toBe(true);
    });

    it('should return false for unregistered provider', () => {
      expect(factory.has('unknown')).toBe(false);
    });
  });

  describe('list', () => {
    it('should list all registered providers', () => {
      factory.register('provider1', new MockProvider());
      factory.register('provider2', new MockProvider());
      factory.register('provider3', new MockProvider());

      const list = factory.list();
      expect(list).toHaveLength(3);
      expect(list).toContain('provider1');
      expect(list).toContain('provider2');
      expect(list).toContain('provider3');
    });

    it('should return empty array when no providers registered', () => {
      expect(factory.list()).toEqual([]);
    });
  });

  describe('unregister', () => {
    it('should unregister a provider', () => {
      factory.register('test', new MockProvider());
      expect(factory.has('test')).toBe(true);

      factory.unregister('test');
      expect(factory.has('test')).toBe(false);
    });

    it('should not throw when unregistering non-existent provider', () => {
      expect(() => factory.unregister('unknown')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all providers', () => {
      factory.register('provider1', new MockProvider());
      factory.register('provider2', new MockProvider());

      factory.clear();

      expect(factory.list()).toEqual([]);
      expect(factory.has('provider1')).toBe(false);
      expect(factory.has('provider2')).toBe(false);
    });
  });

  describe('createFromFormat', () => {
    it('should create provider from format string', () => {
      const provider = new MockProvider();
      factory.register('mock', provider);

      const config: ProviderConfig = {
        provider: 'mock',
        model: 'default-model',
        apiKey: 'test-key',
      };

      const result = factory.createFromFormat('mock:custom-model', config);

      expect(result).toBe(provider);
      expect(provider.getConfig()?.model).toBe('custom-model');
      expect(provider.getConfig()?.apiKey).toBe('test-key');
    });

    it('should throw error for unregistered provider in format', () => {
      const config: ProviderConfig = {
        provider: 'unknown',
        model: 'model',
        apiKey: 'key',
      };

      expect(() => factory.createFromFormat('unknown:model', config)).toThrow(
        'Provider "unknown" is not registered'
      );
    });
  });
});

describe('createZAIConfig', () => {
  it('should create Z.AI configuration with correct defaults', () => {
    const config = createZAIConfig('test-api-key');

    expect(config.type).toBe('anthropic');
    expect(config.apiKey).toBe('test-api-key');
    expect(config.baseURL).toBe('https://api.z.ai/api/anthropic');
    expect(config.models).toEqual({
      haiku: 'glm-4.5-air',
      sonnet: 'glm-4.6',
      opus: 'glm-4.6',
    });
  });
});

describe('createProviderConfig', () => {
  it('should create provider config from custom config', () => {
    const custom: CustomProviderConfig = {
      type: 'anthropic',
      apiKey: 'test-key',
    };

    const config = createProviderConfig(custom, 'claude-3-5-sonnet');

    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-3-5-sonnet');
    expect(config.apiKey).toBe('test-key');
    expect(config.baseURL).toBeUndefined();
  });

  it('should include baseURL when provided', () => {
    const custom: CustomProviderConfig = {
      type: 'anthropic',
      apiKey: 'test-key',
      baseURL: 'https://custom.api.com',
    };

    const config = createProviderConfig(custom, 'model');

    expect(config.baseURL).toBe('https://custom.api.com');
  });

  it('should work with Z.AI config', () => {
    const zaiConfig = createZAIConfig('zai-key');
    const config = createProviderConfig(zaiConfig, 'glm-4.6');

    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('glm-4.6');
    expect(config.apiKey).toBe('zai-key');
    expect(config.baseURL).toBe('https://api.z.ai/api/anthropic');
  });

  it('should handle all provider types', () => {
    const openaiConfig: CustomProviderConfig = {
      type: 'openai',
      apiKey: 'openai-key',
      baseURL: 'https://api.openai.com/v1',
    };

    const config = createProviderConfig(openaiConfig, 'gpt-4');

    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4');
    expect(config.baseURL).toBe('https://api.openai.com/v1');
  });
});

describe('providerFactory singleton', () => {
  it('should be an instance of ProviderFactory', () => {
    expect(providerFactory).toBeInstanceOf(ProviderFactory);
  });
});
