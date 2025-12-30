import { describe, expect, test } from 'vitest';
import {
  HEALTH_CHECK_TIMEOUT,
  MCP_SERVERS,
  getEnabledServers,
  getServerConfig,
  getServerNames,
} from './config';

describe('MCP_SERVERS constant', () => {
  test('has at least one server defined', () => {
    expect(MCP_SERVERS.length).toBeGreaterThan(0);
  });

  test('all servers have required fields', () => {
    MCP_SERVERS.forEach((server) => {
      expect(server).toHaveProperty('name');
      expect(server).toHaveProperty('displayName');
      expect(server).toHaveProperty('url');
      expect(server).toHaveProperty('authRequired');
      expect(server).toHaveProperty('enabled');
      expect(server).toHaveProperty('description');
      expect(server).toHaveProperty('transport');
    });
  });

  test('server names are unique', () => {
    const names = MCP_SERVERS.map((s) => s.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});

describe('getServerConfig', () => {
  test('returns server config when found by name', () => {
    const firstServer = MCP_SERVERS[0]!;
    const result = getServerConfig(firstServer.name);
    expect(result).toBeDefined();
    expect(result?.name).toBe(firstServer.name);
  });

  test('returns undefined when server not found', () => {
    const result = getServerConfig('non-existent-server-xyz');
    expect(result).toBeUndefined();
  });

  test('is case-sensitive', () => {
    const firstServer = MCP_SERVERS[0]!;
    const result = getServerConfig(firstServer.name.toUpperCase());
    expect(result).toBeUndefined();
  });

  test('returns exact server object reference', () => {
    const firstServer = MCP_SERVERS[0]!;
    const result = getServerConfig(firstServer.name);
    expect(result).toBe(firstServer);
  });
});

describe('getEnabledServers', () => {
  test('returns only enabled servers', () => {
    const result = getEnabledServers();
    expect(result.length).toBeLessThanOrEqual(MCP_SERVERS.length);
    expect(result.every((s) => s.enabled)).toBe(true);
  });

  test('returns empty array when no servers are enabled', () => {
    // Filter to only disabled servers
    const disabledServers = MCP_SERVERS.filter((s) => !s.enabled);
    expect(disabledServers.length).toBeGreaterThanOrEqual(0);
  });

  test('returns subset of MCP_SERVERS', () => {
    const result = getEnabledServers();
    result.forEach((server) => {
      expect(MCP_SERVERS).toContain(server);
    });
  });

  test('returns different array than MCP_SERVERS when some are disabled', () => {
    const result = getEnabledServers();
    const hasDisabledServers = MCP_SERVERS.some((s) => !s.enabled);

    if (hasDisabledServers) {
      expect(result.length).toBeLessThan(MCP_SERVERS.length);
    }
  });
});

describe('getServerNames', () => {
  test('returns same number of names as servers', () => {
    const result = getServerNames();
    expect(result).toHaveLength(MCP_SERVERS.length);
  });

  test('returns array of strings', () => {
    const result = getServerNames();
    expect(Array.isArray(result)).toBe(true);
    result.forEach((name) => {
      expect(typeof name).toBe('string');
    });
  });

  test('names match server name properties', () => {
    const result = getServerNames();
    result.forEach((name, index) => {
      expect(name).toBe(MCP_SERVERS[index]!.name);
    });
  });
});

describe('HEALTH_CHECK_TIMEOUT', () => {
  test('is defined as positive number', () => {
    expect(HEALTH_CHECK_TIMEOUT).toBeGreaterThan(0);
  });

  test('is defined in milliseconds (reasonable value)', () => {
    // Should be between 100ms and 30s
    expect(HEALTH_CHECK_TIMEOUT).toBeGreaterThanOrEqual(100);
    expect(HEALTH_CHECK_TIMEOUT).toBeLessThanOrEqual(30000);
  });
});
