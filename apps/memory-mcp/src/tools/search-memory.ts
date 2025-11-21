import { z } from 'zod';
import type { D1Storage } from '../storage/d1.js';
import type { SearchResult } from '../types.js';

export const searchMemorySchema = z.object({
  query: z.string(),
  limit: z.number().optional().default(10),
  filter: z
    .object({
      session_id: z.string().optional(),
      date_range: z
        .object({
          start: z.number(),
          end: z.number(),
        })
        .optional(),
    })
    .optional(),
});

export type SearchMemoryInput = z.infer<typeof searchMemorySchema>;

export async function searchMemory(
  input: SearchMemoryInput,
  d1Storage: D1Storage,
  userId: string
): Promise<{ results: SearchResult[] }> {
  const { query, limit = 10, filter } = input;

  // Use D1 search with SQL LIKE
  const searchOptions: {
    sessionId?: string;
    dateRange?: { start: number; end: number };
    limit?: number;
  } = {
    limit: limit * 2, // Get more to allow for context fetching
  };
  if (filter?.session_id) {
    searchOptions.sessionId = filter.session_id;
  }
  if (filter?.date_range) {
    searchOptions.dateRange = filter.date_range;
  }
  const searchResults = await d1Storage.searchMessages(userId, query, searchOptions);

  const results: SearchResult[] = [];

  // Group results by session to fetch context efficiently
  const resultsBySession = new Map<string, typeof searchResults>();
  for (const result of searchResults) {
    const sessionResults = resultsBySession.get(result.sessionId) || [];
    sessionResults.push(result);
    resultsBySession.set(result.sessionId, sessionResults);
  }

  // Fetch context for each session's results
  for (const [sessionId, sessionResults] of resultsBySession) {
    const allMessages = await d1Storage.getMessages(sessionId);

    for (const result of sessionResults) {
      const { message, messageIndex } = result;

      // Calculate simple relevance score
      const queryLower = query.toLowerCase();
      const contentLower = message.content.toLowerCase();
      const occurrences = (contentLower.match(new RegExp(queryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      const score = occurrences / message.content.length;

      // Get context (surrounding messages)
      const contextStart = Math.max(0, messageIndex - 2);
      const contextEnd = Math.min(allMessages.length, messageIndex + 3);
      const context = allMessages.slice(contextStart, contextEnd).filter((_, idx) => {
        return idx !== messageIndex - contextStart; // Exclude the matching message itself
      });

      results.push({
        session_id: sessionId,
        message,
        score,
        context,
      });
    }
  }

  // Sort by score and limit
  results.sort((a, b) => b.score - a.score);
  return { results: results.slice(0, limit) };
}
