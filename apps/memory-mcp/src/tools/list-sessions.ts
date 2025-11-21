import { z } from 'zod';
import type { D1Storage } from '../storage/d1.js';
import type { SessionListItem } from '../types.js';

export const listSessionsSchema = z.object({
  limit: z.number().optional().default(20),
  offset: z.number().optional().default(0),
  state: z.enum(['active', 'paused', 'completed']).optional(),
});

export type ListSessionsInput = z.infer<typeof listSessionsSchema>;

export async function listSessions(
  input: ListSessionsInput,
  d1Storage: D1Storage,
  userId: string
): Promise<{ sessions: SessionListItem[]; total: number }> {
  const { limit = 20, offset = 0, state } = input;

  const options: { limit?: number; offset?: number; state?: string } = {
    limit,
    offset,
  };
  if (state) {
    options.state = state;
  }
  const result = await d1Storage.listSessions(userId, options);

  // Enrich with message counts from D1
  const sessions: SessionListItem[] = await Promise.all(
    result.sessions.map(async (session) => {
      const messageCount = await d1Storage.getMessageCount(session.id);
      return {
        id: session.id,
        title: session.title,
        state: session.state,
        created_at: session.created_at,
        updated_at: session.updated_at,
        message_count: messageCount,
      };
    })
  );

  return {
    sessions,
    total: result.total,
  };
}
