import { describe, expect, it } from 'vitest';
import type { LLMProvider } from '../../types.js';
import {
  applyConfigDefaults,
  ConfigValidationError,
  DEFAULT_CONFIG,
  resolveSystemPrompt,
  validateConfig,
  validateMCPServers,
  validateNonEmptyString,
  validateNonNegativeInteger,
  validateNumericConfig,
  validatePositiveInteger,
  validateRequiredConfig,
} from '../config.js';
import type { CloudflareAgentConfig } from '../types.js';

describe('config', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_CONFIG.maxHistory).toBe(100);
      expect(DEFAULT_CONFIG.maxToolIterations).toBe(25); // Increased for complex multi-step tasks
      expect(DEFAULT_CONFIG.thinkingRotationInterval).toBe(5000);
      expect(DEFAULT_CONFIG.maxTools).toBeUndefined();
      expect(DEFAULT_CONFIG.welcomeMessage).toBe('Welcome! How can I help you today?');
      expect(DEFAULT_CONFIG.helpMessage).toContain('/start');
    });
  });

  describe('validatePositiveInteger', () => {
    it('should accept positive integers', () => {
      expect(() => validatePositiveInteger(1, 'test')).not.toThrow();
      expect(() => validatePositiveInteger(100, 'test')).not.toThrow();
      expect(() => validatePositiveInteger(5000, 'test')).not.toThrow();
    });

    it('should reject zero', () => {
      expect(() => validatePositiveInteger(0, 'test')).toThrow(ConfigValidationError);
    });

    it('should reject negative numbers', () => {
      expect(() => validatePositiveInteger(-1, 'test')).toThrow(ConfigValidationError);
      expect(() => validatePositiveInteger(-100, 'test')).toThrow(ConfigValidationError);
    });

    it('should reject non-integers', () => {
      expect(() => validatePositiveInteger(1.5, 'test')).toThrow(ConfigValidationError);
      expect(() => validatePositiveInteger(NaN, 'test')).toThrow(ConfigValidationError);
      expect(() => validatePositiveInteger(Infinity, 'test')).toThrow(ConfigValidationError);
    });

    it('should reject non-numbers', () => {
      expect(() => validatePositiveInteger('5', 'test')).toThrow(ConfigValidationError);
      expect(() => validatePositiveInteger(null, 'test')).toThrow(ConfigValidationError);
      expect(() => validatePositiveInteger(undefined, 'test')).toThrow(ConfigValidationError);
    });

    it('should include field name in error', () => {
      try {
        validatePositiveInteger(-1, 'maxHistory');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigValidationError);
        expect((err as ConfigValidationError).field).toBe('maxHistory');
        expect((err as ConfigValidationError).message).toContain('maxHistory');
      }
    });
  });

  describe('validateNonNegativeInteger', () => {
    it('should accept zero', () => {
      expect(() => validateNonNegativeInteger(0, 'test')).not.toThrow();
    });

    it('should accept positive integers', () => {
      expect(() => validateNonNegativeInteger(1, 'test')).not.toThrow();
      expect(() => validateNonNegativeInteger(100, 'test')).not.toThrow();
    });

    it('should reject negative numbers', () => {
      expect(() => validateNonNegativeInteger(-1, 'test')).toThrow(ConfigValidationError);
    });
  });

  describe('validateNonEmptyString', () => {
    it('should accept non-empty strings', () => {
      expect(() => validateNonEmptyString('hello', 'test')).not.toThrow();
      expect(() => validateNonEmptyString('test message', 'test')).not.toThrow();
    });

    it('should reject empty strings', () => {
      expect(() => validateNonEmptyString('', 'test')).toThrow(ConfigValidationError);
      expect(() => validateNonEmptyString('   ', 'test')).toThrow(ConfigValidationError);
    });

    it('should reject non-strings', () => {
      expect(() => validateNonEmptyString(123, 'test')).toThrow(ConfigValidationError);
      expect(() => validateNonEmptyString(null, 'test')).toThrow(ConfigValidationError);
      expect(() => validateNonEmptyString(undefined, 'test')).toThrow(ConfigValidationError);
    });
  });

  describe('validateNumericConfig', () => {
    it('should accept valid numeric config', () => {
      const config = {
        maxHistory: 100,
        maxToolIterations: 5,
        thinkingRotationInterval: 5000,
        maxTools: 10,
      };

      expect(() => validateNumericConfig(config)).not.toThrow();
    });

    it('should accept undefined values', () => {
      const config = {
        maxHistory: undefined,
        maxToolIterations: undefined,
      };

      expect(() => validateNumericConfig(config)).not.toThrow();
    });

    it('should reject invalid maxHistory', () => {
      const config = { maxHistory: -1 };
      expect(() => validateNumericConfig(config)).toThrow(ConfigValidationError);
    });

    it('should reject invalid maxToolIterations', () => {
      const config = { maxToolIterations: 0 };
      expect(() => validateNumericConfig(config)).toThrow(ConfigValidationError);
    });

    it('should reject invalid thinkingRotationInterval', () => {
      const config = { thinkingRotationInterval: -5000 };
      expect(() => validateNumericConfig(config)).toThrow(ConfigValidationError);
    });

    it('should reject invalid maxTools', () => {
      const config = { maxTools: 0 };
      expect(() => validateNumericConfig(config)).toThrow(ConfigValidationError);
    });
  });

  describe('validateRequiredConfig', () => {
    const mockProvider: LLMProvider = {
      chat: async () => ({ content: 'test' }),
    };

    it('should accept valid required config', () => {
      const config: CloudflareAgentConfig<unknown> = {
        createProvider: () => mockProvider,
        systemPrompt: 'You are a helpful assistant',
      };

      expect(() => validateRequiredConfig(config)).not.toThrow();
    });

    it('should accept function systemPrompt', () => {
      const config: CloudflareAgentConfig<unknown> = {
        createProvider: () => mockProvider,
        systemPrompt: () => 'Dynamic prompt',
      };

      expect(() => validateRequiredConfig(config)).not.toThrow();
    });

    it('should reject missing createProvider', () => {
      const config = {
        systemPrompt: 'test',
      } as unknown as CloudflareAgentConfig<unknown>;

      expect(() => validateRequiredConfig(config)).toThrow(ConfigValidationError);
    });

    it('should reject missing systemPrompt', () => {
      const config = {
        createProvider: () => mockProvider,
      } as unknown as CloudflareAgentConfig<unknown>;

      expect(() => validateRequiredConfig(config)).toThrow(ConfigValidationError);
    });

    it('should reject empty systemPrompt', () => {
      const config: CloudflareAgentConfig<unknown> = {
        createProvider: () => mockProvider,
        systemPrompt: '   ',
      };

      expect(() => validateRequiredConfig(config)).toThrow(ConfigValidationError);
    });
  });

  describe('validateMCPServers', () => {
    it('should accept undefined', () => {
      expect(() => validateMCPServers(undefined)).not.toThrow();
    });

    it('should accept valid MCP servers', () => {
      const servers = [
        { name: 'memory', url: 'https://memory.example.com' },
        { name: 'tools', url: 'https://tools.example.com' },
      ];

      expect(() => validateMCPServers(servers)).not.toThrow();
    });

    it('should reject duplicate names', () => {
      const servers = [
        { name: 'memory', url: 'https://memory1.example.com' },
        { name: 'memory', url: 'https://memory2.example.com' },
      ];

      expect(() => validateMCPServers(servers)).toThrow(ConfigValidationError);
    });

    it('should reject empty name', () => {
      const servers = [{ name: '', url: 'https://example.com' }];

      expect(() => validateMCPServers(servers)).toThrow(ConfigValidationError);
    });

    it('should reject empty url', () => {
      const servers = [{ name: 'test', url: '' }];

      expect(() => validateMCPServers(servers)).toThrow(ConfigValidationError);
    });

    it('should reject invalid url', () => {
      const servers = [{ name: 'test', url: 'not-a-url' }];

      expect(() => validateMCPServers(servers)).toThrow(ConfigValidationError);
    });
  });

  describe('applyConfigDefaults', () => {
    const mockProvider: LLMProvider = {
      chat: async () => ({ content: 'test' }),
    };

    it('should apply defaults for missing values', () => {
      const config: CloudflareAgentConfig<unknown> = {
        createProvider: () => mockProvider,
        systemPrompt: 'test',
      };

      const result = applyConfigDefaults(config);

      expect(result.maxHistory).toBe(DEFAULT_CONFIG.maxHistory);
      expect(result.maxToolIterations).toBe(DEFAULT_CONFIG.maxToolIterations);
      expect(result.thinkingRotationInterval).toBe(DEFAULT_CONFIG.thinkingRotationInterval);
    });

    it('should preserve provided values', () => {
      const config: CloudflareAgentConfig<unknown> = {
        createProvider: () => mockProvider,
        systemPrompt: 'test',
        maxHistory: 50,
        maxToolIterations: 3,
        thinkingRotationInterval: 3000,
      };

      const result = applyConfigDefaults(config);

      expect(result.maxHistory).toBe(50);
      expect(result.maxToolIterations).toBe(3);
      expect(result.thinkingRotationInterval).toBe(3000);
    });

    it('should preserve other config properties', () => {
      const config: CloudflareAgentConfig<unknown> = {
        createProvider: () => mockProvider,
        systemPrompt: 'test',
        welcomeMessage: 'Custom welcome',
        helpMessage: 'Custom help',
      };

      const result = applyConfigDefaults(config);

      expect(result.welcomeMessage).toBe('Custom welcome');
      expect(result.helpMessage).toBe('Custom help');
    });
  });

  describe('resolveSystemPrompt', () => {
    const mockProvider: LLMProvider = {
      chat: async () => ({ content: 'test' }),
    };

    it('should return static string', () => {
      const config: CloudflareAgentConfig<unknown> = {
        createProvider: () => mockProvider,
        systemPrompt: 'Static prompt',
      };

      const result = resolveSystemPrompt(config, {});
      expect(result).toBe('Static prompt');
    });

    it('should call function and return result', () => {
      const config: CloudflareAgentConfig<{ model: string }> = {
        createProvider: () => mockProvider,
        systemPrompt: (env) => `You are using ${env.model}`,
      };

      const result = resolveSystemPrompt(config, { model: 'gpt-4' });
      expect(result).toBe('You are using gpt-4');
    });
  });

  describe('validateConfig', () => {
    const mockProvider: LLMProvider = {
      chat: async () => ({ content: 'test' }),
    };

    it('should accept valid complete config', () => {
      const config: CloudflareAgentConfig<unknown> = {
        createProvider: () => mockProvider,
        systemPrompt: 'test',
        maxHistory: 100,
        maxToolIterations: 5,
        thinkingRotationInterval: 5000,
        mcpServers: [{ name: 'memory', url: 'https://memory.example.com' }],
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should reject invalid required fields', () => {
      const config = {
        systemPrompt: 'test',
      } as unknown as CloudflareAgentConfig<unknown>;

      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('should reject invalid numeric values', () => {
      const config: CloudflareAgentConfig<unknown> = {
        createProvider: () => mockProvider,
        systemPrompt: 'test',
        maxHistory: -1,
      };

      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('should reject invalid MCP servers', () => {
      const config: CloudflareAgentConfig<unknown> = {
        createProvider: () => mockProvider,
        systemPrompt: 'test',
        mcpServers: [
          { name: 'memory', url: 'https://memory.example.com' },
          { name: 'memory', url: 'https://memory2.example.com' },
        ],
      };

      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });
  });
});
