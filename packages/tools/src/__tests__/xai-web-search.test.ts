import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { XAI_ERROR_CODES } from '../xai/client.js';
import { XAIWebSearchTool, xaiWebSearchTool } from '../xai/web-search.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('XAIWebSearchTool', () => {
  let tool: XAIWebSearchTool;

  beforeEach(() => {
    tool = new XAIWebSearchTool();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('properties', () => {
    it('should have name "xai_web_search"', () => {
      expect(tool.name).toBe('xai_web_search');
    });

    it('should have a description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.description).toContain('web search');
    });

    it('should have an input schema', () => {
      expect(tool.inputSchema).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should validate simple string query', () => {
      expect(tool.validate({ content: 'test query' })).toBe(true);
    });

    it('should validate object with query', () => {
      expect(tool.validate({ content: { query: 'test query' } })).toBe(true);
    });

    it('should validate query with allowed_domains', () => {
      expect(
        tool.validate({
          content: {
            query: 'test query',
            allowed_domains: ['example.com'],
          },
        })
      ).toBe(true);
    });

    it('should validate query with excluded_domains', () => {
      expect(
        tool.validate({
          content: {
            query: 'test query',
            excluded_domains: ['spam.com'],
          },
        })
      ).toBe(true);
    });

    it('should reject empty query', () => {
      expect(tool.validate({ content: '' })).toBe(false);
    });

    it('should reject empty query object', () => {
      expect(tool.validate({ content: { query: '' } })).toBe(false);
    });

    it('should reject both allowed and excluded domains', () => {
      expect(
        tool.validate({
          content: {
            query: 'test',
            allowed_domains: ['a.com'],
            excluded_domains: ['b.com'],
          },
        })
      ).toBe(false);
    });
  });

  describe('execute', () => {
    it('should return error when XAI_API_KEY is missing', async () => {
      const result = await tool.execute(
        { content: 'test query' },
        { env: {} } // No API key
      );

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe(XAI_ERROR_CODES.MISSING_API_KEY);
    });

    it('should return error for invalid input', async () => {
      const result = await tool.execute({ content: '' }, { env: { XAI_API_KEY: 'test-key' } });

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe(XAI_ERROR_CODES.INVALID_INPUT);
    });

    it('should make API request with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: [
            {
              type: 'message',
              content: [{ type: 'text', text: 'Search results here' }],
            },
          ],
          citations: [{ url: 'https://example.com', title: 'Example' }],
        }),
      });

      const result = await tool.execute(
        { content: 'test query' },
        { env: { XAI_API_KEY: 'test-key' } }
      );

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.x.ai/v1/responses',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(result.status).toBe('success');
    });

    it('should return success with content and citations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: [
            {
              type: 'message',
              content: [{ type: 'text', text: 'AI generated summary' }],
            },
          ],
          citations: [
            { url: 'https://example.com', title: 'Example Site' },
            { url: 'https://test.com', title: 'Test Site' },
          ],
        }),
      });

      const result = await tool.execute(
        { content: { query: 'test query' } },
        { env: { XAI_API_KEY: 'test-key' } }
      );

      expect(result.status).toBe('success');
      expect(result.content).toEqual(
        expect.objectContaining({
          summary: 'AI generated summary',
          query: 'test query',
          citations: expect.arrayContaining([
            expect.objectContaining({ url: 'https://example.com' }),
          ]),
        })
      );
      expect(result.metadata?.citationCount).toBe(2);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const result = await tool.execute(
        { content: 'test query' },
        { env: { XAI_API_KEY: 'test-key' } }
      );

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe(XAI_ERROR_CODES.XAI_API_ERROR);
    });

    it('should handle rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      const result = await tool.execute(
        { content: 'test query' },
        { env: { XAI_API_KEY: 'test-key' } }
      );

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe(XAI_ERROR_CODES.RATE_LIMITED);
    });

    it('should include domain filters in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: [{ type: 'message', content: [{ type: 'text', text: 'result' }] }],
          citations: [],
        }),
      });

      await tool.execute(
        {
          content: {
            query: 'test query',
            allowed_domains: ['example.com', 'test.com'],
          },
        },
        { env: { XAI_API_KEY: 'test-key' } }
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.tools[0].filters).toEqual({
        allowed_domains: ['example.com', 'test.com'],
      });
    });

    it('should include metadata in result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: [{ type: 'message', content: [{ type: 'text', text: 'result' }] }],
          citations: [],
        }),
      });

      const result = await tool.execute(
        { content: 'test query' },
        { env: { XAI_API_KEY: 'test-key' } }
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.duration).toBeDefined();
      expect(result.metadata?.timestamp).toBeDefined();
    });
  });
});

describe('xaiWebSearchTool singleton', () => {
  it('should be an instance of XAIWebSearchTool', () => {
    expect(xaiWebSearchTool).toBeInstanceOf(XAIWebSearchTool);
  });

  it('should have name "xai_web_search"', () => {
    expect(xaiWebSearchTool.name).toBe('xai_web_search');
  });
});
