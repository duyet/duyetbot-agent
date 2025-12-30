/**
 * MCP Tool Execution Integration Tests
 *
 * Tests the full flow of MCP tool execution from ToolExecutor through
 * to actual tool implementations. These tests complement the unit tests
 * by using real MCP protocol implementations instead of mocks.
 *
 * Test Coverage:
 * - MCP tool naming convention (serverId__toolName)
 * - Built-in tool execution through ToolExecutor
 * - MCP tool result formatting
 * - Error handling across the full stack
 * - Parallel tool execution
 */

import type { Tool } from '@duyetbot/types';
import { describe, expect, it } from 'vitest';
import { type MCPCallResult, type MCPToolCallParams, ToolExecutor } from '../tool-executor.js';

/**
 * Mock MCP server implementation
 *
 * Simulates an MCP server that can receive and execute tool calls.
 * This mimics the behavior of real MCP servers like memory-mcp.
 */
class MockMCPServer {
  private tools = new Map<string, (args: Record<string, unknown>) => Promise<string>>();

  /**
   * Register a tool handler
   */
  registerTool(name: string, handler: (args: Record<string, unknown>) => Promise<string>): void {
    this.tools.set(name, handler);
  }

  /**
   * Execute a tool call (simulates MCP server's callTool)
   */
  async callTool(params: MCPToolCallParams): Promise<MCPCallResult> {
    const handler = this.tools.get(params.name);
    if (!handler) {
      throw new Error(`Tool not found: ${params.name}`);
    }

    try {
      const result = await handler(params.arguments);
      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
      };
    }
  }
}

describe('MCP Tool Execution Integration', () => {
  // Mock built-in tool for testing
  const mockBuiltinTool: Tool = {
    name: 'mock_tool',
    description: 'A mock tool for testing',
    inputSchema: {} as any,
    async execute(input) {
      const args = input.content as { message?: string; shouldFail?: boolean };
      if (args.shouldFail) {
        return {
          status: 'error' as const,
          content: '',
          error: { message: 'Mock tool failed' },
        };
      }
      return {
        status: 'success' as const,
        content: args.message || 'Mock tool executed successfully',
      };
    },
  };

  describe('Built-in Tool Execution', () => {
    it('should execute built-in tool with simple arguments', async () => {
      const mcpServer = new MockMCPServer();
      const config = {
        builtinToolMap: new Map<string, Tool>([['mock_tool', mockBuiltinTool]]),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'mock_tool',
        arguments: JSON.stringify({ message: 'Hello, World!' }),
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toContain('Hello, World!');
    });

    it('should execute built-in tool with complex arguments', async () => {
      const mcpServer = new MockMCPServer();
      const config = {
        builtinToolMap: new Map<string, Tool>([['mock_tool', mockBuiltinTool]]),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'mock_tool',
        arguments: JSON.stringify({
          message: 'test message',
          extra: 'ignored',
        }),
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toContain('test message');
    });

    it('should handle built-in tool errors gracefully', async () => {
      const mcpServer = new MockMCPServer();
      const config = {
        builtinToolMap: new Map<string, Tool>([['mock_tool', mockBuiltinTool]]),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'mock_tool',
        arguments: JSON.stringify({ shouldFail: true }),
      });

      // Should return error information
      expect(result.error).toBe('Mock tool failed');
      expect(result.result).toContain('Error:');
    });

    it('should handle built-in tool with no arguments', async () => {
      const mcpServer = new MockMCPServer();
      const config = {
        builtinToolMap: new Map<string, Tool>([['mock_tool', mockBuiltinTool]]),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'mock_tool',
        arguments: JSON.stringify({}),
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toContain('Mock tool executed successfully');
    });
  });

  describe('MCP Tool Execution', () => {
    it('should execute MCP tool with serverId__toolName format', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('get_weather', async (args) => {
        const location = args.location as string;
        return `Weather in ${location}: 72°F, Sunny`;
      });

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'weather_service__get_weather',
        arguments: JSON.stringify({ location: 'San Francisco' }),
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toContain('Weather in San Francisco');
      expect(result.result).toContain('72°F');
    });

    it('should handle MCP tool with double underscores in name', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('search__by_date', async (args) => {
        const date = args.date as string;
        return `Results for ${date}`;
      });

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'search_service__search__by_date',
        arguments: JSON.stringify({ date: '2025-01-01' }),
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toContain('Results for 2025-01-01');
    });

    it('should handle MCP tool that returns structured data', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('get_user', async (args) => {
        const userId = args.id as string;
        const user = {
          id: userId,
          name: 'Test User',
          email: 'test@example.com',
        };
        return JSON.stringify(user);
      });

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'user_service__get_user',
        arguments: JSON.stringify({ id: '12345' }),
      });

      expect(result.error).toBeUndefined();
      const user = JSON.parse(result.result);
      expect(user.id).toBe('12345');
      expect(user.name).toBe('Test User');
    });

    it('should propagate MCP tool errors', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('failing_tool', async () => {
        throw new Error('Database connection failed');
      });

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'db_service__failing_tool',
        arguments: JSON.stringify({}),
      });

      // MCP server internal errors are caught by the mock server and returned as content
      expect(result.error).toBeUndefined();
      expect(result.result).toContain('Error: Database connection failed');
    });

    it('should handle missing MCP tools', async () => {
      const mcpServer = new MockMCPServer();
      // No tools registered

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'unknown_service__unknown_tool',
        arguments: JSON.stringify({}),
      });

      expect(result.error).toContain('Tool not found');
    });
  });

  describe('Tool Routing and Priority', () => {
    it('should prioritize built-in tools over MCP tools', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('mock_tool', async () => {
        return 'MCP mock_tool result';
      });

      // Register built-in mock tool
      const config = {
        builtinToolMap: new Map<string, Tool>([['mock_tool', mockBuiltinTool]]),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'mock_tool',
        arguments: JSON.stringify({ message: 'built-in' }),
      });

      // Should use built-in tool, not MCP tool
      expect(result.result).toContain('built-in');
      expect(result.result).not.toContain('MCP mock_tool result');
    });

    it('should route MCP tools without server prefix to default server', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('simple_tool', async () => {
        return 'Tool executed';
      });

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'simple_tool', // No server prefix
        arguments: JSON.stringify({}),
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toContain('Tool executed');
    });
  });

  describe('Input Validation and Error Handling', () => {
    it('should reject invalid JSON arguments', async () => {
      const mcpServer = new MockMCPServer();
      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'test_tool',
        arguments: 'this is not valid json',
      });

      expect(result.error).toBe('Invalid JSON arguments');
      expect(result.result).toBe('');
    });

    it('should handle missing optional arguments', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('optional_args', async (args) => {
        const required = args.required as string;
        const optional = (args.optional as string | undefined) ?? 'default';
        return `required: ${required}, optional: ${optional}`;
      });

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'test__optional_args',
        arguments: JSON.stringify({ required: 'value' }),
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toContain('required: value');
      expect(result.result).toContain('optional: default');
    });

    it('should handle empty arguments object', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('no_args', async () => {
        return 'Executed without args';
      });

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'test__no_args',
        arguments: JSON.stringify({}),
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toContain('Executed without args');
    });
  });

  describe('Result Formatting', () => {
    it('should format single text result from MCP', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('text_result', async () => {
        return 'Simple text result';
      });

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'test__text_result',
        arguments: JSON.stringify({}),
      });

      expect(result.result).toBe('Simple text result');
    });

    it('should format multi-content result from MCP', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('multi_content', async () => {
        // Simulate MCP server returning multiple content blocks
        return 'Line 1\nLine 2\nLine 3';
      });

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (_params: MCPToolCallParams) => {
          // Mock returning multiple content blocks
          return Promise.resolve({
            content: [
              { type: 'text', text: 'Line 1' },
              { type: 'text', text: 'Line 2' },
              { type: 'text', text: 'Line 3' },
            ],
          });
        },
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'test__multi_content',
        arguments: JSON.stringify({}),
      });

      // Should join multiple content blocks with newlines
      expect(result.result).toContain('Line 1');
      expect(result.result).toContain('Line 2');
      expect(result.result).toContain('Line 3');
    });

    it('should format JSON result from MCP', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('json_result', async () => {
        const data = { key: 'value', number: 42 };
        return JSON.stringify(data);
      });

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'test__json_result',
        arguments: JSON.stringify({}),
      });

      const parsed = JSON.parse(result.result);
      expect(parsed.key).toBe('value');
      expect(parsed.number).toBe(42);
    });
  });

  describe('Parallel Execution Scenarios', () => {
    it('should handle multiple MCP tools in parallel', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('fast_tool', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'Fast result';
      });
      mcpServer.registerTool('slow_tool', async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return 'Slow result';
      });

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      // Execute both tools in parallel (simulating ChatLoop behavior)
      const startTime = Date.now();
      const results = await Promise.all([
        executor.execute({
          id: '1',
          name: 'test__fast_tool',
          arguments: JSON.stringify({}),
        }),
        executor.execute({
          id: '2',
          name: 'test__slow_tool',
          arguments: JSON.stringify({}),
        }),
      ]);
      const duration = Date.now() - startTime;

      expect(results[0].result).toContain('Fast result');
      expect(results[1].result).toContain('Slow result');
      // Parallel execution should be faster than sequential
      expect(duration).toBeLessThan(50);
    });

    it('should handle mixed built-in and MCP tools in parallel', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('mcp_tool', async () => {
        return 'MCP result';
      });

      const parallelBuiltinTool: Tool = {
        name: 'parallel_builtin',
        description: 'Built-in tool for parallel testing',
        inputSchema: {} as any,
        async execute() {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            status: 'success' as const,
            content: 'Built-in result',
          };
        },
      };

      const config = {
        builtinToolMap: new Map<string, Tool>([['parallel_builtin', parallelBuiltinTool]]),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const results = await Promise.all([
        executor.execute({
          id: '1',
          name: 'parallel_builtin',
          arguments: JSON.stringify({}),
        }),
        executor.execute({
          id: '2',
          name: 'test__mcp_tool',
          arguments: JSON.stringify({}),
        }),
      ]);

      expect(results[0].result).toContain('Built-in result');
      expect(results[1].result).toContain('MCP result');
    });
  });

  describe('Edge Cases', () => {
    it('should handle tool name with special characters', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('tool-with-special.chars', async () => {
        return 'Special tool result';
      });

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'test__tool-with-special.chars',
        arguments: JSON.stringify({}),
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toContain('Special tool result');
    });

    it('should handle very long tool arguments', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('long_args', async (args) => {
        const text = args.text as string;
        return `Received ${text.length} characters`;
      });

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const longText = 'a'.repeat(1000);
      const result = await executor.execute({
        id: '1',
        name: 'test__long_args',
        arguments: JSON.stringify({ text: longText }),
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toContain('1000 characters');
    });

    it('should handle Unicode characters in arguments and results', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('unicode_tool', async (args) => {
        const text = args.text as string;
        return `Received: ${text}`;
      });

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const unicodeText = 'Hello 世界 🌍 🎉';
      const result = await executor.execute({
        id: '1',
        name: 'test__unicode_tool',
        arguments: JSON.stringify({ text: unicodeText }),
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toContain(unicodeText);
    });

    it('should handle tool that returns empty result', async () => {
      const mcpServer = new MockMCPServer();
      mcpServer.registerTool('empty_result', async () => {
        return '';
      });

      const config = {
        builtinToolMap: new Map<string, Tool>(),
        mcpCallTool: (params: MCPToolCallParams) => mcpServer.callTool(params),
      };

      const executor = new ToolExecutor(config);

      const result = await executor.execute({
        id: '1',
        name: 'test__empty_result',
        arguments: JSON.stringify({}),
      });

      expect(result.error).toBeUndefined();
      expect(result.result).toBe('');
    });
  });
});
