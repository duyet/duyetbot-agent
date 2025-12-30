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
        openrouterApiKey: 'test-key',
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

    it('should require openrouterApiKey', () => {
      const result = configSchema.safeParse({
        githubToken: 'ghp_test',
      });

      expect(result.success).toBe(false);
    });

    it('should require githubToken', () => {
      const result = configSchema.safeParse({
        openrouterApiKey: 'test-key',
      });

      expect(result.success).toBe(false);
    });

    it('should accept valid memoryMcpUrl', () => {
      const result = configSchema.safeParse({
        openrouterApiKey: 'test-key',
        githubToken: 'ghp_test',
        memoryMcpUrl: 'https://memory.example.com',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid memoryMcpUrl', () => {
      const result = configSchema.safeParse({
        openrouterApiKey: 'test-key',
        githubToken: 'ghp_test',
        memoryMcpUrl: 'not-a-url',
      });

      expect(result.success).toBe(false);
    });

    it('should parse repository from GITHUB_REPOSITORY format', () => {
      const result = configSchema.safeParse({
        openrouterApiKey: 'test-key',
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
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.GITHUB_TOKEN = 'ghp_test_token';
      process.env.GITHUB_REPOSITORY = 'duyet/duyetbot-agent';

      const config = loadConfig();

      expect(config.openrouterApiKey).toBe('test-openrouter-key');
      expect(config.githubToken).toBe('ghp_test_token');
      expect(config.repository?.owner).toBe('duyet');
      expect(config.repository?.name).toBe('duyetbot-agent');
    });

    it('should parse DRY_RUN correctly', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'ghp_test';
      process.env.DRY_RUN = 'true';

      const config = loadConfig();

      expect(config.dryRun).toBe(true);
    });

    it('should throw on missing required keys', () => {
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.GITHUB_TOKEN;

      expect(() => loadConfig()).toThrow();
    });
  });
});
