import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ServerConfig, getDefaultConfig, loadConfig, validateConfig } from '../config';

describe('ServerConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const config = getDefaultConfig();

      expect(config.port).toBe(3000);
      expect(config.host).toBe('0.0.0.0');
      expect(config.wsPort).toBe(8080);
      expect(config.env).toBe('development');
    });
  });

  describe('loadConfig', () => {
    it('should load config from environment variables', () => {
      process.env.PORT = '4000';
      process.env.HOST = '127.0.0.1';
      process.env.WS_PORT = '9090';
      process.env.NODE_ENV = 'production';
      process.env.MCP_SERVER_URL = 'https://memory.example.com';
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const config = loadConfig();

      expect(config.port).toBe(4000);
      expect(config.host).toBe('127.0.0.1');
      expect(config.wsPort).toBe(9090);
      expect(config.env).toBe('production');
      expect(config.mcpServerUrl).toBe('https://memory.example.com');
      expect(config.anthropicApiKey).toBe('test-key');
    });

    it('should use defaults when env vars not set', () => {
      process.env.PORT = undefined;
      process.env.HOST = undefined;

      const config = loadConfig();

      expect(config.port).toBe(3000);
      expect(config.host).toBe('0.0.0.0');
    });

    it('should load optional provider keys', () => {
      process.env.OPENAI_API_KEY = 'openai-key';
      process.env.OPENROUTER_API_KEY = 'openrouter-key';

      const config = loadConfig();

      expect(config.openaiApiKey).toBe('openai-key');
      expect(config.openrouterApiKey).toBe('openrouter-key');
    });
  });

  describe('validateConfig', () => {
    it('should pass for valid config', () => {
      const config: ServerConfig = {
        port: 3000,
        host: '0.0.0.0',
        wsPort: 8080,
        env: 'development',
        mcpServerUrl: 'https://memory.example.com',
        anthropicApiKey: 'test-key',
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw for invalid port', () => {
      const config: ServerConfig = {
        port: -1,
        host: '0.0.0.0',
        wsPort: 8080,
        env: 'development',
      };

      expect(() => validateConfig(config)).toThrow('Invalid port');
    });

    it('should throw for port out of range', () => {
      const config: ServerConfig = {
        port: 70000,
        host: '0.0.0.0',
        wsPort: 8080,
        env: 'development',
      };

      expect(() => validateConfig(config)).toThrow('Invalid port');
    });

    it('should throw for invalid wsPort', () => {
      const config: ServerConfig = {
        port: 3000,
        host: '0.0.0.0',
        wsPort: -1,
        env: 'development',
      };

      expect(() => validateConfig(config)).toThrow('Invalid WebSocket port');
    });

    it('should throw for empty host', () => {
      const config: ServerConfig = {
        port: 3000,
        host: '',
        wsPort: 8080,
        env: 'development',
      };

      expect(() => validateConfig(config)).toThrow('Invalid host');
    });
  });
});
