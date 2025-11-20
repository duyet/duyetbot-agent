import { z } from 'zod';
import { generateSessionId } from '../auth/github.js';
import type { D1Storage } from '../storage/d1.js';
import type { KVStorage } from '../storage/kv.js';
import type { LLMMessage, SaveMemoryResult } from '../types.js';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const saveMemorySchema = z.object({
  session_id: z.string().optional(),
  messages: z.array(messageSchema),
  metadata: z.record(z.unknown()).optional(),
});

export type SaveMemoryInput = z.infer<typeof saveMemorySchema>;

export async function saveMemory(
  input: SaveMemoryInput,
  d1Storage: D1Storage,
  kvStorage: KVStorage,
  userId: string
): Promise<SaveMemoryResult> {
  const { messages, metadata } = input;
  const sessionId = input.session_id;

  const now = Date.now();

  // Add timestamps to messages if not present
  const timestampedMessages: LLMMessage[] = messages.map((msg) => {
    const result: LLMMessage = {
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp || now,
    };
    if (msg.metadata) {
      result.metadata = msg.metadata;
    }
    return result;
  });

  // Get or create session
  const session = sessionId ? await d1Storage.getSession(sessionId) : null;
  const finalSessionId = sessionId || generateSessionId();

  if (session) {
    // Verify user owns the session
    if (session.user_id !== userId) {
      throw new Error('Unauthorized: session belongs to another user');
    }

    // Update session metadata
    await d1Storage.updateSession(finalSessionId, {
      updated_at: now,
      metadata: metadata ? { ...session.metadata, ...metadata } : session.metadata,
    });
  } else {
    // Generate title from first user message
    const firstUserMessage = messages.find((m) => m.role === 'user');
    const title = firstUserMessage ? firstUserMessage.content.slice(0, 100) : 'New Session';

    await d1Storage.createSession({
      id: finalSessionId,
      user_id: userId,
      title,
      state: 'active',
      created_at: now,
      updated_at: now,
      metadata: metadata || null,
    });
  }

  // Save messages to KV (replace all)
  const savedCount = await kvStorage.saveMessages(finalSessionId, timestampedMessages);

  return {
    session_id: finalSessionId,
    saved_count: savedCount,
    updated_at: now,
  };
}
