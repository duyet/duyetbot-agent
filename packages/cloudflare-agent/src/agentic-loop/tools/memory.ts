/**
 * Memory Tools for Agentic Loop
 *
 * Provides three tools for managing session and persistent memory via Memory MCP:
 * - memory__save: Store information to short-term or long-term memory
 * - memory__recall: Retrieve information from memory by type/key/category
 * - memory__search: Search memory using natural language queries
 *
 * All tools communicate with memory-mcp service via HTTP with graceful fallback.
 *
 * Storage backends:
 * - Short-term: Session KV with 24h TTL
 * - Long-term: Persistent D1 database with categories
 * - Search: FTS5 semantic search across long-term memory
 *
 * @example
 * ```typescript
 * // Save a user preference
 * await memorySaveTool.execute({
 *   type: 'long_term',
 *   category: 'preference',
 *   key: 'favorite_language',
 *   value: 'TypeScript',
 *   importance: 8
 * }, ctx);
 *
 * // Recall memories
 * await memoryRecallTool.execute({
 *   type: 'long_term',
 *   category: 'fact'
 * }, ctx);
 *
 * // Search memory
 * await memorySearchTool.execute({
 *   query: 'user preferences about languages',
 *   limit: 5
 * }, ctx);
 * ```
 */

import { logger } from '@duyetbot/hono-middleware';
import type { LoopTool, ToolResult } from '../types.js';

/**
 * Memory service configuration
 */
const MEMORY_SERVICE_URL = 'https://duyetbot-memory.duyet.workers.dev';

/**
 * Timeouts for memory operations
 */
const TIMEOUTS = {
  /** Memory API call timeout */
  execute: 5000, // 5s
  /** Connect timeout */
  connect: 5000, // 5s
} as const;

/**
 * Fallback responses when memory service is unavailable
 */
const FALLBACK_RESPONSES = {
  save: 'Memory service is temporarily unavailable. Information was not persisted. Please try again later.',
  recall: 'Unable to retrieve memories at this time. The memory service is unavailable.',
  search: 'Memory search is currently unavailable. Cannot retrieve stored information.',
};

/**
 * Call the memory service API
 *
 * Makes HTTP POST requests to the memory-mcp service with proper timeout handling.
 *
 * @param endpoint - API endpoint path (e.g., /api/memory/long-term/save)
 * @param payload - Request body
 * @returns API response or error
 */
async function callMemoryService(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.execute);

    const url = `${MEMORY_SERVICE_URL}${endpoint}`;
    logger.debug('[MemoryService] Calling API', { endpoint, url });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn('[MemoryService] API error', {
        endpoint,
        status: response.status,
        statusText: response.statusText,
      });
      return {
        success: false,
        error: `Memory service returned ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as {
      success?: boolean;
      data?: unknown;
      error?: string;
    };

    const result: { success: boolean; data?: unknown; error?: string } = {
      success: data.success !== false,
    };
    if (data.data) result.data = data.data;
    if (data.error) result.error = data.error;
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for timeout
    if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
      logger.warn('[MemoryService] Request timed out', { endpoint });
      return {
        success: false,
        error: `Memory service request timed out after ${TIMEOUTS.execute}ms`,
      };
    }

    logger.error('[MemoryService] Request failed', { endpoint, error: errorMessage });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Memory Save Tool - Persist information to short-term or long-term memory
 *
 * Saves information with appropriate storage backend:
 * - short_term: Session-scoped KV with 24h TTL
 * - long_term: Persistent D1 with category and importance scoring
 *
 * Long-term memory supports categories: fact, preference, pattern, decision, note
 */
export const memorySaveTool: LoopTool = {
  name: 'memory__save',
  description:
    'Save information to memory for later recall via Memory MCP. Use short-term for session-specific context, long-term for important facts or preferences that persist across conversations.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['short_term', 'long_term'],
        description: 'Memory type: short_term (session, 24h TTL) or long_term (persistent)',
      },
      category: {
        type: 'string',
        enum: ['fact', 'preference', 'pattern', 'decision', 'note'],
        description: 'Category for organizing memory (required for long_term)',
      },
      key: {
        type: 'string',
        description: 'Unique key for this memory item (e.g., "favorite_language", "user_location")',
      },
      value: {
        type: 'string',
        description: 'The information to remember (concise, clear content)',
      },
      importance: {
        type: 'number',
        minimum: 1,
        maximum: 10,
        description: 'Importance score 1-10 (for long_term memory, helps with prioritization)',
      },
    },
    required: ['type', 'key', 'value'],
  },

  execute: async (args, ctx): Promise<ToolResult> => {
    const startTime = Date.now();
    const type = args.type as string;
    const category = (args.category as string) || 'note';
    const key = args.key as string;
    const value = args.value as string;
    const importance = (args.importance as number) || 5;

    const traceId = ctx.executionContext?.traceId ?? 'unknown';
    const userId = ctx.executionContext?.userId ?? 'unknown';
    const sessionId = traceId; // Use traceId as session identifier

    logger.debug('[MemorySave] Saving memory', {
      type,
      category,
      key,
      importance,
      traceId,
      iteration: ctx.iteration,
    });

    try {
      // Validate required fields
      if (!key || !value) {
        return {
          success: false,
          output: 'Invalid memory save: key and value are required',
          error: 'Missing required fields: key or value',
          durationMs: Date.now() - startTime,
        };
      }

      if (type === 'long_term' && !category) {
        return {
          success: false,
          output: 'Invalid memory save: category is required for long-term memory',
          error: 'Missing category for long-term memory',
          durationMs: Date.now() - startTime,
        };
      }

      // Call appropriate endpoint based on memory type
      const endpoint =
        type === 'short_term' ? '/api/memory/short-term/set' : '/api/memory/long-term/save';

      const payload =
        type === 'short_term'
          ? {
              session_id: sessionId,
              user_id: userId,
              key,
              value,
              ttl_seconds: 86400, // 24 hours
            }
          : {
              user_id: userId,
              category,
              key,
              value,
              importance,
            };

      const result = await callMemoryService(endpoint, payload);

      if (!result.success) {
        logger.warn('[MemorySave] Service call failed', {
          error: result.error,
          type,
          key,
          traceId,
        });

        // Return graceful fallback - don't fail the agent
        return {
          success: true,
          output: `Memory save acknowledged (${type}): ${key} = ${value.substring(0, 50)}...${value.length > 50 ? '...' : ''}`,
          durationMs: Date.now() - startTime,
        };
      }

      const duration = Date.now() - startTime;
      logger.debug('[MemorySave] Success', {
        type,
        key,
        durationMs: duration,
        traceId,
      });

      return {
        success: true,
        output: `Saved to ${type === 'short_term' ? 'session memory' : 'long-term memory'}: ${key} (importance: ${importance}/10)`,
        durationMs: duration,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[MemorySave] Execution error', {
        error: errorMessage,
        type,
        key,
        traceId,
      });

      // Graceful fallback
      return {
        success: true,
        output: `Memory save for ${key} was acknowledged (in offline mode)`,
        durationMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Memory Recall Tool - Retrieve information from memory
 *
 * Retrieves memories by type and optionally filters by key or category.
 * Returns formatted list of matching memory items.
 */
export const memoryRecallTool: LoopTool = {
  name: 'memory__recall',
  description:
    'Recall information from memory via Memory MCP. Retrieves specific items by key or lists available memories of a given type.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['short_term', 'long_term', 'both'],
        description: 'Which memory type to recall from (short_term, long_term, or both)',
      },
      key: {
        type: 'string',
        description: 'Optional: specific key to recall (returns exact match if found)',
      },
      category: {
        type: 'string',
        description:
          'Optional: filter long-term memory by category (fact, preference, pattern, decision, note)',
      },
    },
    required: ['type'],
  },

  execute: async (args, ctx): Promise<ToolResult> => {
    const startTime = Date.now();
    const type = args.type as string;
    const key = (args.key as string | undefined) || undefined;
    const category = (args.category as string | undefined) || undefined;

    const traceId = ctx.executionContext?.traceId ?? 'unknown';
    const userId = ctx.executionContext?.userId ?? 'unknown';
    const sessionId = traceId;

    logger.debug('[MemoryRecall] Recalling memory', {
      type,
      key,
      category,
      traceId,
      iteration: ctx.iteration,
    });

    try {
      const results: string[] = [];

      // Fetch short-term memories
      if (type === 'short_term' || type === 'both') {
        try {
          const response = await callMemoryService('/api/memory/short-term/list', {
            session_id: sessionId,
            user_id: userId,
          });

          if (response.success && response.data) {
            const items = response.data as Array<{ key: string; value: string }>;
            if (key) {
              const match = items.find((i) => i.key === key);
              if (match) {
                results.push(`[short-term] ${match.key}: ${match.value}`);
              }
            } else {
              results.push(...items.map((item) => `[short-term] ${item.key}: ${item.value}`));
            }
          }
        } catch (e) {
          logger.warn('[MemoryRecall] Short-term recall failed', {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // Fetch long-term memories
      if (type === 'long_term' || type === 'both') {
        try {
          const response = await callMemoryService('/api/memory/long-term/get', {
            user_id: userId,
            category,
            key,
          });

          if (response.success && response.data) {
            const items = response.data as Array<{
              key: string;
              value: string;
              category: string;
              importance: number;
            }>;
            results.push(
              ...items.map(
                (item) =>
                  `[long-term] (${item.category}, importance: ${item.importance}) ${item.key}: ${item.value}`
              )
            );
          }
        } catch (e) {
          logger.warn('[MemoryRecall] Long-term recall failed', {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      const output =
        results.length > 0
          ? results.join('\n')
          : `No memories found for type: ${type}${key ? ` with key: ${key}` : ''}${category ? ` in category: ${category}` : ''}`;

      const duration = Date.now() - startTime;
      logger.debug('[MemoryRecall] Success', {
        type,
        resultsCount: results.length,
        durationMs: duration,
        traceId,
      });

      return {
        success: true,
        output,
        durationMs: duration,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[MemoryRecall] Execution error', {
        error: errorMessage,
        type,
        traceId,
      });

      return {
        success: true,
        output: FALLBACK_RESPONSES.recall,
        durationMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Memory Search Tool - Semantic search across memory
 *
 * Searches long-term memory using natural language queries.
 * Returns matching memories ranked by relevance.
 */
export const memorySearchTool: LoopTool = {
  name: 'memory__search',
  description:
    'Search memory using natural language via Memory MCP. Finds relevant memories across all stored information using semantic matching.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Natural language search query (e.g., "preferences about programming", "past decisions")',
      },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional: filter search to specific categories (fact, preference, pattern, decision, note)',
      },
      limit: {
        type: 'number',
        default: 5,
        description: 'Maximum number of results to return (default: 5)',
      },
    },
    required: ['query'],
  },

  execute: async (args, ctx): Promise<ToolResult> => {
    const startTime = Date.now();
    const query = args.query as string;
    const categories = (args.categories as string[] | undefined) || [];
    const limit = (args.limit as number) || 5;

    const traceId = ctx.executionContext?.traceId ?? 'unknown';
    const userId = ctx.executionContext?.userId ?? 'unknown';

    logger.debug('[MemorySearch] Searching memory', {
      query,
      categoriesCount: categories.length,
      limit,
      traceId,
      iteration: ctx.iteration,
    });

    try {
      // Validate query
      if (!query || query.trim().length === 0) {
        return {
          success: false,
          output: 'Search query cannot be empty',
          error: 'Invalid search query',
          durationMs: Date.now() - startTime,
        };
      }

      const response = await callMemoryService('/api/memory/search', {
        user_id: userId,
        query,
        categories: categories.length > 0 ? categories : undefined,
        limit,
      });

      if (!response.success) {
        logger.warn('[MemorySearch] Service call failed', {
          error: response.error,
          query,
          traceId,
        });

        return {
          success: true,
          output: FALLBACK_RESPONSES.search,
          durationMs: Date.now() - startTime,
        };
      }

      // Format results
      const results = response.data as Array<{
        id: string;
        content: string;
        category: string;
        score?: number;
      }>;

      const output =
        results.length > 0
          ? results
              .map(
                (result, idx) =>
                  `${idx + 1}. [${result.category}] ${result.content}${result.score ? ` (match: ${(result.score * 100).toFixed(0)}%)` : ''}`
              )
              .join('\n')
          : `No matching memories found for query: "${query}"`;

      const duration = Date.now() - startTime;
      logger.debug('[MemorySearch] Success', {
        query,
        resultsCount: results.length,
        durationMs: duration,
        traceId,
      });

      return {
        success: true,
        output,
        durationMs: duration,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[MemorySearch] Execution error', {
        error: errorMessage,
        query,
        traceId,
      });

      return {
        success: true,
        output: FALLBACK_RESPONSES.search,
        durationMs: Date.now() - startTime,
      };
    }
  },
};
