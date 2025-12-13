/**
 * Tests for MCP Tool Naming Utilities
 */

import { describe, expect, it } from 'vitest';
import {
  formatMcpToolName,
  isBuiltinTool,
  isMcpTool,
  isValidMcpName,
  isValidPrefixedMcpName,
  isValidToolName,
  parseMcpToolName,
} from '../naming.js';

describe('MCP Tool Naming', () => {
  describe('formatMcpToolName', () => {
    it('should format valid MCP and tool names', () => {
      expect(formatMcpToolName('duyet', 'get_cv')).toBe('duyet__get_cv');
      expect(formatMcpToolName('memory', 'fetch_notes')).toBe('memory__fetch_notes');
      expect(formatMcpToolName('a', 'b')).toBe('a__b');
    });

    it('should handle names with numbers', () => {
      expect(formatMcpToolName('server1', 'tool_2')).toBe('server1__tool_2');
      expect(formatMcpToolName('duyet2', 'get_cv3')).toBe('duyet2__get_cv3');
    });

    it('should handle names with multiple underscores', () => {
      expect(formatMcpToolName('my_server', 'get_user_cv')).toBe('my_server__get_user_cv');
      expect(formatMcpToolName('server_name', 'fetch_all_notes')).toBe(
        'server_name__fetch_all_notes'
      );
    });

    it('should throw on invalid MCP name', () => {
      expect(() => formatMcpToolName('DuYet', 'get_cv')).toThrow('Invalid MCP name');
      expect(() => formatMcpToolName('my-server', 'get_cv')).toThrow('Invalid MCP name');
      expect(() => formatMcpToolName('123server', 'get_cv')).toThrow('Invalid MCP name');
      expect(() => formatMcpToolName('', 'get_cv')).toThrow('Invalid MCP name');
    });

    it('should throw on invalid tool name', () => {
      expect(() => formatMcpToolName('duyet', 'GetCV')).toThrow('Invalid tool name');
      expect(() => formatMcpToolName('duyet', 'get-cv')).toThrow('Invalid tool name');
      expect(() => formatMcpToolName('duyet', '123_tool')).toThrow('Invalid tool name');
      expect(() => formatMcpToolName('duyet', '')).toThrow('Invalid tool name');
    });
  });

  describe('parseMcpToolName', () => {
    it('should parse valid MCP tool names', () => {
      const result = parseMcpToolName('duyet__get_cv');
      expect(result).toEqual({ mcpName: 'duyet', toolName: 'get_cv' });
    });

    it('should parse names with numbers', () => {
      const result = parseMcpToolName('server1__tool_2');
      expect(result).toEqual({ mcpName: 'server1', toolName: 'tool_2' });
    });

    it('should parse names with multiple underscores', () => {
      const result = parseMcpToolName('my_server__get_user_cv');
      expect(result).toEqual({ mcpName: 'my_server', toolName: 'get_user_cv' });
    });

    it('should return null for builtin tool names', () => {
      expect(parseMcpToolName('read_file')).toBeNull();
      expect(parseMcpToolName('search')).toBeNull();
      expect(parseMcpToolName('execute_code')).toBeNull();
    });

    it('should return null for invalid formats', () => {
      expect(parseMcpToolName('duyet')).toBeNull();
      expect(parseMcpToolName('duyet___get_cv')).toBeNull();
      expect(parseMcpToolName('__get_cv')).toBeNull();
      expect(parseMcpToolName('duyet__')).toBeNull();
    });

    it('should return null for uppercase names', () => {
      expect(parseMcpToolName('Duyet__get_cv')).toBeNull();
      expect(parseMcpToolName('duyet__GetCV')).toBeNull();
    });

    it('should return null for names with invalid characters', () => {
      expect(parseMcpToolName('duyet-server__get-cv')).toBeNull();
      expect(parseMcpToolName('duyet__get.cv')).toBeNull();
    });

    it('should return null for names starting with numbers', () => {
      expect(parseMcpToolName('1duyet__get_cv')).toBeNull();
      expect(parseMcpToolName('duyet__1get_cv')).toBeNull();
    });
  });

  describe('isMcpTool', () => {
    it('should identify MCP tool names', () => {
      expect(isMcpTool('duyet__get_cv')).toBe(true);
      expect(isMcpTool('memory__fetch_notes')).toBe(true);
      expect(isMcpTool('my_server__tool_name')).toBe(true);
      expect(isMcpTool('a__b')).toBe(true);
    });

    it('should identify builtin tool names', () => {
      expect(isMcpTool('read_file')).toBe(false);
      expect(isMcpTool('search')).toBe(false);
      expect(isMcpTool('execute_code')).toBe(false);
      expect(isMcpTool('git_commit')).toBe(false);
    });

    it('should identify invalid names as non-MCP', () => {
      expect(isMcpTool('duyet')).toBe(false);
      expect(isMcpTool('__')).toBe(false);
      expect(isMcpTool('duyet__')).toBe(false);
      expect(isMcpTool('__get_cv')).toBe(false);
    });
  });

  describe('isBuiltinTool', () => {
    it('should identify builtin tool names', () => {
      expect(isBuiltinTool('read_file')).toBe(true);
      expect(isBuiltinTool('search')).toBe(true);
      expect(isBuiltinTool('execute_code')).toBe(true);
    });

    it('should identify MCP tool names as non-builtin', () => {
      expect(isBuiltinTool('duyet__get_cv')).toBe(false);
      expect(isBuiltinTool('memory__fetch_notes')).toBe(false);
    });

    it('should complement isMcpTool correctly', () => {
      const names = ['read_file', 'search', 'duyet__get_cv', 'memory__fetch_notes', 'git_commit'];

      for (const name of names) {
        expect(isMcpTool(name)).toBe(!isBuiltinTool(name));
        expect(isBuiltinTool(name)).toBe(!isMcpTool(name));
      }
    });
  });

  describe('isValidMcpName', () => {
    it('should accept valid MCP names', () => {
      expect(isValidMcpName('duyet')).toBe(true);
      expect(isValidMcpName('memory')).toBe(true);
      expect(isValidMcpName('my_server')).toBe(true);
      expect(isValidMcpName('a')).toBe(true);
      expect(isValidMcpName('server1')).toBe(true);
      expect(isValidMcpName('my_server_1')).toBe(true);
    });

    it('should reject uppercase names', () => {
      expect(isValidMcpName('Duyet')).toBe(false);
      expect(isValidMcpName('MyServer')).toBe(false);
      expect(isValidMcpName('duYet')).toBe(false);
    });

    it('should reject names with invalid characters', () => {
      expect(isValidMcpName('my-server')).toBe(false);
      expect(isValidMcpName('my.server')).toBe(false);
      expect(isValidMcpName('my server')).toBe(false);
    });

    it('should reject names starting with numbers', () => {
      expect(isValidMcpName('1duyet')).toBe(false);
      expect(isValidMcpName('123')).toBe(false);
    });

    it('should reject empty names', () => {
      expect(isValidMcpName('')).toBe(false);
    });

    it('should reject names starting with underscore', () => {
      expect(isValidMcpName('_server')).toBe(false);
    });
  });

  describe('isValidToolName', () => {
    it('should accept valid tool names', () => {
      expect(isValidToolName('get_cv')).toBe(true);
      expect(isValidToolName('fetch_notes')).toBe(true);
      expect(isValidToolName('read')).toBe(true);
      expect(isValidToolName('tool_1')).toBe(true);
      expect(isValidToolName('a')).toBe(true);
    });

    it('should reject uppercase names', () => {
      expect(isValidToolName('GetCV')).toBe(false);
      expect(isValidToolName('FetchNotes')).toBe(false);
      expect(isValidToolName('get_CV')).toBe(false);
    });

    it('should reject names with invalid characters', () => {
      expect(isValidToolName('get-cv')).toBe(false);
      expect(isValidToolName('get.cv')).toBe(false);
      expect(isValidToolName('get cv')).toBe(false);
    });

    it('should reject names starting with numbers', () => {
      expect(isValidToolName('1get_cv')).toBe(false);
      expect(isValidToolName('123')).toBe(false);
    });

    it('should reject empty names', () => {
      expect(isValidToolName('')).toBe(false);
    });

    it('should reject names starting with underscore', () => {
      expect(isValidToolName('_tool')).toBe(false);
    });
  });

  describe('isValidPrefixedMcpName', () => {
    it('should accept valid prefixed names', () => {
      expect(isValidPrefixedMcpName('duyet__get_cv')).toBe(true);
      expect(isValidPrefixedMcpName('memory__fetch_notes')).toBe(true);
      expect(isValidPrefixedMcpName('a__b')).toBe(true);
    });

    it('should reject unprefixed names', () => {
      expect(isValidPrefixedMcpName('read_file')).toBe(false);
      expect(isValidPrefixedMcpName('search')).toBe(false);
    });

    it('should reject invalid formats', () => {
      expect(isValidPrefixedMcpName('duyet')).toBe(false);
      expect(isValidPrefixedMcpName('duyet___get_cv')).toBe(false);
      expect(isValidPrefixedMcpName('duyet__')).toBe(false);
      expect(isValidPrefixedMcpName('__get_cv')).toBe(false);
    });

    it('should reject uppercase names', () => {
      expect(isValidPrefixedMcpName('Duyet__get_cv')).toBe(false);
      expect(isValidPrefixedMcpName('duyet__GetCV')).toBe(false);
    });
  });

  describe('round-trip conversion', () => {
    it('should format and parse consistently', () => {
      const pairs = [
        { mcp: 'duyet', tool: 'get_cv' },
        { mcp: 'memory', tool: 'fetch_notes' },
        { mcp: 'my_server', tool: 'tool_name' },
        { mcp: 'a', tool: 'b' },
      ];

      for (const pair of pairs) {
        const formatted = formatMcpToolName(pair.mcp, pair.tool);
        const parsed = parseMcpToolName(formatted);

        expect(parsed).not.toBeNull();
        expect(parsed?.mcpName).toBe(pair.mcp);
        expect(parsed?.toolName).toBe(pair.tool);
      }
    });
  });
});
