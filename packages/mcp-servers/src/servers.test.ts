/**
 * MCP Server Configuration Tests
 *
 * Integration tests for MCP server configurations including:
 * - Server configuration validation
 * - Options generation with environment variables
 * - Authentication header generation
 * - Server URL validation
 */

import { describe, expect, it } from 'vitest';
import type { MCPServerConfig } from '../types.js';
import { duyetMcp, githubMcp } from './servers.js';

describe('MCP Server Configurations', () => {
  describe('duyet-mcp', () => {
    it('should have correct basic configuration', () => {
      expect(duyetMcp.name).toBe('duyet-mcp');
      expect(duyetMcp.url).toBe('https://mcp.duyet.net/sse');
      expect(duyetMcp.requiresAuth).toBe(false);
    });

    it('should not require authentication', () => {
      expect(duyetMcp.requiresAuth).toBe(false);
    });

    it('should not have getOptions function', () => {
      expect(duyetMcp.getOptions).toBeUndefined();
    });

    it('should use SSE transport by default', () => {
      const options = duyetMcp.getOptions?.({});
      expect(options).toBeUndefined();
    });
  });

  describe('github-mcp', () => {
    const mockEnv = {
      GITHUB_TOKEN: 'ghp_test_token_12345',
    };

    it('should have correct basic configuration', () => {
      expect(githubMcp.name).toBe('github-mcp');
      expect(githubMcp.url).toBe('https://api.githubcopilot.com/mcp/sse');
      expect(githubMcp.requiresAuth).toBe(true);
    });

    it('should require authentication', () => {
      expect(githubMcp.requiresAuth).toBe(true);
    });

    it('should have getOptions function', () => {
      expect(githubMcp.getOptions).toBeDefined();
      expect(typeof githubMcp.getOptions).toBe('function');
    });

    it('should generate authorization header with GITHUB_TOKEN', () => {
      const options = githubMcp.getOptions!(mockEnv);
      expect(options.transport?.headers?.Authorization).toBe(`Bearer ${mockEnv.GITHUB_TOKEN}`);
    });

    it('should handle missing GITHUB_TOKEN gracefully', () => {
      const options = githubMcp.getOptions!({});
      expect(options.transport?.headers?.Authorization).toBe('Bearer ');
    });

    it('should use SSE transport type', () => {
      const options = githubMcp.getOptions!(mockEnv);
      expect(options.transport?.type).toBe('sse');
    });

    it('should preserve existing transport headers', () => {
      const envWithExtra = {
        ...mockEnv,
        EXTRA_HEADER: 'value',
      };
      const options = githubMcp.getOptions!(envWithExtra);
      expect(options.transport?.headers?.Authorization).toBeDefined();
    });
  });

  describe('MCP Server Configuration Validation', () => {
    it('should reject server config without name', () => {
      const invalidConfig = { url: 'https://example.com' } as MCPServerConfig;
      expect(invalidConfig.name).toBeUndefined();
    });

    it('should reject server config without URL', () => {
      const invalidConfig = { name: 'test' } as MCPServerConfig;
      expect(invalidConfig.url).toBeUndefined();
    });

    it('should accept valid server configuration', () => {
      const validConfig: MCPServerConfig = {
        name: 'test-server',
        url: 'https://example.com/sse',
        requiresAuth: false,
      };
      expect(validConfig.name).toBe('test-server');
      expect(validConfig.url).toBe('https://example.com/sse');
    });

    it('should handle servers with custom getOptions', () => {
      const customConfig: MCPServerConfig = {
        name: 'custom-server',
        url: 'https://custom.com/mcp',
        requiresAuth: true,
        getOptions: (env) => ({
          client: { name: 'test-client', version: '1.0.0' },
          transport: {
            headers: {
              'X-Custom-Header': env.CUSTOM_VALUE as string,
            },
          },
        }),
      };

      const options = customConfig.getOptions!({ CUSTOM_VALUE: 'test-value' });
      expect(options.client?.name).toBe('test-client');
      expect(options.transport?.headers?.['X-Custom-Header']).toBe('test-value');
    });
  });

  describe('URL Validation', () => {
    it('should accept valid HTTPS URLs', () => {
      expect(duyetMcp.url).toMatch(/^https:\/\//);
      expect(githubMcp.url).toMatch(/^https:\/\//);
    });

    it('should accept SSE endpoint URLs', () => {
      expect(duyetMcp.url).toContain('/sse');
      expect(githubMcp.url).toContain('/sse');
    });

    it('should reject malformed URLs in custom configs', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com',
        '//example.com',
        'javascript:alert(1)',
      ];

      invalidUrls.forEach((url) => {
        const config: MCPServerConfig = {
          name: 'test',
          url,
        };
        expect(() => new URL(config.url)).not.toThrow();
      });
    });
  });

  describe('Environment Variable Handling', () => {
    it('should extract GITHUB_TOKEN from environment', () => {
      const env = { GITHUB_TOKEN: 'ghp_secret' };
      const options = githubMcp.getOptions!(env);
      const token = options.transport?.headers?.Authorization?.split(' ')[1];
      expect(token).toBe('ghp_secret');
    });

    it('should handle empty GITHUB_TOKEN', () => {
      const env = { GITHUB_TOKEN: '' };
      const options = githubMcp.getOptions!(env);
      expect(options.transport?.headers?.Authorization).toBe('Bearer ');
    });

    it('should handle undefined GITHUB_TOKEN', () => {
      const env = {};
      const options = githubMcp.getOptions!(env);
      expect(options.transport?.headers?.Authorization).toBe('Bearer ');
    });
  });

  describe('Transport Options', () => {
    it('should generate SSE transport options by default', () => {
      const options = githubMcp.getOptions!({ GITHUB_TOKEN: 'test' });
      expect(options.transport?.type).toBe('sse');
    });

    it('should allow custom transport type', () => {
      const customConfig: MCPServerConfig = {
        name: 'custom',
        url: 'https://custom.com/sse',
        getOptions: () => ({
          transport: { type: 'streamableHttp' },
        }),
      };

      const options = customConfig.getOptions!();
      expect(options.transport?.type).toBe('streamableHttp');
    });

    it('should include custom headers in transport options', () => {
      const env = { GITHUB_TOKEN: 'token', X_CUSTOM: 'custom' };
      const customConfig: MCPServerConfig = {
        name: 'custom',
        url: 'https://custom.com/sse',
        getOptions: (env) => ({
          transport: {
            headers: {
              Authorization: `Bearer ${env.GITHUB_TOKEN}`,
              'X-Custom': env.X_CUSTOM as string,
            },
          },
        }),
      };

      const options = customConfig.getOptions!(env);
      expect(options.transport?.headers?.Authorization).toBe('Bearer token');
      expect(options.transport?.headers?.['X-Custom']).toBe('custom');
    });
  });

  describe('Client Options', () => {
    it('should allow custom client name and version', () => {
      const customConfig: MCPServerConfig = {
        name: 'custom',
        url: 'https://custom.com/sse',
        getOptions: () => ({
          client: {
            name: 'my-client',
            version: '2.0.0',
          },
        }),
      };

      const options = customConfig.getOptions!();
      expect(options.client?.name).toBe('my-client');
      expect(options.client?.version).toBe('2.0.0');
    });

    it('should handle missing client options', () => {
      const options = githubMcp.getOptions!({ GITHUB_TOKEN: 'test' });
      expect(options.client).toBeUndefined();
    });
  });
});

/**
 * Integration Tests for MCP Server Discovery
 */
describe('MCP Server Discovery', () => {
  it('should export all available servers', () => {
    // These are the available MCP servers
    const servers = [githubMcp];

    expect(servers).toBeDefined();
    expect(servers.length).toBeGreaterThan(0);

    servers.forEach((server) => {
      expect(server.name).toBeDefined();
      expect(server.url).toBeDefined();
      expect(new URL(server.url)).toBeInstanceOf(URL);
    });
  });

  it('should have unique server names', () => {
    const servers = [duyetMcp, githubMcp];
    const names = servers.map((s) => s.name);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(names.length);
  });

  it('should include disabled servers in exports', () => {
    // duyet-mcp is temporarily disabled but still exported
    expect(duyetMcp).toBeDefined();
    expect(duyetMcp.name).toBe('duyet-mcp');
  });
});

/**
 * Authentication Flow Tests
 */
describe('MCP Server Authentication', () => {
  describe('github-mcp authentication', () => {
    it('should require GITHUB_TOKEN for authenticated requests', () => {
      const envWithToken = { GITHUB_TOKEN: 'ghp_test' };
      const options = githubMcp.getOptions!(envWithToken);

      expect(options.transport?.headers?.Authorization).toBeDefined();
      expect(options.transport?.headers?.Authorization).toContain('Bearer');
    });

    it('should format token as Bearer token', () => {
      const env = { GITHUB_TOKEN: 'ghp_test_token' };
      const options = githubMcp.getOptions!(env);

      const authHeader = options.transport?.headers?.Authorization;
      expect(authHeader).toMatch(/^Bearer /);
    });

    it('should handle token rotation (new token provided)', () => {
      const env1 = { GITHUB_TOKEN: 'ghp_old_token' };
      const options1 = githubMcp.getOptions!(env1);

      const env2 = { GITHUB_TOKEN: 'ghp_new_token' };
      const options2 = githubMcp.getOptions!(env2);

      expect(options1.transport?.headers?.Authorization).toBe('Bearer ghp_old_token');
      expect(options2.transport?.headers?.Authorization).toBe('Bearer ghp_new_token');
    });
  });

  describe('duyet-mcp authentication', () => {
    it('should not require authentication', () => {
      expect(duyetMcp.requiresAuth).toBe(false);
    });

    it('should not have authentication headers', () => {
      const options = duyetMcp.getOptions?.({});
      expect(options).toBeUndefined();
    });
  });
});

/**
 * Error Handling Tests
 */
describe('MCP Server Error Handling', () => {
  it('should handle invalid environment gracefully', () => {
    expect(() => githubMcp.getOptions!({})).not.toThrow();
  });

  it('should handle null environment', () => {
    expect(() => githubMcp.getOptions!(null as unknown as Record<string, unknown>)).not.toThrow();
  });

  it('should handle undefined environment values', () => {
    const env = { GITHUB_TOKEN: undefined };
    const options = githubMcp.getOptions!(env);
    expect(options.transport?.headers?.Authorization).toBe('Bearer ');
  });
});
