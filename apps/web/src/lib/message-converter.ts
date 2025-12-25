/**
 * Message Converter Utility
 *
 * Converts between database message format and AI SDK UIMessage format.
 * The database stores messages with plain `content` strings, while the AI SDK
 * expects messages with a `parts` array containing typed content blocks.
 */

import type { UIMessage } from 'ai';

/**
 * Database message format from /api/v1/history/:id endpoint
 */
export interface DBMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

/**
 * Session data returned from history API
 */
export interface SessionData {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  visibility: 'private' | 'public';
  messages: DBMessage[];
}

/**
 * Convert a single database message to AI SDK UIMessage format
 *
 * Note: UIMessage doesn't have a createdAt field - that's only in the DB.
 * The AI SDK manages message state internally without timestamps.
 */
export function convertToUIMessage(dbMessage: DBMessage): UIMessage {
  return {
    id: dbMessage.id,
    role: dbMessage.role,
    parts: [{ type: 'text' as const, text: dbMessage.content }],
  };
}

/**
 * Convert an array of database messages to AI SDK UIMessage format
 */
export function convertToUIMessages(dbMessages: DBMessage[]): UIMessage[] {
  return dbMessages.map(convertToUIMessage);
}
