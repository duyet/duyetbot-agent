import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { XAI_ERROR_CODES } from '../xai/client.js';
import { XAIXSearchTool, xaiXSearchTool } from '../xai/x-search.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('XAIXSearchTool', () => {
  let tool: XAIXSearchTool;

  beforeEach(() => {
    tool = new XAIXSearchTool();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('properties', () => {
    it('should have name "xai_x_search"', () => {
      expect(tool.name).toBe('xai_x_search');
    });

    it('should have a description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.description).toContain('X (Twitter)');
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

    it('should validate query with allowed_x_handles', () => {
      expect(
        tool.validate({
          content: {
            query: 'test query',
            allowed_x_handles: ['elonmusk'],
          },
        })
      ).toBe(true);
    });

    it('should validate query with date range', () => {
      expect(
        tool.validate({
          content: {
            query: 'test query',
            from_date: '2024-01-01',
            to_date: '2024-12-31',
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

    it('should reject both allowed and excluded handles', () => {
      expect(
        tool.validate({
          content: {
            query: 'test',
            allowed_x_handles: ['user1'],
            excluded_x_handles: ['user2'],
          },
        })
      ).toBe(false);
    });

    it('should reject invalid date format', () => {
      expect(
        tool.validate({
          content: {
            query: 'test',
            from_date: '01-01-2024', // Wrong format
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
              content: [{ type: 'text', text: 'X search results' }],
            },
          ],
          citations: [{ url: 'https://x.com/user/status/123', title: 'Tweet' }],
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
          }),
        })
      );

      // Check tool type is x_search
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.tools[0].type).toBe('x_search');

      expect(result.status).toBe('success');
    });

    it('should return success with content and citations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: [
            {
              type: 'message',
              content: [{ type: 'text', text: 'Summary of X posts' }],
            },
          ],
          citations: [
            { url: 'https://x.com/user1/status/123', title: 'Post 1' },
            { url: 'https://x.com/user2/status/456', title: 'Post 2' },
          ],
        }),
      });

      const result = await tool.execute(
        { content: { query: 'trending topic' } },
        { env: { XAI_API_KEY: 'test-key' } }
      );

      expect(result.status).toBe('success');
      expect(result.content).toEqual(
        expect.objectContaining({
          summary: 'Summary of X posts',
          query: 'trending topic',
          citations: expect.arrayContaining([
            expect.objectContaining({ url: 'https://x.com/user1/status/123' }),
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

    it('should include handle filters in request', async () => {
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
            query: 'AI news',
            allowed_x_handles: ['elonmusk', 'OpenAI'],
          },
        },
        { env: { XAI_API_KEY: 'test-key' } }
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.tools[0].allowed_x_handles).toEqual(['elonmusk', 'OpenAI']);
    });

    it('should include date range in request', async () => {
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
            query: 'recent news',
            from_date: '2024-01-01',
            to_date: '2024-06-30',
          },
        },
        { env: { XAI_API_KEY: 'test-key' } }
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.tools[0].from_date).toBe('2024-01-01');
      expect(requestBody.tools[0].to_date).toBe('2024-06-30');
    });

    it('should include video understanding flag in request', async () => {
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
            query: 'video content',
            enable_video_understanding: true,
          },
        },
        { env: { XAI_API_KEY: 'test-key' } }
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.tools[0].enable_video_understanding).toBe(true);
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

describe('xaiXSearchTool singleton', () => {
  it('should be an instance of XAIXSearchTool', () => {
    expect(xaiXSearchTool).toBeInstanceOf(XAIXSearchTool);
  });

  it('should have name "xai_x_search"', () => {
    expect(xaiXSearchTool.name).toBe('xai_x_search');
  });
});
