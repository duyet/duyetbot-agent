/**
 * Tests for config validation schemas
 */

import { describe, expect, it } from 'vitest';
import {
  repositoryConfigSchema,
  autoMergeConfigSchema,
  selfImprovementConfigSchema,
  continuousConfigSchema,
  agentConfigSchema,
  serverConfigSchema,
  databaseConfigSchema,
  rateLimitConfigSchema,
  logConfigSchema,
  featureFlagSchema,
  effortConfigSchema,
  telegramConfigSchema,
  taskSourceValues,
} from '../config/index.js';

describe('repositoryConfigSchema', () => {
  it('should accept valid repository config', () => {
    const valid = { owner: 'duyet', name: 'duyetbot-agent' };
    expect(repositoryConfigSchema.parse(valid)).toEqual(valid);
  });

  it('should reject empty owner or name', () => {
    expect(() => repositoryConfigSchema.parse({ owner: '', name: 'repo' })).toThrow();
    expect(() => repositoryConfigSchema.parse({ owner: 'user', name: '' })).toThrow();
  });
});

describe('autoMergeConfigSchema', () => {
  it('should apply defaults', () => {
    const result = autoMergeConfigSchema.parse({});
    expect(result.enabled).toBe(false);
    expect(result.waitForChecks).toBe(true);
    expect(result.timeout).toBe(600000);
  });

  it('should accept valid config', () => {
    const valid = {
      enabled: true,
      requireChecks: ['ci-check'],
      waitForChecks: false,
      timeout: 300000,
      approveFirst: false,
      deleteBranch: false,
      closeIssueAfterMerge: true,
    };
    const result = autoMergeConfigSchema.parse(valid);
    expect(result.closeIssueAfterMerge).toBe(true);
  });
});

describe('selfImprovementConfigSchema', () => {
  it('should apply defaults', () => {
    const result = selfImprovementConfigSchema.parse({});
    expect(result.enableVerification).toBe(true);
    expect(result.enableAutoFix).toBe(false);
    expect(result.maxRecoveryAttempts).toBe(3);
  });
});

describe('continuousConfigSchema', () => {
  it('should apply defaults', () => {
    const result = continuousConfigSchema.parse({});
    expect(result.enabled).toBe(false);
    expect(result.maxTasks).toBe(100);
    expect(result.delayBetweenTasks).toBe(5000);
  });

  it('should accept valid config', () => {
    const valid = {
      enabled: true,
      maxTasks: 50,
      delayBetweenTasks: 10000,
      closeIssuesAfterMerge: false,
      stopOnFirstFailure: true,
    };
    const result = continuousConfigSchema.parse(valid);
    expect(result.maxTasks).toBe(50);
  });
});

describe('agentConfigSchema', () => {
  it('should apply defaults', () => {
    const valid = {
      apiKey: 'sk-test-key',
      githubToken: 'ghp-test-token',
    };
    const result = agentConfigSchema.parse(valid);
    expect(result.model).toBe('anthropic/claude-sonnet-4');
    expect(result.maxIterations).toBe(10);
    expect(result.dryRun).toBe(false);
    expect(result.taskSources).toEqual(taskSourceValues);
  });

  it('should accept valid config', () => {
    const valid = {
      apiKey: 'sk-test-key',
      githubToken: 'ghp-test-token',
      memoryMcpUrl: 'https://example.com/mcp',
      model: 'gpt-4',
      taskSources: ['github-issues', 'memory'],
      maxIterations: 20,
      checkpointDir: '.checkpoints',
      logDir: '.logs',
      dryRun: true,
      repository: {
        owner: 'duyet',
        name: 'duyetbot-agent',
      },
    };
    const result = agentConfigSchema.parse(valid);
    expect(result.model).toBe('gpt-4');
    expect(result.maxIterations).toBe(20);
  });

  it('should handle empty string as undefined for optional URL', () => {
    const valid = {
      apiKey: 'sk-test-key',
      githubToken: 'ghp-test-token',
      memoryMcpUrl: '',
    };
    const result = agentConfigSchema.parse(valid);
    expect(result.memoryMcpUrl).toBeUndefined();
  });
});

describe('serverConfigSchema', () => {
  it('should apply defaults', () => {
    const result = serverConfigSchema.parse({});
    expect(result.port).toBe(3000);
    expect(result.host).toBe('localhost');
  });

  it('should accept valid config', () => {
    const valid = {
      port: 8080,
      host: '0.0.0.0',
      cors: {
        origin: 'https://example.com',
        credentials: true,
      },
    };
    const result = serverConfigSchema.parse(valid);
    expect(result.port).toBe(8080);
    expect(result.cors?.origin).toBe('https://example.com');
  });
});

describe('databaseConfigSchema', () => {
  it('should accept SQLite config', () => {
    const valid = {
      type: 'sqlite' as const,
      path: './db.sqlite',
    };
    const result = databaseConfigSchema.parse(valid);
    expect(result.type).toBe('sqlite');
  });

  it('should accept URL-based config', () => {
    const valid = {
      type: 'postgres' as const,
      url: 'postgresql://localhost/db',
    };
    const result = databaseConfigSchema.parse(valid);
    expect(result.type).toBe('postgres');
  });
});

describe('rateLimitConfigSchema', () => {
  it('should apply defaults', () => {
    const result = rateLimitConfigSchema.parse({});
    expect(result.enabled).toBe(true);
    expect(result.windowMs).toBe(60000);
    expect(result.maxRequests).toBe(60);
  });

  it('should accept valid config', () => {
    const valid = {
      enabled: true,
      windowMs: 30000,
      maxRequests: 100,
      skipSuccessfulRequests: true,
    };
    const result = rateLimitConfigSchema.parse(valid);
    expect(result.maxRequests).toBe(100);
  });
});

describe('logConfigSchema', () => {
  it('should apply defaults', () => {
    const result = logConfigSchema.parse({});
    expect(result.level).toBe('info');
    expect(result.format).toBe('pretty');
  });

  it('should accept valid config', () => {
    const valid = {
      level: 'debug' as const,
      format: 'json' as const,
      file: './logs/app.log',
    };
    const result = logConfigSchema.parse(valid);
    expect(result.level).toBe('debug');
    expect(result.format).toBe('json');
  });
});

describe('featureFlagSchema', () => {
  it('should accept enabled feature', () => {
    const valid = {
      enabled: true,
      rolloutPercentage: 50,
      whitelist: ['user-1', 'user-2'],
      description: 'Test feature',
    };
    const result = featureFlagSchema.parse(valid);
    expect(result.enabled).toBe(true);
  });

  it('should reject rolloutPercentage when disabled', () => {
    const invalid = {
      enabled: false,
      rolloutPercentage: 50,
    };
    expect(() => featureFlagSchema.parse(invalid)).toThrow();
  });
});

describe('effortConfigSchema', () => {
  it('should apply defaults', () => {
    const result = effortConfigSchema.parse({});
    expect(result.level).toBe('normal');
    expect(result.maxIterations).toBe(10);
  });
});

describe('telegramConfigSchema', () => {
  it('should accept valid config', () => {
    const valid = {
      botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      webhookUrl: 'https://example.com/webhook',
      allowedUsers: [123456789, 'username'],
    };
    const result = telegramConfigSchema.parse(valid);
    expect(result.botToken).toBe(valid.botToken);
    expect(result.allowedUsers).toEqual(valid.allowedUsers);
  });

  it('should reject empty bot token', () => {
    const invalid = {
      botToken: '',
    };
    expect(() => telegramConfigSchema.parse(invalid)).toThrow();
  });
});
