/**
 * Tests for Duyet MCP Tool
 *
 * Validates the duyetMcpTool behavior including:
 * - Tool metadata and schema
 * - Query inference (mapping queries to MCP tools)
 * - Tool filtering
 * - Fallback responses
 * - Error handling
 *
 * Note: These tests mock the MCP server since network calls
 * are not available in unit tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoopContext } from '../../types.js';
import {
  duyetMcpTool,
  duyetToolFilter,
  getFallbackResponse,
  inferMcpToolFromQuery,
} from '../duyet-mcp.js';

// Mock fetch for MCP server calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('duyetMcpTool', () => {
  let mockContext: LoopContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      executionContext: {
        traceId: 'test-trace-123',
      } as unknown as LoopContext['executionContext'],
      iteration: 0,
      toolHistory: [],
      isSubagent: false,
    };
  });

  describe('tool metadata', () => {
    it('should have correct name', () => {
      expect(duyetMcpTool.name).toBe('duyet_info');
    });

    it('should have description mentioning Duyet', () => {
      expect(duyetMcpTool.description).toBeDefined();
      expect(duyetMcpTool.description.toLowerCase()).toContain('duyet');
    });

    it('should have description mentioning blog', () => {
      expect(duyetMcpTool.description.toLowerCase()).toContain('blog');
    });

    it('should have valid parameters schema', () => {
      expect(duyetMcpTool.parameters.type).toBe('object');
      expect(duyetMcpTool.parameters.properties).toBeDefined();
      expect(duyetMcpTool.parameters.required).toContain('query');
    });

    it('should have query property', () => {
      const queryProp = duyetMcpTool.parameters.properties?.query as Record<string, unknown>;
      expect(queryProp).toBeDefined();
      expect(queryProp.type).toBe('string');
    });

    it('should have optional toolName property', () => {
      const toolNameProp = duyetMcpTool.parameters.properties?.toolName as Record<string, unknown>;
      expect(toolNameProp).toBeDefined();
      expect(toolNameProp.type).toBe('string');
      // toolName should not be required
      expect(duyetMcpTool.parameters.required).not.toContain('toolName');
    });
  });

  describe('duyetToolFilter', () => {
    describe('should match blog-related tools', () => {
      it.each([
        'get_blog_posts',
        'search_blog',
        'get_posts',
        'list_articles',
        'get_latest_posts',
        'recent_posts',
        'blog_search',
        'get_tags',
        'list_categories',
        'rss_feed',
      ])('matches %s', (toolName) => {
        expect(duyetToolFilter(toolName)).toBe(true);
      });
    });

    describe('should match info-related tools', () => {
      it.each([
        'get_about',
        'get_cv',
        'get_contact',
        'get_info',
        'get_bio',
        'get_profile',
        'get_experience',
        'get_skills',
        'get_education',
        'list_certificates',
      ])('matches %s', (toolName) => {
        expect(duyetToolFilter(toolName)).toBe(true);
      });
    });

    describe('should NOT match unrelated tools', () => {
      it.each([
        'execute_shell',
        'run_code',
        'delete_file',
        'send_email',
        'make_payment',
        'admin_access',
      ])('does not match %s', (toolName) => {
        expect(duyetToolFilter(toolName)).toBe(false);
      });
    });
  });

  describe('inferMcpToolFromQuery', () => {
    describe('blog queries', () => {
      it.each([
        ['latest blog posts', 'get_latest_posts'],
        ['recent articles', 'get_latest_posts'],
        ['blog post about React', 'get_latest_posts'],
        ['what did you write', 'get_latest_posts'],
      ])('infers %s -> %s', (query, expectedTool) => {
        expect(inferMcpToolFromQuery(query)).toBe(expectedTool);
      });
    });

    describe('CV queries', () => {
      it.each([
        ['your cv', 'get_cv'],
        ['resume', 'get_cv'],
        ['work experience', 'get_cv'],
        ['job history', 'get_cv'],
        ['career', 'get_cv'],
      ])('infers %s -> %s', (query, expectedTool) => {
        expect(inferMcpToolFromQuery(query)).toBe(expectedTool);
      });
    });

    describe('skills queries', () => {
      it.each([
        ['your skills', 'get_skills'],
        ['expertise', 'get_skills'],
        ['what do you know', 'get_skills'],
        ['programming languages', 'get_skills'],
        ['technologies', 'get_skills'],
      ])('infers %s -> %s', (query, expectedTool) => {
        expect(inferMcpToolFromQuery(query)).toBe(expectedTool);
      });
    });

    describe('contact queries', () => {
      it.each([
        ['contact info', 'get_contact'],
        ['email address', 'get_contact'],
        ['how to reach you', 'get_contact'],
        ['linkedin profile', 'get_contact'],
        ['github account', 'get_contact'],
      ])('infers %s -> %s', (query, expectedTool) => {
        expect(inferMcpToolFromQuery(query)).toBe(expectedTool);
      });
    });

    describe('about/bio queries', () => {
      it.each([
        ['who is duyet', 'get_about'],
        ['about duyet', 'get_about'],
        ['your bio', 'get_about'],
        ['introduce yourself', 'get_about'],
        ['background', 'get_about'],
      ])('infers %s -> %s', (query, expectedTool) => {
        expect(inferMcpToolFromQuery(query)).toBe(expectedTool);
      });
    });

    describe('education queries', () => {
      it.each([
        ['education', 'get_education'],
        ['university', 'get_education'],
        ['degree', 'get_education'],
        ['school', 'get_education'],
      ])('infers %s -> %s', (query, expectedTool) => {
        expect(inferMcpToolFromQuery(query)).toBe(expectedTool);
      });
    });

    it('should default to search for ambiguous queries', () => {
      expect(inferMcpToolFromQuery('random query')).toBe('search');
      expect(inferMcpToolFromQuery('hello')).toBe('search');
    });
  });

  describe('getFallbackResponse', () => {
    it('should return blog fallback for blog queries', () => {
      const response = getFallbackResponse('latest blog posts');
      expect(response).toContain('blog.duyet.net');
    });

    it('should return CV fallback for CV queries', () => {
      const response = getFallbackResponse('your cv');
      expect(response).toContain('duyet.net');
    });

    it('should return skills fallback for skills queries', () => {
      const response = getFallbackResponse('your skills');
      expect(response.toLowerCase()).toContain('data engineering');
    });

    it('should return contact fallback for contact queries', () => {
      const response = getFallbackResponse('contact info');
      expect(response).toContain('github.com/duyet');
    });

    it('should return about fallback for about queries', () => {
      const response = getFallbackResponse('who is duyet');
      expect(response.toLowerCase()).toContain('data engineer');
    });

    it('should return default fallback for unknown queries', () => {
      const response = getFallbackResponse('random query');
      expect(response).toContain('information service');
    });
  });

  describe('execute', () => {
    describe('successful MCP call', () => {
      it('should return MCP response on success', async () => {
        // Mock successful MCP response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              tools: [{ name: 'get_latest_posts', description: 'Get blog posts' }],
            },
          }),
        });
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'text', text: 'Latest blog posts: Post 1, Post 2' }],
            },
          }),
        });

        const result = await duyetMcpTool.execute({ query: 'latest blog posts' }, mockContext);

        expect(result.success).toBe(true);
        expect(result.output).toContain('Post 1');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });
    });

    describe('MCP failure handling', () => {
      it('should return fallback on network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await duyetMcpTool.execute({ query: 'latest blog posts' }, mockContext);

        // Should still be success (with fallback)
        expect(result.success).toBe(true);
        expect(result.output).toContain('blog.duyet.net');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should return fallback on MCP server error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        const result = await duyetMcpTool.execute({ query: 'your cv' }, mockContext);

        expect(result.success).toBe(true);
        expect(result.output).toContain('duyet.net');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should return fallback on MCP JSON error response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            error: { message: 'Tool not found' },
          }),
        });

        const result = await duyetMcpTool.execute({ query: 'your skills' }, mockContext);

        expect(result.success).toBe(true);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });
    });

    describe('explicit toolName parameter', () => {
      it('should use explicit toolName when provided', async () => {
        // Mock tool call (skip tool listing)
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              content: [{ type: 'text', text: 'CV: Data Engineer at XYZ' }],
            },
          }),
        });

        const result = await duyetMcpTool.execute(
          {
            query: 'anything',
            toolName: 'get_cv',
          },
          mockContext
        );

        expect(result.success).toBe(true);
        expect(result.output).toContain('Data Engineer');
      });
    });

    describe('context handling', () => {
      it('should handle undefined executionContext gracefully', async () => {
        const contextWithoutExec = {
          ...mockContext,
          executionContext: undefined as unknown as LoopContext['executionContext'],
        };

        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await duyetMcpTool.execute({ query: 'test' }, contextWithoutExec);

        // Should not throw, should return fallback
        expect(result.success).toBe(true);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
