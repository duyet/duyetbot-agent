import { z } from 'zod';
import type { D1Storage } from '../storage/d1.js';
import type { MemoryData } from '../types.js';

export const getMemorySchema = z.object({
  session_id: z.string(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

export type GetMemoryInput = z.infer<typeof getMemorySchema>;

export async function getMemory(
  input: GetMemoryInput,
  d1Storage: D1Storage,
  userId: string
): Promise<MemoryData> {
  const { session_id, limit, offset = 0 } = input;

  // Get session metadata from D1
  const session = await d1Storage.getSession(session_id);

  if (!session) {
    // Return empty memory for non-existent session
    return {
      session_id,
      messages: [],
      metadata: {},
    };
  }

  // Verify user owns the session
  if (session.user_id !== userId) {
    throw new Error('Unauthorized: session belongs to another user');
  }

  // Get messages from D1 with pagination
  const options: { limit?: number; offset?: number } = { offset };
  if (limit !== undefined) {
    options.limit = limit;
  }
  const messages = await d1Storage.getMessages(session_id, options);

  return {
    session_id,
    messages,
    metadata: session.metadata || {},
  };
}
