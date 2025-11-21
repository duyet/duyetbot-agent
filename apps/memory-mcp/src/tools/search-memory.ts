import { z } from 'zod';
import type { D1Storage } from '../storage/d1.js';
import type { KVStorage } from '../storage/kv.js';
import type { SearchResult, Session } from '../types.js';

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
  kvStorage: KVStorage,
  userId: string
): Promise<{ results: SearchResult[] }> {
  const { query, limit = 10, filter } = input;

  // Get user's sessions
  let sessions: Session[];
  if (filter?.session_id) {
    const session = await d1Storage.getSession(filter.session_id);
    if (!session || session.user_id !== userId) {
      return { results: [] };
    }
    sessions = [session];
  } else {
    const result = await d1Storage.listSessions(userId, { limit: 100 });
    sessions = result.sessions;
  }

  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  // Simple text search (Vectorize integration can be added later)
  for (const session of sessions) {
    const messages = await kvStorage.getMessages(session.id);

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (!message) {
        continue;
      }

      // Apply date filter
      if (filter?.date_range) {
        const timestamp = message.timestamp || session.created_at;
        if (timestamp < filter.date_range.start || timestamp > filter.date_range.end) {
          continue;
        }
      }

      // Simple keyword matching (can be replaced with vector search)
      const contentLower = message.content.toLowerCase();
      if (contentLower.includes(queryLower)) {
        // Calculate simple relevance score
        const occurrences = (contentLower.match(new RegExp(queryLower, 'g')) || []).length;
        const score = occurrences / message.content.length;

        // Get context (surrounding messages)
        const contextStart = Math.max(0, i - 2);
        const contextEnd = Math.min(messages.length, i + 3);
        const context = messages.slice(contextStart, contextEnd).filter((m, idx) => {
          return m && idx !== i - contextStart; // Exclude the matching message itself
        });

        results.push({
          session_id: session.id,
          message,
          score,
          context,
        });
      }
    }
  }

  // Sort by score and limit
  results.sort((a, b) => b.score - a.score);
  return { results: results.slice(0, limit) };
}
