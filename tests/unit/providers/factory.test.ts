import { type LLMProvider, type ProviderConfig, ProviderFactory } from '@providers/factory';
import { beforeEach, describe, expect, it } from 'vitest';

describe('ProviderFactory', () => {
  let factory: ProviderFactory;

  beforeEach(() => {
    factory = new ProviderFactory();
  });

  describe('register', () => {
    it('should register a provider', () => {
      const mockProvider: LLMProvider = {
        name: 'test-provider',
        query: async function* () {
          yield {
            content: 'test',
            model: 'test-model',
            provider: 'test',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        },
        configure: () => {},
      };

      factory.register('test', mockProvider);

      expect(factory.has('test')).toBe(true);
    });

    it('should throw error when registering duplicate provider', () => {
      const mockProvider: LLMProvider = {
        name: 'test-provider',
        query: async function* () {
          yield {
            content: 'test',
            model: 'test-model',
            provider: 'test',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        },
        configure: () => {},
      };

      factory.register('test', mockProvider);

      expect(() => factory.register('test', mockProvider)).toThrow(
        'Provider "test" is already registered'
      );
    });
  });

  describe('get', () => {
    it('should get registered provider', () => {
      const mockProvider: LLMProvider = {
        name: 'test-provider',
        query: async function* () {
          yield {
            content: 'test',
            model: 'test-model',
            provider: 'test',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        },
        configure: () => {},
      };

      factory.register('test', mockProvider);
      const provider = factory.get('test');

      expect(provider).toBe(mockProvider);
      expect(provider.name).toBe('test-provider');
    });

    it('should throw error for unregistered provider', () => {
      expect(() => factory.get('unknown')).toThrow('Provider "unknown" is not registered');
    });
  });

  describe('has', () => {
    it('should return true for registered provider', () => {
      const mockProvider: LLMProvider = {
        name: 'test-provider',
        query: async function* () {
          yield {
            content: 'test',
            model: 'test-model',
            provider: 'test',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        },
        configure: () => {},
      };

      factory.register('test', mockProvider);

      expect(factory.has('test')).toBe(true);
    });

    it('should return false for unregistered provider', () => {
      expect(factory.has('unknown')).toBe(false);
    });
  });

  describe('createFromFormat', () => {
    it('should create provider from format string', () => {
      const mockProvider: LLMProvider = {
        name: 'claude-provider',
        query: async function* () {
          yield {
            content: 'test',
            model: 'test-model',
            provider: 'claude',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        },
        configure: () => {},
      };

      factory.register('claude', mockProvider);

      const config: ProviderConfig = {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-key',
      };

      const provider = factory.createFromFormat('claude:claude-3-5-sonnet-20241022', config);

      expect(provider).toBe(mockProvider);
    });

    it('should throw error for invalid format', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-key',
      };

      expect(() => factory.createFromFormat('invalid-format', config)).toThrow(
        'Invalid provider format'
      );
    });

    it('should throw error for unregistered provider in format', () => {
      const config: ProviderConfig = {
        provider: 'unknown',
        model: 'model-id',
        apiKey: 'test-key',
      };

      expect(() => factory.createFromFormat('unknown:model-id', config)).toThrow(
        'Provider "unknown" is not registered'
      );
    });

    it('should configure provider with correct model from format', () => {
      let configuredConfig: ProviderConfig | undefined;

      const mockProvider: LLMProvider = {
        name: 'test-provider',
        query: async function* () {
          yield {
            content: 'test',
            model: 'test-model',
            provider: 'test',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        },
        configure: (config) => {
          configuredConfig = config;
        },
      };

      factory.register('test', mockProvider);

      const config: ProviderConfig = {
        provider: 'test',
        model: 'original-model',
        apiKey: 'test-key',
      };

      factory.createFromFormat('test:format-model', config);

      expect(configuredConfig).toBeDefined();
      expect(configuredConfig?.model).toBe('format-model');
      expect(configuredConfig?.provider).toBe('test');
    });
  });

  describe('list', () => {
    it('should list all registered providers', () => {
      const mockProvider1: LLMProvider = {
        name: 'provider-1',
        query: async function* () {
          yield {
            content: 'test',
            model: 'test-model',
            provider: 'test',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        },
        configure: () => {},
      };

      const mockProvider2: LLMProvider = {
        name: 'provider-2',
        query: async function* () {
          yield {
            content: 'test',
            model: 'test-model',
            provider: 'test',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          };
        },
        configure: () => {},
      };

      factory.register('test1', mockProvider1);
      factory.register('test2', mockProvider2);

      const list = factory.list();

      expect(list).toEqual(['test1', 'test2']);
    });

    it('should return empty array when no providers registered', () => {
      expect(factory.list()).toEqual([]);
    });
  });
});
