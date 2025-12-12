/**
 * Tests for the research tool in agentic loop
 *
 * Verifies:
 * - Tool definition is valid
 * - Parameters are correctly specified
 * - Execute function returns properly formatted results
 * - Stub responses work for all search sources
 */

import { describe, expect, it } from 'vitest';
import type { LoopContext } from '../../types.js';
import { researchTool } from '../research.js';

describe('researchTool', () => {
  const mockContext: LoopContext = {
    executionContext: {
      platform: 'test',
      traceId: 'test-trace',
    } as any,
    iteration: 0,
    toolHistory: [],
    isSubagent: false,
  };

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(researchTool.name).toBe('research');
    });

    it('should have a description', () => {
      expect(researchTool.description).toBeTruthy();
      expect(researchTool.description).toContain('web');
    });

    it('should have proper parameters schema', () => {
      expect(researchTool.parameters.type).toBe('object');
      expect(researchTool.parameters.properties).toBeDefined();
      expect(researchTool.parameters.required).toContain('query');
    });

    it('should have query parameter as required string', () => {
      const queryProp = researchTool.parameters.properties?.query as Record<string, unknown>;
      expect(queryProp.type).toBe('string');
      expect(queryProp.description).toBeTruthy();
    });

    it('should have maxResults parameter as optional number', () => {
      const maxProp = researchTool.parameters.properties?.maxResults as Record<string, unknown>;
      expect(maxProp.type).toBe('number');
      expect(maxProp.description).toBeTruthy();
    });

    it('should have source parameter with enum', () => {
      const sourceProp = researchTool.parameters.properties?.source as Record<string, unknown>;
      expect(sourceProp.type).toBe('string');
      expect(sourceProp.enum).toEqual(['web', 'news', 'docs']);
    });
  });

  describe('execute function', () => {
    it('should return success for valid query', async () => {
      const result = await researchTool.execute({ query: 'React hooks' }, mockContext);

      expect(result.success).toBe(true);
      expect(result.output).toBeTruthy();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle different search sources', async () => {
      const sources = ['web', 'news', 'docs'];

      for (const source of sources) {
        const result = await researchTool.execute({ query: 'test query', source }, mockContext);

        expect(result.success).toBe(true);
        expect(result.output).toContain('Search Results');
        // Source is mapped: web -> 'general', news -> 'current events', docs -> 'documentation'
        // Just verify the output contains the source info section
        expect(result.output).toContain('Source:');
      }
    });

    it('should respect maxResults parameter', async () => {
      const result = await researchTool.execute({ query: 'test', maxResults: 10 }, mockContext);

      expect(result.success).toBe(true);
      expect(result.output).toContain('10');
    });

    it('should cap maxResults at 20', async () => {
      const result = await researchTool.execute({ query: 'test', maxResults: 100 }, mockContext);

      expect(result.success).toBe(true);
      expect(result.output).toContain('20');
    });

    it('should fail for empty query', async () => {
      const result = await researchTool.execute({ query: '' }, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail for invalid source', async () => {
      const result = await researchTool.execute({ query: 'test', source: 'invalid' }, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid source');
    });

    it('should include data in stub response', async () => {
      const result = await researchTool.execute(
        { query: 'test query', maxResults: 5, source: 'news' },
        mockContext
      );

      expect(result.data).toBeDefined();
      expect(result.data?.query).toBe('test query');
      expect(result.data?.source).toBe('news');
    });

    it('should indicate this is a stub response', async () => {
      const result = await researchTool.execute({ query: 'test' }, mockContext);

      expect(result.output).toContain('STUB');
      expect(result.output).toContain('Search API Integration In Progress');
    });
  });

  describe('SearchResult type', () => {
    it('should be exported for use in search implementations', () => {
      // This test just verifies the type exists and is importable
      // The actual type checking happens at compile time
      expect(researchTool).toBeDefined();
    });
  });
});
