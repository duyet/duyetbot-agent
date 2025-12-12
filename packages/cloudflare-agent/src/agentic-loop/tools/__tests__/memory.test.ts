/**
 * Tests for Memory Tool
 *
 * Validates memory tool behavior including:
 * - Stub responses when MCP is unavailable
 * - Error handling for invalid queries
 * - Action-specific response generation
 * - Graceful fallback behavior
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { LoopContext } from '../../types.js';
import { memoryTool } from '../memory.js';

describe('memoryTool', () => {
  let mockContext: LoopContext;

  beforeEach(() => {
    mockContext = {
      executionContext: {
        traceId: 'test-trace-123',
      } as any,
      iteration: 0,
      toolHistory: [],
      isSubagent: false,
    };
  });

  describe('tool metadata', () => {
    it('should have correct name', () => {
      expect(memoryTool.name).toBe('memory');
    });

    it('should have description', () => {
      expect(memoryTool.description).toBeDefined();
      expect(memoryTool.description).toContain('personal information');
    });

    it('should have valid parameters schema', () => {
      expect(memoryTool.parameters.type).toBe('object');
      expect(memoryTool.parameters.properties).toBeDefined();
      expect(memoryTool.parameters.required).toContain('query');
    });

    it('should define action enum values', () => {
      const actionProp = memoryTool.parameters.properties?.action as any;
      expect(actionProp.enum).toContain('search');
      expect(actionProp.enum).toContain('get_blog_posts');
      expect(actionProp.enum).toContain('get_cv');
      expect(actionProp.enum).toContain('get_contact');
      expect(actionProp.enum).toContain('get_skills');
    });
  });

  describe('execute with default action (search)', () => {
    it('should return success with stub response for blog query', async () => {
      const result = await memoryTool.execute(
        {
          query: 'latest blog posts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('latest blog posts');
      expect(result.output).toContain('stub');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should return success with stub response for about duyet query', async () => {
      const result = await memoryTool.execute(
        {
          query: 'about duyet',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('about duyet');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('execute with get_blog_posts action', () => {
    it('should return success with blog-specific response', async () => {
      const result = await memoryTool.execute(
        {
          query: 'React performance',
          action: 'get_blog_posts',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Blog posts');
      expect(result.output).toContain('React performance');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('execute with get_cv action', () => {
    it('should return success with CV-specific response', async () => {
      const result = await memoryTool.execute(
        {
          query: 'professional experience',
          action: 'get_cv',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('CV');
      expect(result.output).toContain('professional experience');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('execute with get_contact action', () => {
    it('should return success with contact-specific response', async () => {
      const result = await memoryTool.execute(
        {
          query: 'email address',
          action: 'get_contact',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Contact');
      expect(result.output).toContain('email address');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('execute with get_skills action', () => {
    it('should return success with skills-specific response', async () => {
      const result = await memoryTool.execute(
        {
          query: 'programming languages',
          action: 'get_skills',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Skills');
      expect(result.output).toContain('programming languages');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('execution timing', () => {
    it('should record execution duration', async () => {
      const result = await memoryTool.execute(
        {
          query: 'test query',
        },
        mockContext
      );

      expect(result.durationMs).toBeDefined();
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should handle error in graceful fallback response', async () => {
      const errorContext = {
        ...mockContext,
        executionContext: {
          ...mockContext.executionContext,
          mcp: {
            // Intentionally broken MCP client to trigger error
            throw: () => {
              throw new Error('MCP Connection Failed');
            },
          } as any,
        },
      };

      // This test ensures error handling doesn't break
      // Current implementation returns success with fallback
      const result = await memoryTool.execute(
        {
          query: 'test',
        },
        errorContext
      );

      // Even with potential errors, the tool should return a response
      expect(result).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('stub mode behavior', () => {
    it('should indicate stub mode in all responses', async () => {
      const result = await memoryTool.execute(
        {
          query: 'any query',
        },
        mockContext
      );

      // Current implementation returns stub messages
      expect(result.output).toContain('stub');
      expect(result.output).toContain('MCP');
    });

    it('should preserve query in stub response', async () => {
      const query = 'unique query for testing';
      const result = await memoryTool.execute(
        {
          query,
        },
        mockContext
      );

      expect(result.output).toContain(query);
    });
  });
});
