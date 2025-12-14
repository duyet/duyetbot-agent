import type { Tool, ToolInput } from '@duyetbot/types';
import { describe, expect, it, vi } from 'vitest';
import { ToolExecutor, type ToolExecutorConfig } from '../tool-executor.js';

describe('ToolExecutor', () => {
  it('should execute builtin tool successfully', async () => {
    const mockTool: Tool = {
      name: 'test_tool',
      description: 'Test tool',
      inputSchema: {} as any,
      async execute(input: ToolInput) {
        return {
          status: 'success' as const,
          content: `Executed with: ${JSON.stringify(input.content)}`,
        };
      },
    };

    const config: ToolExecutorConfig = {
      builtinToolMap: new Map([['test_tool', mockTool]]),
      mcpCallTool: vi.fn(),
    };

    const executor = new ToolExecutor(config);

    const result = await executor.execute({
      id: '1',
      name: 'test_tool',
      arguments: JSON.stringify({ arg: 'value' }),
    });

    expect(result.result).toContain('Executed with');
    expect(result.error).toBeUndefined();
  });

  it('should handle builtin tool error', async () => {
    const mockTool: Tool = {
      name: 'error_tool',
      description: 'Error tool',
      inputSchema: {} as any,
      async execute() {
        return {
          status: 'error' as const,
          content: '',
          error: {
            message: 'Tool failed',
          },
        };
      },
    };

    const config: ToolExecutorConfig = {
      builtinToolMap: new Map([['error_tool', mockTool]]),
      mcpCallTool: vi.fn(),
    };

    const executor = new ToolExecutor(config);

    const result = await executor.execute({
      id: '1',
      name: 'error_tool',
      arguments: JSON.stringify({}),
    });

    expect(result.error).toBe('Tool failed');
    expect(result.result).toContain('Error: Tool failed');
  });

  it('should execute MCP tool successfully', async () => {
    const mockMcpCallTool = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'MCP result' }],
    });

    const config: ToolExecutorConfig = {
      builtinToolMap: new Map(),
      mcpCallTool: mockMcpCallTool,
    };

    const executor = new ToolExecutor(config);

    const result = await executor.execute({
      id: '1',
      name: 'server__mcp_tool',
      arguments: JSON.stringify({ arg: 'value' }),
    });

    expect(result.result).toBe('MCP result');
    expect(result.error).toBeUndefined();
    expect(mockMcpCallTool).toHaveBeenCalledWith({
      serverId: 'server',
      name: 'mcp_tool',
      arguments: { arg: 'value' },
    });
  });

  it('should handle invalid JSON arguments', async () => {
    const config: ToolExecutorConfig = {
      builtinToolMap: new Map(),
      mcpCallTool: vi.fn(),
    };

    const executor = new ToolExecutor(config);

    const result = await executor.execute({
      id: '1',
      name: 'test_tool',
      arguments: 'invalid json',
    });

    expect(result.error).toBe('Invalid JSON arguments');
    expect(result.result).toBe('');
  });

  it('should handle MCP tool execution error', async () => {
    const mockMcpCallTool = vi.fn().mockRejectedValue(new Error('MCP failed'));

    const config: ToolExecutorConfig = {
      builtinToolMap: new Map(),
      mcpCallTool: mockMcpCallTool,
    };

    const executor = new ToolExecutor(config);

    const result = await executor.execute({
      id: '1',
      name: 'server__mcp_tool',
      arguments: JSON.stringify({}),
    });

    expect(result.error).toBe('MCP failed');
    expect(result.result).toBe('');
  });
});
