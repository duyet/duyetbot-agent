/**
 * Config Tests
 *
 * Tests for configuration loading and validation
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configSchema, loadConfig } from '../src/config.js';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('configSchema', () => {
    it('should have correct default values', () => {
      const result = configSchema.safeParse({
        apiKey: 'test-key',
        githubToken: 'ghp_test',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.model).toBe('anthropic/claude-sonnet-4');
        expect(result.data.maxIterations).toBe(10);
        expect(result.data.checkpointDir).toBe('.agent/checkpoints');
        expect(result.data.logDir).toBe('.agent/logs');
        expect(result.data.dryRun).toBe(false);
        expect(result.data.taskSources).toEqual(['github-issues', 'file', 'memory']);
      }
    });

    it('should require apiKey', () => {
      const result = configSchema.safeParse({
        githubToken: 'ghp_test',
      });

      expect(result.success).toBe(false);
    });

    it('should require githubToken', () => {
      const result = configSchema.safeParse({
        apiKey: 'test-key',
      });

      expect(result.success).toBe(false);
    });

    it('should accept valid memoryMcpUrl', () => {
      const result = configSchema.safeParse({
        apiKey: 'test-key',
        githubToken: 'ghp_test',
        memoryMcpUrl: 'https://memory.example.com',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid memoryMcpUrl', () => {
      const result = configSchema.safeParse({
        apiKey: 'test-key',
        githubToken: 'ghp_test',
        memoryMcpUrl: 'not-a-url',
      });

      expect(result.success).toBe(false);
    });

    it('should parse repository from GITHUB_REPOSITORY format', () => {
      const result = configSchema.safeParse({
        apiKey: 'test-key',
        githubToken: 'ghp_test',
        repository: {
          owner: 'duyet',
          name: 'duyetbot-agent',
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.repository?.owner).toBe('duyet');
        expect(result.data.repository?.name).toBe('duyetbot-agent');
      }
    });
  });

  describe('loadConfig', () => {
    it('should load config from environment variables', () => {
      process.env.DUYETBOT_API_KEY = 'test-api-key';
      process.env.GITHUB_TOKEN = 'ghp_test_token';
      process.env.GITHUB_REPOSITORY = 'duyet/duyetbot-agent';

      const config = loadConfig();

      expect(config.apiKey).toBe('test-api-key');
      expect(config.githubToken).toBe('ghp_test_token');
      expect(config.repository?.owner).toBe('duyet');
      expect(config.repository?.name).toBe('duyetbot-agent');
    });

    it('should support legacy OPENROUTER_API_KEY for backward compatibility', () => {
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.GITHUB_TOKEN = 'ghp_test_token';

      const config = loadConfig();

      expect(config.apiKey).toBe('test-openrouter-key');
    });

    it('should support legacy ANTHROPIC_API_KEY for backward compatibility', () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      process.env.GITHUB_TOKEN = 'ghp_test_token';

      const config = loadConfig();

      expect(config.apiKey).toBe('test-anthropic-key');
    });

    it('should prefer DUYETBOT_API_KEY over legacy names', () => {
      process.env.DUYETBOT_API_KEY = 'new-key';
      process.env.OPENROUTER_API_KEY = 'old-key';
      process.env.ANTHROPIC_API_KEY = 'older-key';
      process.env.GITHUB_TOKEN = 'ghp_test_token';

      const config = loadConfig();

      expect(config.apiKey).toBe('new-key');
    });

    it('should parse DRY_RUN correctly', () => {
      process.env.DUYETBOT_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'ghp_test';
      process.env.DRY_RUN = 'true';

      const config = loadConfig();

      expect(config.dryRun).toBe(true);
    });

    it('should throw on missing required keys', () => {
      delete process.env.DUYETBOT_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GITHUB_TOKEN;

      expect(() => loadConfig()).toThrow();
    });

    it('should set up SDK environment variables', () => {
      delete process.env.ANTHROPIC_BASE_URL;
      delete process.env.ANTHROPIC_API_KEY;
      process.env.DUYETBOT_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'ghp_test';

      loadConfig();

      expect(process.env.ANTHROPIC_API_KEY).toBe('test-key');
      expect(process.env.ANTHROPIC_BASE_URL).toBe('https://openrouter.ai/api');
    });

    it('should support custom base URL via DUYETBOT_BASE_URL', () => {
      delete process.env.ANTHROPIC_BASE_URL;
      delete process.env.ANTHROPIC_API_KEY;
      process.env.DUYETBOT_API_KEY = 'test-key';
      process.env.DUYETBOT_BASE_URL = 'https://custom.api/v1';
      process.env.GITHUB_TOKEN = 'ghp_test';

      loadConfig();

      expect(process.env.ANTHROPIC_BASE_URL).toBe('https://custom.api/v1');
    });

    it('should not override existing ANTHROPIC_BASE_URL', () => {
      process.env.ANTHROPIC_BASE_URL = 'https://existing.api/v1';
      process.env.DUYETBOT_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'ghp_test';

      loadConfig();

      expect(process.env.ANTHROPIC_BASE_URL).toBe('https://existing.api/v1');
    });

    it('should not override existing ANTHROPIC_API_KEY', () => {
      process.env.ANTHROPIC_API_KEY = 'existing-key';
      process.env.DUYETBOT_API_KEY = 'new-key';
      process.env.GITHUB_TOKEN = 'ghp_test';

      loadConfig();

      expect(process.env.ANTHROPIC_API_KEY).toBe('existing-key');
    });
  });
});
