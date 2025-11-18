/**
 * Tests for Research Tool
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResearchTool } from '@/tools/research';
import type { ToolInput } from '@/tools/types';

// Mock fetch globally
global.fetch = vi.fn();

describe('ResearchTool', () => {
  let tool: ResearchTool;

  beforeEach(() => {
    tool = new ResearchTool();
    // Clear any mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('research');
    });

    it('should have description', () => {
      expect(tool.description).toBeTruthy();
      expect(tool.description.toLowerCase()).toContain('research');
    });

    it('should have input schema', () => {
      expect(tool.inputSchema).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should accept string query', () => {
      const input: ToolInput = {
        content: 'what is TypeScript',
      };

      const valid = tool.validate(input);
      expect(valid).toBe(true);
    });

    it('should accept object with query', () => {
      const input: ToolInput = {
        content: {
          query: 'what is TypeScript',
        },
      };

      const valid = tool.validate(input);
      expect(valid).toBe(true);
    });

    it('should accept object with query and maxResults', () => {
      const input: ToolInput = {
        content: {
          query: 'what is TypeScript',
          maxResults: 5,
        },
      };

      const valid = tool.validate(input);
      expect(valid).toBe(true);
    });

    it('should reject empty query', () => {
      const input: ToolInput = {
        content: '',
      };

      const valid = tool.validate(input);
      expect(valid).toBe(false);
    });

    it('should reject invalid maxResults', () => {
      const input: ToolInput = {
        content: {
          query: 'test',
          maxResults: -1,
        },
      };

      const valid = tool.validate(input);
      expect(valid).toBe(false);
    });

    it('should reject maxResults over limit', () => {
      const input: ToolInput = {
        content: {
          query: 'test',
          maxResults: 100,
        },
      };

      const valid = tool.validate(input);
      expect(valid).toBe(false);
    });
  });

  describe('execute - web search', () => {
    it('should perform basic search', async () => {
      // Mock DuckDuckGo HTML response
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <div class="result__body">
            <a class="result__a" href="https://www.typescriptlang.org">TypeScript Official</a>
            <a class="result__snippet">TypeScript is a typed superset of JavaScript</a>
          </div>
        `,
      });

      const input: ToolInput = {
        content: 'TypeScript programming language',
      };

      const output = await tool.execute(input);

      expect(output.status).toBe('success');
      expect(output.content).toBeDefined();
      expect(typeof output.content).toBe('object');
      const content = output.content as Record<string, unknown>;
      expect(Array.isArray(content.results)).toBe(true);
      expect((content.results as unknown[]).length).toBeGreaterThan(0);
    });

    it('should return search results with citations', async () => {
      // Mock DuckDuckGo HTML response
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <div class="result__body">
            <a class="result__a" href="https://nodejs.org">Node.js Official</a>
            <a class="result__snippet">Node.js is a JavaScript runtime</a>
          </div>
        `,
      });

      const input: ToolInput = {
        content: 'Node.js runtime',
      };

      const output = await tool.execute(input);

      expect(output.status).toBe('success');
      const content = output.content as Record<string, unknown>;
      const results = content.results as Array<Record<string, unknown>>;
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('url');
      expect(results[0]).toHaveProperty('snippet');
    });

    it('should limit results based on maxResults', async () => {
      // Mock with multiple results
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <div class="result__body">
            <a class="result__a" href="https://react.dev">React</a>
            <a class="result__snippet">React framework</a>
          </div>
          <div class="result__body">
            <a class="result__a" href="https://angular.io">Angular</a>
            <a class="result__snippet">Angular framework</a>
          </div>
          <div class="result__body">
            <a class="result__a" href="https://vuejs.org">Vue</a>
            <a class="result__snippet">Vue framework</a>
          </div>
        `,
      });

      const input: ToolInput = {
        content: {
          query: 'JavaScript frameworks',
          maxResults: 3,
        },
      };

      const output = await tool.execute(input);

      expect(output.status).toBe('success');
      const content = output.content as Record<string, unknown>;
      expect((content.results as unknown[]).length).toBeLessThanOrEqual(3);
    });

    it('should include query metadata in response', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => '<div class="result__body"><a href="https://test.com">Test</a></div>',
      });

      const query = 'React framework';
      const input: ToolInput = {
        content: query,
      };

      const output = await tool.execute(input);

      expect(output.status).toBe('success');
      const content = output.content as Record<string, unknown>;
      expect(content.query).toBe(query);
    });

    it('should handle empty search results gracefully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => '<html><body>No results</body></html>',
      });

      const input: ToolInput = {
        content: 'xyzabc123nonexistentterm999',
      };

      const output = await tool.execute(input);

      expect(output.status).toBe('success');
      const content = output.content as Record<string, unknown>;
      expect(Array.isArray(content.results)).toBe(true);
      expect((content.results as unknown[]).length).toBe(0);
    });
  });

  describe('execute - URL fetching', () => {
    it('should fetch content from URL', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => '<html><head><title>Example Domain</title></head><body>Example content</body></html>',
      });

      const input: ToolInput = {
        content: {
          url: 'https://example.com',
        },
      };

      const output = await tool.execute(input);

      expect(output.status).toBe('success');
      const content = output.content as Record<string, unknown>;
      expect(content).toHaveProperty('content');
      expect(content).toHaveProperty('url');
    });

    it('should extract text content from HTML', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => '<html><head><title>Test</title></head><body>Test content here</body></html>',
      });

      const input: ToolInput = {
        content: {
          url: 'https://example.com',
        },
      };

      const output = await tool.execute(input);

      expect(output.status).toBe('success');
      const content = output.content as Record<string, unknown>;
      expect(typeof content.content).toBe('string');
      expect((content.content as string).length).toBeGreaterThan(0);
    });

    it('should handle invalid URLs', async () => {
      const input: ToolInput = {
        content: {
          url: 'not-a-url',
        },
      };

      const output = await tool.execute(input);

      expect(output.status).toBe('error');
      expect(output.error).toBeDefined();
    });

    it('should handle fetch errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      const input: ToolInput = {
        content: {
          url: 'https://this-domain-does-not-exist-12345.com',
        },
      };

      const output = await tool.execute(input);

      expect(output.status).toBe('error');
      expect(output.error).toBeDefined();
    });
  });

  describe('execute - error handling', () => {
    it('should return error for invalid input', async () => {
      const input: ToolInput = {
        content: {} as Record<string, unknown>,
      };

      const output = await tool.execute(input);

      expect(output.status).toBe('error');
      expect(output.error).toBeDefined();
    });

    it('should return error for empty query', async () => {
      const input: ToolInput = {
        content: '',
      };

      const output = await tool.execute(input);

      expect(output.status).toBe('error');
      expect(output.error).toBeDefined();
    });
  });

  describe('content extraction', () => {
    it('should extract clean text from HTML', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => '<html><body><h1>Title</h1><p>Content paragraph</p></body></html>',
      });

      const input: ToolInput = {
        content: {
          url: 'https://example.com',
        },
      };

      const output = await tool.execute(input);

      expect(output.status).toBe('success');
      const content = output.content as Record<string, unknown>;
      // Should not contain HTML tags
      expect((content.content as string)).not.toMatch(/<[^>]*>/);
    });

    it('should extract title from page', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => '<html><head><title>Page Title</title></head><body>Content</body></html>',
      });

      const input: ToolInput = {
        content: {
          url: 'https://example.com',
        },
      };

      const output = await tool.execute(input);

      expect(output.status).toBe('success');
      const content = output.content as Record<string, unknown>;
      expect(content).toHaveProperty('title');
      expect(content.title).toBe('Page Title');
    });
  });

  describe('result ranking', () => {
    it('should rank results by relevance', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <div class="result__body">
            <a class="result__a" href="https://test1.com">Result 1</a>
          </div>
          <div class="result__body">
            <a class="result__a" href="https://test2.com">Result 2</a>
          </div>
        `,
      });

      const input: ToolInput = {
        content: {
          query: 'machine learning tutorial',
          maxResults: 5,
        },
      };

      const output = await tool.execute(input);

      expect(output.status).toBe('success');
      const content = output.content as Record<string, unknown>;
      const results = content.results as Array<Record<string, unknown>>;
      // Results should have relevance scores
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('relevance');
      }
    });
  });

  describe('caching', () => {
    it('should cache search results', async () => {
      // First call - mock response
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: async () => '<div class="result__body"><a href="https://test.com">Test</a></div>',
      });

      const query = 'test query for caching';
      const input: ToolInput = {
        content: query,
      };

      // First call
      const output1 = await tool.execute(input);
      const duration1 = output1.metadata?.duration || 0;

      // Second call (should use cache, no new fetch mock needed)
      const output2 = await tool.execute(input);
      const duration2 = output2.metadata?.duration || 0;

      expect(output1.status).toBe('success');
      expect(output2.status).toBe('success');
      expect(output2.metadata?.cached).toBe(true);
      // Second call should be faster (cached)
      expect(duration2).toBeLessThanOrEqual(duration1);
    });
  });
});
