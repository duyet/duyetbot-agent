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
 * Short-term memory entry
 */
export interface ShortTermMemoryEntry {
  key: string;
  value: string;
  expiresAt: number;
}

/**
 * Long-term memory entry
 */
export interface LongTermMemoryEntry {
  id: string;
  category: 'fact' | 'preference' | 'pattern' | 'decision' | 'note';
  key: string;
  value: string;
  importance: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Result from short-term memory save
 */
export interface SaveShortTermMemoryResult {
  key: string;
  expiresAt: number;
  success: boolean;
}

/**
 * Result from long-term memory save
 */
export interface SaveLongTermMemoryResult {
  id: string;
  created: boolean;
  success: boolean;
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

  /**
   * Save a short-term memory item (session-scoped, with TTL)
   */
  saveShortTermMemory?(
    sessionId: string,
    key: string,
    value: string,
    ttlSeconds?: number
  ): Promise<SaveShortTermMemoryResult>;

  /**
   * Get a short-term memory item by key
   */
  getShortTermMemory?(sessionId: string, key: string): Promise<ShortTermMemoryEntry | null>;

  /**
   * List all short-term memory items for a session
   */
  listShortTermMemory?(sessionId: string): Promise<ShortTermMemoryEntry[]>;

  /**
   * Delete a short-term memory item
   */
  deleteShortTermMemory?(sessionId: string, key: string): Promise<boolean>;

  /**
   * Save a long-term memory item (persistent)
   */
  saveLongTermMemory?(
    category: 'fact' | 'preference' | 'pattern' | 'decision' | 'note',
    key: string,
    value: string,
    importance?: number,
    metadata?: Record<string, unknown>
  ): Promise<SaveLongTermMemoryResult>;

  /**
   * Get long-term memory items by category and/or key
   */
  getLongTermMemory?(filters?: {
    category?: 'fact' | 'preference' | 'pattern' | 'decision' | 'note';
    key?: string;
    limit?: number;
  }): Promise<LongTermMemoryEntry[]>;

  /**
   * Update a long-term memory item
   */
  updateLongTermMemory?(
    id: string,
    updates: {
      value?: string;
      importance?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<boolean>;

  /**
   * Delete a long-term memory item
   */
  deleteLongTermMemory?(id: string): Promise<boolean>;

  /**
   * Search memory using natural language query
   */
  searchMemoryByQuery?(
    query: string,
    filters?: {
      categories?: string[];
      limit?: number;
    }
  ): Promise<Array<{ id: string; content: string; category: string; score: number }>>;
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
