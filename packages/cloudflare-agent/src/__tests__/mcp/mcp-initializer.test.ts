import { describe, expect, it, vi } from 'vitest';
import { MCPInitializer } from '../../mcp/mcp-initializer.js';

describe('MCPInitializer', () => {
  it('should initialize servers', async () => {
    const mockAgent = {
      addMcpServer: vi.fn().mockResolvedValue(undefined),
    };
    const mockEnv = {};
    const servers = [
      { name: 'server1', url: 'http://localhost:1' },
      { name: 'server2', url: 'http://localhost:2' },
    ];

    const initializer = new MCPInitializer(mockAgent as any, servers, () => mockEnv);
    await initializer.initialize(false);

    expect(mockAgent.addMcpServer).toHaveBeenCalledTimes(2);
    expect(mockAgent.addMcpServer).toHaveBeenCalledWith(
      'server1',
      'http://localhost:1',
      '',
      '',
      undefined
    );
  });

  it('should skip if already initialized', async () => {
    const mockAgent = { addMcpServer: vi.fn() };
    const initializer = new MCPInitializer(mockAgent as any, [], () => ({}));
    await initializer.initialize(true);
    expect(mockAgent.addMcpServer).not.toHaveBeenCalled();
  });
});
