/**
 * SDK Flow Integration Tests
 *
 * Tests the core SDK query flow
 */

import { describe, expect, it, vi } from 'vitest';
import { createDefaultOptions, query, toSDKTools } from '@duyetbot/core';
import { getAllBuiltinTools } from '@duyetbot/tools';

// These tests use mocked SDK to verify the integration patterns work correctly

vi.mock('@duyetbot/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@duyetbot/core')>();
  return {
    ...original,
    query: vi.fn(async function* (message: string, options: unknown) {
      yield { type: 'user', content: message };
      yield { type: 'assistant', content: `Response to: ${message}` };
      yield { type: 'result', content: `Response to: ${message}` };
    }),
  };
});

describe('SDK Flow Integration', () => {
  describe('Query Execution', () => {
    it('should execute query with default options', async () => {
      const tools = toSDKTools(getAllBuiltinTools());
      const options = createDefaultOptions({
        model: 'sonnet',
        sessionId: 'test-session',
        tools,
      });

      const messages: unknown[] = [];
      for await (const msg of query('Hello SDK', options)) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(3);
      expect(messages[0]).toEqual({ type: 'user', content: 'Hello SDK' });
      expect(messages[1]).toEqual({ type: 'assistant', content: 'Response to: Hello SDK' });
      expect(messages[2]).toEqual({ type: 'result', content: 'Response to: Hello SDK' });
    });

    it('should handle multiple queries in sequence', async () => {
      const options = createDefaultOptions({
        model: 'sonnet',
        sessionId: 'test-session',
      });

      // First query
      let result1 = '';
      for await (const msg of query('Query 1', options)) {
        if ((msg as { type: string }).type === 'result') {
          result1 = (msg as { content: string }).content;
        }
      }

      // Second query
      let result2 = '';
      for await (const msg of query('Query 2', options)) {
        if ((msg as { type: string }).type === 'result') {
          result2 = (msg as { content: string }).content;
        }
      }

      expect(result1).toBe('Response to: Query 1');
      expect(result2).toBe('Response to: Query 2');
    });

    it('should work with different models', async () => {
      const models = ['sonnet', 'haiku', 'opus'] as const;

      for (const model of models) {
        const options = createDefaultOptions({
          model,
          sessionId: `test-${model}`,
        });

        const messages: unknown[] = [];
        for await (const msg of query(`Test ${model}`, options)) {
          messages.push(msg);
        }

        expect(messages).toHaveLength(3);
      }
    });
  });

  describe('Tool Integration', () => {
    it('should convert builtin tools to SDK format', () => {
      const tools = getAllBuiltinTools();
      const sdkTools = toSDKTools(tools);

      expect(sdkTools).toBeDefined();
      expect(Array.isArray(sdkTools)).toBe(true);
      expect(sdkTools.length).toBe(tools.length);

      // Verify each tool has required properties
      for (const tool of sdkTools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.handler).toBeDefined();
        expect(typeof tool.handler).toBe('function');
      }
    });

    it('should include all expected builtin tools', () => {
      const tools = getAllBuiltinTools();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain('bash');
      expect(toolNames).toContain('git');
      expect(toolNames).toContain('research');
      expect(toolNames).toContain('plan');
      expect(toolNames).toContain('sleep');
    });
  });

  describe('Session Management', () => {
    it('should create options with unique session IDs', () => {
      const options1 = createDefaultOptions({
        model: 'sonnet',
        sessionId: 'session-1',
      });

      const options2 = createDefaultOptions({
        model: 'sonnet',
        sessionId: 'session-2',
      });

      expect(options1).toBeDefined();
      expect(options2).toBeDefined();
      // Options should be separate objects
      expect(options1).not.toBe(options2);
    });

    it('should handle system prompts', () => {
      const systemPrompt = 'You are a helpful assistant for testing.';
      const options = createDefaultOptions({
        model: 'sonnet',
        sessionId: 'test',
        systemPrompt,
      });

      expect(options).toBeDefined();
    });
  });
});
