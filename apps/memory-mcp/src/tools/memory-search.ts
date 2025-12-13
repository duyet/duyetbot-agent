import { z } from 'zod';
import type { D1Storage } from '../storage/d1.js';
import type { MemorySearchResultItem } from '../types.js';

export const searchMemorySchema = z.object({
  query: z.string(),
  categories: z.array(z.string()).optional(),
  limit: z.number().optional(),
});

export type SearchMemoryInput = z.infer<typeof searchMemorySchema>;

/**
 * Search long-term memory using natural language query
 * Supports FTS5 with fallback to LIKE queries
 */
export async function searchMemory(input: SearchMemoryInput, d1Storage: D1Storage, userId: string) {
  const { query, categories, limit = 20 } = input;

  if (!query || query.trim().length === 0) {
    return {
      results: [],
      total: 0,
    };
  }

  const results = await d1Storage.searchLongTermMemory(userId, query, {
    ...(categories && categories.length > 0 && { categories }),
    ...(limit !== undefined && { limit }),
  });

  const items: MemorySearchResultItem[] = results.map((item) => ({
    id: item.id,
    content: item.value,
    category: item.category,
    type: 'long_term',
  }));

  return {
    results: items,
    total: items.length,
  };
}
