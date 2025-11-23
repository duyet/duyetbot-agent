/**
 * Memory Adapter Interface
 *
 * Provides abstraction for memory persistence in ChatAgent
 */

import type { Message } from './types.js';

/**
 * Memory message format for storage
 */
export interface MemoryMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Memory data returned from storage
 */
export interface MemoryData {
  sessionId: string;
  messages: MemoryMessage[];
  metadata?: Record<string, unknown>;
}

/**
 * Result from saving memory
 */
export interface SaveMemoryResult {
  sessionId: string;
  savedCount: number;
  updatedAt: number;
}

/**
 * Search result from memory
 */
export interface MemorySearchResult {
  sessionId: string;
  message: MemoryMessage;
  score: number;
  context?: MemoryMessage[];
}

/**
 * Session info
 */
export interface SessionInfo {
  id: string;
  title: string | null;
  state: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

/**
 * Memory adapter interface for ChatAgent persistence
 */
export interface MemoryAdapter {
  /**
   * Get messages for a session
   */
  getMemory(sessionId: string, options?: { limit?: number; offset?: number }): Promise<MemoryData>;

  /**
   * Save messages for a session
   */
  saveMemory(
    sessionId: string,
    messages: Message[],
    metadata?: Record<string, unknown>
  ): Promise<SaveMemoryResult>;

  /**
   * Search across memory
   */
  searchMemory?(
    query: string,
    options?: {
      limit?: number;
      sessionId?: string;
    }
  ): Promise<MemorySearchResult[]>;

  /**
   * List all sessions
   */
  listSessions?(options?: {
    limit?: number;
    offset?: number;
    state?: 'active' | 'paused' | 'completed';
  }): Promise<{ sessions: SessionInfo[]; total: number }>;
}

/**
 * Convert internal Message to MemoryMessage format
 */
export function toMemoryMessage(message: Message): MemoryMessage {
  const memoryMessage: MemoryMessage = {
    role: message.role,
    content: message.content,
    timestamp: Date.now(),
  };

  if (message.toolCallId) {
    memoryMessage.metadata = {
      toolCallId: message.toolCallId,
      ...(message.name && { name: message.name }),
    };
  }

  return memoryMessage;
}

/**
 * Convert MemoryMessage to internal Message format
 */
export function fromMemoryMessage(memoryMessage: MemoryMessage): Message {
  const message: Message = {
    role: memoryMessage.role,
    content: memoryMessage.content,
  };

  if (memoryMessage.metadata?.toolCallId) {
    message.toolCallId = memoryMessage.metadata.toolCallId as string;
  }
  if (memoryMessage.metadata?.name) {
    message.name = memoryMessage.metadata.name as string;
  }

  return message;
}
