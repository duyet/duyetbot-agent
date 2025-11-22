/**
 * SDK Integration Tests
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  type QueryOptions,
  createDefaultOptions,
  mergeOptions,
  validateOptions,
} from '../options.js';
import { collectMessages, createQueryController, query, querySingle } from '../query.js';
import {
  createDefaultSubagentRegistry,
  createSubagent,
  createSubagentOptions,
  createSubagentRegistry,
  filterToolsForSubagent,
  predefinedSubagents,
} from '../subagent.js';
import {
  composeTools,
  convertToSDKTool,
  getAllToolMetadata,
  getToolMetadata,
  sdkTool,
  simpleTool,
  toSDKResult,
} from '../tool.js';
import type { SDKTool, SDKToolResult } from '../types.js';

describe('SDK Options', () => {
  describe('createDefaultOptions', () => {
    it('should create options with sensible defaults', () => {
      const options = createDefaultOptions();

      expect(options.model).toBe('sonnet');
      expect(options.permissionMode).toBe('default');
      expect(options.maxTokens).toBe(8192);
      expect(options.temperature).toBe(0.7);
      expect(options.timeout).toBe(300000);
    });

    it('should allow overriding defaults', () => {
      const options = createDefaultOptions({
        model: 'haiku',
        maxTokens: 4096,
      });

      expect(options.model).toBe('haiku');
      expect(options.maxTokens).toBe(4096);
      expect(options.permissionMode).toBe('default');
    });
  });

  describe('mergeOptions', () => {
    it('should merge options correctly', () => {
      const defaults = createDefaultOptions();
      const overrides: Partial<QueryOptions> = {
        model: 'opus',
        metadata: { key: 'value' },
      };

      const merged = mergeOptions(defaults, overrides);

      expect(merged.model).toBe('opus');
      expect(merged.metadata?.key).toBe('value');
      expect(merged.permissionMode).toBe('default');
    });

    it('should concatenate arrays', () => {
      const tool1 = sdkTool('t1', 'desc1', z.string(), async (s) => s);
      const tool2 = sdkTool('t2', 'desc2', z.string(), async (s) => s);

      const defaults: QueryOptions = { tools: [tool1] };
      const overrides: Partial<QueryOptions> = { tools: [tool2] };

      const merged = mergeOptions(defaults, overrides);

      expect(merged.tools).toHaveLength(2);
    });
  });

  describe('validateOptions', () => {
    it('should validate correct options', () => {
      const options = createDefaultOptions();
      const result = validateOptions(options);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid permission mode', () => {
      const options: QueryOptions = {
        permissionMode: 'invalid' as any,
      };
      const result = validateOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid permission mode: invalid');
    });

    it('should reject invalid temperature', () => {
      const options: QueryOptions = { temperature: 3 };
      const result = validateOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Temperature must be between 0 and 2');
    });

    it('should reject negative max tokens', () => {
      const options: QueryOptions = { maxTokens: -1 };
      const result = validateOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Max tokens must be at least 1');
    });

    it('should validate MCP server config', () => {
      const options: QueryOptions = {
        mcpServers: [{ type: 'http' }], // Missing URL
      };
      const result = validateOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTTP MCP server must have a URL');
    });

    it('should validate subagent config', () => {
      const options: QueryOptions = {
        agents: [{ name: '', description: 'test' }], // Empty name
      };
      const result = validateOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Subagent must have a name');
    });
  });
});

describe('SDK Tool', () => {
  describe('sdkTool', () => {
    it('should create a tool with correct structure', () => {
      const tool = sdkTool(
        'test',
        'Test tool',
        z.object({ value: z.string() }),
        async ({ value }) => ({ result: value })
      );

      expect(tool.name).toBe('test');
      expect(tool.description).toBe('Test tool');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.handler).toBeInstanceOf(Function);
    });

    it('should execute handler correctly', async () => {
      const tool = sdkTool(
        'echo',
        'Echo tool',
        z.object({ message: z.string() }),
        async ({ message }) => ({ echo: message })
      );

      const result = await tool.handler({ message: 'hello' });
      expect(result).toEqual({ echo: 'hello' });
    });
  });

  describe('simpleTool', () => {
    it('should create a simple string-returning tool', async () => {
      const tool = simpleTool(
        'greet',
        'Greeting tool',
        z.object({ name: z.string() }),
        ({ name }) => `Hello, ${name}!`
      );

      const result = await tool.handler({ name: 'World' });
      expect(result.content).toBe('Hello, World!');
      expect(result.isError).toBeFalsy();
    });

    it('should handle errors', async () => {
      const tool = simpleTool('error', 'Error tool', z.string(), () => {
        throw new Error('Test error');
      });

      const result = await tool.handler('input');
      expect(result.content).toBe('Test error');
      expect(result.isError).toBe(true);
    });
  });

  describe('toSDKResult', () => {
    it('should convert string to SDK result', () => {
      const result = toSDKResult('test output');
      expect(result.content).toBe('test output');
      expect(result.isError).toBeFalsy();
    });

    it('should convert object to JSON string', () => {
      const result = toSDKResult({ key: 'value' });
      expect(result.content).toContain('"key": "value"');
    });

    it('should preserve SDK result structure', () => {
      const input: SDKToolResult = { content: 'test', isError: true };
      const result = toSDKResult(input);
      expect(result).toEqual(input);
    });
  });

  describe('convertToSDKTool', () => {
    it('should convert duyetbot tool format to SDK format', async () => {
      const legacyTool = {
        name: 'legacy',
        description: 'Legacy tool',
        inputSchema: z.string(),
        execute: async (input: { content: unknown }) => ({
          status: 'success',
          content: `Processed: ${input.content}`,
        }),
      };

      const sdkTool = convertToSDKTool(legacyTool);
      const result = await sdkTool.handler('input');

      expect(sdkTool.name).toBe('legacy');
      expect(result.content).toBe('Processed: input');
      expect(result.isError).toBe(false);
    });
  });

  describe('composeTools', () => {
    it('should create a map of tools', () => {
      const tool1 = sdkTool('t1', 'd1', z.string(), async (s) => s);
      const tool2 = sdkTool('t2', 'd2', z.string(), async (s) => s);

      const registry = composeTools([tool1, tool2]);

      expect(registry.size).toBe(2);
      expect(registry.get('t1')).toBe(tool1);
      expect(registry.get('t2')).toBe(tool2);
    });
  });

  describe('getToolMetadata', () => {
    it('should extract tool metadata', () => {
      const tool = sdkTool('test', 'Test desc', z.string(), async (s) => s);
      const metadata = getToolMetadata(tool);

      expect(metadata.name).toBe('test');
      expect(metadata.description).toBe('Test desc');
      expect(metadata.input_schema).toBeDefined();
    });
  });

  describe('getAllToolMetadata', () => {
    it('should get metadata for all tools', () => {
      const tools = [
        sdkTool('t1', 'd1', z.string(), async (s) => s),
        sdkTool('t2', 'd2', z.string(), async (s) => s),
      ];

      const metadata = getAllToolMetadata(tools);

      expect(metadata).toHaveLength(2);
      expect(metadata[0].name).toBe('t1');
      expect(metadata[1].name).toBe('t2');
    });
  });
});

describe('SDK Query', () => {
  describe('createQueryController', () => {
    it('should create a controller with interrupt capability', () => {
      const controller = createQueryController();

      expect(controller.interrupt).toBeInstanceOf(Function);
      expect(controller.signal).toBeDefined();
      expect(controller.signal.aborted).toBe(false);
    });

    it('should abort when interrupt is called', () => {
      const controller = createQueryController();
      controller.interrupt();

      expect(controller.signal.aborted).toBe(true);
    });
  });

  describe('query', () => {
    it('should yield user message first', { timeout: 10000 }, async () => {
      const messages = [];
      for await (const message of query('test input', createDefaultOptions())) {
        messages.push(message);
        if (messages.length >= 2) {
          break; // Limit for test
        }
      }

      expect(messages[0].type).toBe('user');
      expect(messages[0].content).toBe('test input');
    });

    it('should generate session ID if not provided', async () => {
      const messages = [];
      for await (const message of query('test', createDefaultOptions())) {
        messages.push(message);
        if (messages.length >= 1) {
          break;
        }
      }

      expect(messages[0].sessionId).toBeDefined();
      expect(messages[0].sessionId).toMatch(/^session_/);
    });

    it('should use provided session ID', async () => {
      const options = createDefaultOptions({ sessionId: 'custom-session' });
      const messages = [];

      for await (const message of query('test', options)) {
        messages.push(message);
        if (messages.length >= 1) {
          break;
        }
      }

      expect(messages[0].sessionId).toBe('custom-session');
    });

    it('should handle interrupt', { timeout: 10000 }, async () => {
      const controller = createQueryController();

      const messages = [];
      for await (const message of query('test', createDefaultOptions(), controller)) {
        messages.push(message);
        // Interrupt after receiving user message
        if (message.type === 'user') {
          controller.interrupt();
        }
      }

      // Should have at least user message and stop cleanly
      // The SDK handles interrupt internally, may or may not yield an interrupt message
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].type).toBe('user');
    });
  });

  describe('querySingle', () => {
    it('should return a result message', async () => {
      const result = await querySingle('test', createDefaultOptions());

      expect(result.type).toBe('result');
      expect(result.content).toBeDefined();
    });
  });

  describe('collectMessages', () => {
    it('should collect all messages', async () => {
      const messages = await collectMessages('test', createDefaultOptions());

      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);
    });
  });
});

describe('SDK Subagent', () => {
  describe('createSubagent', () => {
    it('should create a subagent config', () => {
      const agent = createSubagent({
        name: 'test',
        description: 'Test agent',
        tools: ['bash'],
        model: 'haiku',
      });

      expect(agent.name).toBe('test');
      expect(agent.description).toBe('Test agent');
      expect(agent.tools).toEqual(['bash']);
      expect(agent.model).toBe('haiku');
    });
  });

  describe('predefinedSubagents', () => {
    it('should have researcher subagent', () => {
      expect(predefinedSubagents.researcher).toBeDefined();
      expect(predefinedSubagents.researcher.name).toBe('researcher');
    });

    it('should have codeReviewer subagent', () => {
      expect(predefinedSubagents.codeReviewer).toBeDefined();
      expect(predefinedSubagents.codeReviewer.name).toBe('code_reviewer');
    });

    it('should have planner subagent', () => {
      expect(predefinedSubagents.planner).toBeDefined();
      expect(predefinedSubagents.planner.name).toBe('planner');
    });

    it('should have gitOperator subagent', () => {
      expect(predefinedSubagents.gitOperator).toBeDefined();
      expect(predefinedSubagents.gitOperator.name).toBe('git_operator');
    });

    it('should have githubAgent subagent', () => {
      expect(predefinedSubagents.githubAgent).toBeDefined();
      expect(predefinedSubagents.githubAgent.name).toBe('github_agent');
    });
  });

  describe('filterToolsForSubagent', () => {
    it('should filter tools based on subagent config', () => {
      const tools: SDKTool[] = [
        sdkTool('bash', 'd', z.string(), async (s) => s),
        sdkTool('git', 'd', z.string(), async (s) => s),
        sdkTool('research', 'd', z.string(), async (s) => s),
      ];

      const agent = createSubagent({
        name: 'test',
        description: 'test',
        tools: ['bash', 'git'],
      });

      const filtered = filterToolsForSubagent(tools, agent);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.name)).toEqual(['bash', 'git']);
    });

    it('should return all tools if no filter specified', () => {
      const tools: SDKTool[] = [
        sdkTool('bash', 'd', z.string(), async (s) => s),
        sdkTool('git', 'd', z.string(), async (s) => s),
      ];

      const agent = createSubagent({
        name: 'test',
        description: 'test',
      });

      const filtered = filterToolsForSubagent(tools, agent);

      expect(filtered).toHaveLength(2);
    });
  });

  describe('createSubagentOptions', () => {
    it('should create options for subagent execution', () => {
      const parentOptions = createDefaultOptions({ sessionId: 'parent' });
      const tools: SDKTool[] = [sdkTool('bash', 'd', z.string(), async (s) => s)];
      const agent = createSubagent({
        name: 'test',
        description: 'test',
        model: 'haiku',
        prompt: 'Custom prompt',
      });

      const subOptions = createSubagentOptions(parentOptions, agent, tools);

      expect(subOptions.model).toBe('haiku');
      expect(subOptions.systemPrompt).toBe('Custom prompt');
      expect(subOptions.sessionId).toContain('parent_test_');
      expect(subOptions.resume).toBeUndefined();
    });
  });

  describe('SubagentRegistry', () => {
    it('should register and retrieve subagents', () => {
      const registry = createSubagentRegistry();
      const agent = createSubagent({
        name: 'test',
        description: 'test',
      });

      registry.register(agent);

      expect(registry.has('test')).toBe(true);
      expect(registry.get('test')).toEqual(agent);
    });

    it('should list all subagents', () => {
      const registry = createSubagentRegistry();
      registry.register(createSubagent({ name: 'a', description: 'a' }));
      registry.register(createSubagent({ name: 'b', description: 'b' }));

      const list = registry.list();

      expect(list).toHaveLength(2);
    });

    it('should unregister subagents', () => {
      const registry = createSubagentRegistry();
      registry.register(createSubagent({ name: 'test', description: 'test' }));
      registry.unregister('test');

      expect(registry.has('test')).toBe(false);
    });

    it('should clear all subagents', () => {
      const registry = createSubagentRegistry();
      registry.register(createSubagent({ name: 'a', description: 'a' }));
      registry.register(createSubagent({ name: 'b', description: 'b' }));
      registry.clear();

      expect(registry.list()).toHaveLength(0);
    });

    it('should get metadata for all subagents', () => {
      const registry = createSubagentRegistry();
      registry.register(createSubagent({ name: 'a', description: 'Desc A' }));
      registry.register(createSubagent({ name: 'b', description: 'Desc B' }));

      const metadata = registry.getMetadata();

      expect(metadata).toHaveLength(2);
      expect(metadata[0]).toEqual({ name: 'a', description: 'Desc A' });
    });
  });

  describe('createDefaultSubagentRegistry', () => {
    it('should create registry with predefined subagents', () => {
      const registry = createDefaultSubagentRegistry();

      expect(registry.has('researcher')).toBe(true);
      expect(registry.has('code_reviewer')).toBe(true);
      expect(registry.has('planner')).toBe(true);
      expect(registry.has('git_operator')).toBe(true);
      expect(registry.has('github_agent')).toBe(true);
    });
  });
});
