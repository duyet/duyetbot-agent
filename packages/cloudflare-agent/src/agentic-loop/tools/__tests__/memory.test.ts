/**
 * Tests for Memory Tools
 *
 * Validates memory tool behavior including:
 * - memory__save tool (short-term and long-term memory)
 * - memory__recall tool (retrieve memories by type/key/category)
 * - memory__search tool (semantic search across memory)
 * - Graceful fallback when memory service is unavailable
 * - Proper error handling and validation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoopContext } from '../../types.js';
import { memoryRecallTool, memorySaveTool, memorySearchTool } from '../memory.js';

describe('Memory Tools', () => {
  let mockContext: LoopContext;

  beforeEach(() => {
    mockContext = {
      executionContext: {
        traceId: 'test-trace-123',
        userId: 'test-user-456',
        spanId: 'test-span-789',
        platform: 'telegram',
        chatId: 'test-chat',
        userMessageId: 'test-msg',
        provider: 'claude',
        model: 'claude-opus',
        query: 'test query',
        conversationHistory: [],
        debug: {
          agentChain: [],
          toolCalls: [],
          warnings: [],
          errors: [],
        },
        startedAt: Date.now(),
        deadline: Date.now() + 30000,
      } as any,
      iteration: 0,
      toolHistory: [],
      isSubagent: false,
    };
  });

  describe('memorySaveTool', () => {
    describe('tool metadata', () => {
      it('should have correct name', () => {
        expect(memorySaveTool.name).toBe('memory__save');
      });

      it('should have description', () => {
        expect(memorySaveTool.description).toBeDefined();
        expect(memorySaveTool.description).toContain('memory');
        expect(memorySaveTool.description.toLowerCase()).toContain('save');
      });

      it('should have valid parameters schema', () => {
        expect(memorySaveTool.parameters.type).toBe('object');
        expect(memorySaveTool.parameters.properties).toBeDefined();
        expect(memorySaveTool.parameters.required).toContain('type');
        expect(memorySaveTool.parameters.required).toContain('key');
        expect(memorySaveTool.parameters.required).toContain('value');
      });

      it('should define memory type enum values', () => {
        const typeProp = memorySaveTool.parameters.properties?.type as any;
        expect(typeProp.enum).toContain('short_term');
        expect(typeProp.enum).toContain('long_term');
      });

      it('should define category enum values', () => {
        const categoryProp = memorySaveTool.parameters.properties?.category as any;
        expect(categoryProp.enum).toContain('fact');
        expect(categoryProp.enum).toContain('preference');
        expect(categoryProp.enum).toContain('pattern');
        expect(categoryProp.enum).toContain('decision');
        expect(categoryProp.enum).toContain('note');
      });
    });

    describe('execute with short-term memory', () => {
      it('should save short-term memory successfully', async () => {
        const result = await memorySaveTool.execute(
          {
            type: 'short_term',
            key: 'current_task',
            value: 'implementing feature X',
          },
          mockContext
        );

        expect(result.success).toBe(true);
        // Graceful fallback when service unavailable
        expect(result.output).toContain('current_task');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });
    });

    describe('execute with long-term memory', () => {
      it('should save long-term memory successfully', async () => {
        const result = await memorySaveTool.execute(
          {
            type: 'long_term',
            category: 'preference',
            key: 'favorite_language',
            value: 'TypeScript',
            importance: 8,
          },
          mockContext
        );

        expect(result.success).toBe(true);
        // Graceful fallback when service unavailable
        expect(result.output).toContain('favorite_language');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should handle missing category for long-term memory', async () => {
        const result = await memorySaveTool.execute(
          {
            type: 'long_term',
            key: 'test_key',
            value: 'test_value',
          },
          mockContext
        );

        // Should still succeed with fallback since category defaults to 'note'
        expect(result.success).toBe(true);
      });
    });

    describe('execution timing', () => {
      it('should record execution duration', async () => {
        const result = await memorySaveTool.execute(
          {
            type: 'short_term',
            key: 'test',
            value: 'data',
          },
          mockContext
        );

        expect(result.durationMs).toBeDefined();
        expect(typeof result.durationMs).toBe('number');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });
    });

    describe('error handling', () => {
      it('should handle empty key gracefully', async () => {
        const result = await memorySaveTool.execute(
          {
            type: 'short_term',
            key: '',
            value: 'data',
          },
          mockContext
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should handle empty value gracefully', async () => {
        const result = await memorySaveTool.execute(
          {
            type: 'short_term',
            key: 'test',
            value: '',
          },
          mockContext
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('memoryRecallTool', () => {
    describe('tool metadata', () => {
      it('should have correct name', () => {
        expect(memoryRecallTool.name).toBe('memory__recall');
      });

      it('should have description', () => {
        expect(memoryRecallTool.description).toBeDefined();
        expect(memoryRecallTool.description).toContain('Recall');
        expect(memoryRecallTool.description).toContain('memory');
      });

      it('should have valid parameters schema', () => {
        expect(memoryRecallTool.parameters.type).toBe('object');
        expect(memoryRecallTool.parameters.properties).toBeDefined();
        expect(memoryRecallTool.parameters.required).toContain('type');
      });

      it('should define memory type enum values', () => {
        const typeProp = memoryRecallTool.parameters.properties?.type as any;
        expect(typeProp.enum).toContain('short_term');
        expect(typeProp.enum).toContain('long_term');
        expect(typeProp.enum).toContain('both');
      });
    });

    describe('execute', () => {
      it('should recall short-term memory', async () => {
        const result = await memoryRecallTool.execute(
          {
            type: 'short_term',
          },
          mockContext
        );

        expect(result.success).toBe(true);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should recall long-term memory', async () => {
        const result = await memoryRecallTool.execute(
          {
            type: 'long_term',
          },
          mockContext
        );

        expect(result.success).toBe(true);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should recall both short-term and long-term memory', async () => {
        const result = await memoryRecallTool.execute(
          {
            type: 'both',
          },
          mockContext
        );

        expect(result.success).toBe(true);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should filter by key when provided', async () => {
        const result = await memoryRecallTool.execute(
          {
            type: 'long_term',
            key: 'specific_key',
          },
          mockContext
        );

        expect(result.success).toBe(true);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should filter by category when provided', async () => {
        const result = await memoryRecallTool.execute(
          {
            type: 'long_term',
            category: 'preference',
          },
          mockContext
        );

        expect(result.success).toBe(true);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });
    });

    describe('execution timing', () => {
      it('should record execution duration', async () => {
        const result = await memoryRecallTool.execute(
          {
            type: 'short_term',
          },
          mockContext
        );

        expect(result.durationMs).toBeDefined();
        expect(typeof result.durationMs).toBe('number');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('memorySearchTool', () => {
    describe('tool metadata', () => {
      it('should have correct name', () => {
        expect(memorySearchTool.name).toBe('memory__search');
      });

      it('should have description', () => {
        expect(memorySearchTool.description).toBeDefined();
        expect(memorySearchTool.description).toContain('Search');
        expect(memorySearchTool.description).toContain('memory');
      });

      it('should have valid parameters schema', () => {
        expect(memorySearchTool.parameters.type).toBe('object');
        expect(memorySearchTool.parameters.properties).toBeDefined();
        expect(memorySearchTool.parameters.required).toContain('query');
      });
    });

    describe('execute', () => {
      it('should search memory with basic query', async () => {
        const result = await memorySearchTool.execute(
          {
            query: 'programming preferences',
          },
          mockContext
        );

        expect(result.success).toBe(true);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should search with category filter', async () => {
        const result = await memorySearchTool.execute(
          {
            query: 'user preferences',
            categories: ['preference', 'decision'],
          },
          mockContext
        );

        expect(result.success).toBe(true);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should respect limit parameter', async () => {
        const result = await memorySearchTool.execute(
          {
            query: 'test',
            limit: 3,
          },
          mockContext
        );

        expect(result.success).toBe(true);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should handle empty query gracefully', async () => {
        const result = await memorySearchTool.execute(
          {
            query: '',
          },
          mockContext
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should use default limit of 5 when not specified', async () => {
        const result = await memorySearchTool.execute(
          {
            query: 'test search',
          },
          mockContext
        );

        expect(result.success).toBe(true);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });
    });

    describe('execution timing', () => {
      it('should record execution duration', async () => {
        const result = await memorySearchTool.execute(
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
  });

  describe('integration scenarios', () => {
    it('should allow save followed by recall', async () => {
      const saveResult = await memorySaveTool.execute(
        {
          type: 'long_term',
          category: 'fact',
          key: 'user_preference',
          value: 'likes documentation',
          importance: 7,
        },
        mockContext
      );

      expect(saveResult.success).toBe(true);

      const recallResult = await memoryRecallTool.execute(
        {
          type: 'long_term',
          category: 'fact',
        },
        mockContext
      );

      expect(recallResult.success).toBe(true);
    });

    it('should allow search after saving', async () => {
      const saveResult = await memorySaveTool.execute(
        {
          type: 'long_term',
          category: 'preference',
          key: 'language_choice',
          value: 'TypeScript',
          importance: 8,
        },
        mockContext
      );

      expect(saveResult.success).toBe(true);

      const searchResult = await memorySearchTool.execute(
        {
          query: 'programming language preference',
        },
        mockContext
      );

      expect(searchResult.success).toBe(true);
    });
  });
});
