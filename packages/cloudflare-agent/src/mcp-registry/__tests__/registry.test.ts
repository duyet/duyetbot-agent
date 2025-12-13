/**
 * Tests for MCP Registry
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createMCPRegistry, MCPRegistry } from '../registry.js';
import type { MCPServerConfig, MCPToolDefinition } from '../types.js';

describe('MCPRegistry', () => {
  let registry: MCPRegistry;

  const mockServer: MCPServerConfig = {
    name: 'duyet',
    displayName: 'Duyet Personal Info',
    url: 'http://localhost:3000',
    enabled: true,
    description: 'Personal information and knowledge base',
  };

  const mockTool: MCPToolDefinition = {
    mcpName: 'duyet',
    originalName: 'get_cv',
    prefixedName: 'duyet__get_cv',
    description: "Get Duyet's CV",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  };

  beforeEach(() => {
    registry = new MCPRegistry();
  });

  describe('creation', () => {
    it('should create an empty registry', () => {
      const reg = new MCPRegistry();
      expect(reg.listServers()).toHaveLength(0);
      expect(reg.listTools()).toHaveLength(0);
    });

    it('should create with initial servers', () => {
      const reg = new MCPRegistry({
        servers: [mockServer],
      });
      expect(reg.listServers()).toHaveLength(1);
      expect(reg.getServer('duyet')).toEqual(mockServer);
    });

    it('should create with factory function', () => {
      const reg = createMCPRegistry({
        servers: [mockServer],
      });
      expect(reg.getServer('duyet')).toBeDefined();
    });
  });

  describe('server registration', () => {
    it('should register a server', () => {
      registry.registerServer(mockServer);
      expect(registry.getServer('duyet')).toEqual(mockServer);
    });

    it('should register multiple servers', () => {
      const server2: MCPServerConfig = {
        name: 'memory',
        displayName: 'Memory Server',
        url: 'http://localhost:3001',
        enabled: true,
      };

      registry.registerServer(mockServer);
      registry.registerServer(server2);

      expect(registry.listServers()).toHaveLength(2);
      expect(registry.getServer('duyet')).toBeDefined();
      expect(registry.getServer('memory')).toBeDefined();
    });

    it('should update an existing server', () => {
      registry.registerServer(mockServer);
      const updated: MCPServerConfig = {
        ...mockServer,
        enabled: false,
      };
      registry.registerServer(updated);

      expect(registry.getServer('duyet')?.enabled).toBe(false);
      expect(registry.listServers()).toHaveLength(1);
    });

    it('should throw on invalid server name', () => {
      const invalid: MCPServerConfig = {
        name: 'My-Server',
        displayName: 'Invalid',
        url: 'http://localhost:3000',
        enabled: true,
      };
      expect(() => registry.registerServer(invalid)).toThrow('Invalid server name');
    });

    it('should throw on missing display name', () => {
      const invalid: MCPServerConfig = {
        name: 'server',
        displayName: '',
        url: 'http://localhost:3000',
        enabled: true,
      };
      expect(() => registry.registerServer(invalid)).toThrow('displayName is required');
    });

    it('should throw on missing URL', () => {
      const invalid: MCPServerConfig = {
        name: 'server',
        displayName: 'Server',
        url: '',
        enabled: true,
      };
      expect(() => registry.registerServer(invalid)).toThrow('url is required');
    });
  });

  describe('tool registration', () => {
    it('should add a tool', () => {
      registry.addTool(mockTool);
      expect(registry.getTool('duyet__get_cv')).toEqual(mockTool);
    });

    it('should add multiple tools', () => {
      const tool2: MCPToolDefinition = {
        mcpName: 'duyet',
        originalName: 'get_notes',
        prefixedName: 'duyet__get_notes',
        description: "Get Duyet's notes",
        parameters: { type: 'object', properties: {}, required: [] },
      };

      registry.addTool(mockTool);
      registry.addTool(tool2);

      expect(registry.listTools()).toHaveLength(2);
      expect(registry.getTool('duyet__get_cv')).toBeDefined();
      expect(registry.getTool('duyet__get_notes')).toBeDefined();
    });

    it('should throw on duplicate tool name', () => {
      registry.addTool(mockTool);
      expect(() => registry.addTool(mockTool)).toThrow('already registered');
    });

    it('should throw on invalid tool naming', () => {
      const invalidTool: MCPToolDefinition = {
        mcpName: 'duyet',
        originalName: 'get_cv',
        prefixedName: 'wrong__name', // Doesn't match mcpName and originalName
        description: 'Invalid tool',
        parameters: { type: 'object', properties: {}, required: [] },
      };
      expect(() => registry.addTool(invalidTool)).toThrow('Invalid tool naming');
    });

    it('should add multiple tools at once', () => {
      const tool2: MCPToolDefinition = {
        mcpName: 'duyet',
        originalName: 'get_notes',
        prefixedName: 'duyet__get_notes',
        description: 'Get notes',
        parameters: { type: 'object', properties: {}, required: [] },
      };

      registry.addTools([mockTool, tool2]);
      expect(registry.listTools()).toHaveLength(2);
    });

    it('should fail on first invalid tool when adding multiple', () => {
      const tool2: MCPToolDefinition = {
        mcpName: 'duyet',
        originalName: 'get_notes',
        prefixedName: 'duyet__get_notes',
        description: 'Get notes',
        parameters: { type: 'object', properties: {}, required: [] },
      };

      registry.addTools([mockTool, tool2]);

      // Adding mockTool again should fail
      expect(() => registry.addTools([mockTool, tool2])).toThrow('already registered');
    });
  });

  describe('tool retrieval', () => {
    beforeEach(() => {
      registry.registerServer(mockServer);
      registry.addTool(mockTool);

      const tool2: MCPToolDefinition = {
        mcpName: 'duyet',
        originalName: 'get_notes',
        prefixedName: 'duyet__get_notes',
        description: 'Get notes',
        parameters: { type: 'object', properties: {}, required: [] },
      };
      registry.addTool(tool2);

      const memoryTool: MCPToolDefinition = {
        mcpName: 'memory',
        originalName: 'fetch_user',
        prefixedName: 'memory__fetch_user',
        description: 'Fetch user',
        parameters: { type: 'object', properties: {}, required: [] },
      };
      registry.addTool(memoryTool);
    });

    it('should get a tool by name', () => {
      const tool = registry.getTool('duyet__get_cv');
      expect(tool).toEqual(mockTool);
    });

    it('should return undefined for non-existent tool', () => {
      const tool = registry.getTool('nonexistent__tool');
      expect(tool).toBeUndefined();
    });

    it('should list all tools', () => {
      const tools = registry.listTools();
      expect(tools).toHaveLength(3);
    });

    it('should get tools by MCP name', () => {
      const duyetTools = registry.getToolsByMcp('duyet');
      expect(duyetTools).toHaveLength(2);
      expect(duyetTools.every((t) => t.mcpName === 'duyet')).toBe(true);
    });

    it('should return empty array for unknown MCP', () => {
      const tools = registry.getToolsByMcp('unknown');
      expect(tools).toHaveLength(0);
    });

    it('should check if tool exists', () => {
      expect(registry.hasTool('duyet__get_cv')).toBe(true);
      expect(registry.hasTool('nonexistent__tool')).toBe(false);
    });
  });

  describe('server listing', () => {
    it('should list enabled servers only', () => {
      registry.registerServer(mockServer);
      registry.registerServer({
        name: 'disabled',
        displayName: 'Disabled Server',
        url: 'http://localhost:3001',
        enabled: false,
      });

      const enabled = registry.listEnabledServers();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].name).toBe('duyet');
    });
  });

  describe('discovery tracking', () => {
    it('should record a discovery result', () => {
      registry.recordDiscovery({
        status: 'success',
        mcpName: 'duyet',
        tools: [mockTool],
        discoveredAt: Date.now(),
        durationMs: 234,
      });

      const result = registry.getDiscoveryResult('duyet');
      expect(result?.status).toBe('success');
      expect(result?.tools).toHaveLength(1);
    });

    it('should update discovery result', () => {
      registry.recordDiscovery({
        status: 'pending',
        mcpName: 'duyet',
        tools: [],
        discoveredAt: Date.now(),
        durationMs: 0,
      });

      registry.recordDiscovery({
        status: 'success',
        mcpName: 'duyet',
        tools: [mockTool],
        discoveredAt: Date.now(),
        durationMs: 234,
      });

      const result = registry.getDiscoveryResult('duyet');
      expect(result?.status).toBe('success');
    });

    it('should get discovery status', () => {
      registry.recordDiscovery({
        status: 'success',
        mcpName: 'duyet',
        tools: [mockTool],
        discoveredAt: Date.now(),
        durationMs: 234,
      });

      expect(registry.getDiscoveryStatus('duyet')).toBe('success');
      expect(registry.getDiscoveryStatus('unknown')).toBeUndefined();
    });

    it('should list discovery results', () => {
      registry.recordDiscovery({
        status: 'success',
        mcpName: 'duyet',
        tools: [mockTool],
        discoveredAt: Date.now(),
        durationMs: 234,
      });

      registry.recordDiscovery({
        status: 'success',
        mcpName: 'memory',
        tools: [],
        discoveredAt: Date.now(),
        durationMs: 100,
      });

      const results = registry.listDiscoveryResults();
      expect(results).toHaveLength(2);
    });

    it('should return undefined for undiscovered servers', () => {
      expect(registry.getDiscoveryResult('unknown')).toBeUndefined();
      expect(registry.getDiscoveryStatus('unknown')).toBeUndefined();
    });
  });

  describe('tool clearing', () => {
    it('should clear all tools', () => {
      registry.addTool(mockTool);
      registry.addTool({
        mcpName: 'memory',
        originalName: 'fetch',
        prefixedName: 'memory__fetch',
        description: 'Fetch',
        parameters: { type: 'object', properties: {}, required: [] },
      });

      expect(registry.listTools()).toHaveLength(2);
      registry.clearTools();
      expect(registry.listTools()).toHaveLength(0);
    });

    it('should not clear servers when clearing tools', () => {
      registry.registerServer(mockServer);
      registry.addTool(mockTool);

      registry.clearTools();

      expect(registry.listServers()).toHaveLength(1);
      expect(registry.getServer('duyet')).toBeDefined();
    });
  });

  describe('statistics', () => {
    it('should provide registry statistics', () => {
      registry.registerServer(mockServer);
      registry.registerServer({
        name: 'disabled',
        displayName: 'Disabled',
        url: 'http://localhost:3001',
        enabled: false,
      });
      registry.addTool(mockTool);

      registry.recordDiscovery({
        status: 'success',
        mcpName: 'duyet',
        tools: [mockTool],
        discoveredAt: Date.now(),
        durationMs: 234,
      });

      const stats = registry.getStats();
      expect(stats.servers).toBe(2);
      expect(stats.enabledServers).toBe(1);
      expect(stats.tools).toBe(1);
      expect(stats.discoveredServers).toBe(1);
    });

    it('should return zero stats for empty registry', () => {
      const stats = registry.getStats();
      expect(stats.servers).toBe(0);
      expect(stats.enabledServers).toBe(0);
      expect(stats.tools).toBe(0);
      expect(stats.discoveredServers).toBe(0);
    });
  });

  describe('initialization with options', () => {
    it('should initialize with servers and options', () => {
      const server2: MCPServerConfig = {
        name: 'memory',
        displayName: 'Memory',
        url: 'http://localhost:3001',
        enabled: true,
      };

      const reg = createMCPRegistry({
        servers: [mockServer, server2],
        enableAutoDiscovery: true,
        discoveryTimeoutMs: 5000,
      });

      expect(reg.listServers()).toHaveLength(2);
    });
  });
});
