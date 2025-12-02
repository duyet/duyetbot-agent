/**
 * Session Types and Interfaces
 *
 * Defines types for session management and persistence
 */

import type { LLMMessage } from './provider.js';

/**
 * Session state
 */
export type SessionState = 'active' | 'paused' | 'completed' | 'expired';

/**
 * Session metadata
 */
export interface SessionMetadata {
  /**
   * Session title/description
   */
  title?: string;

  /**
   * User ID
   */
  userId?: string;

  /**
   * Tags for categorization
   */
  tags?: string[];

  /**
   * Custom metadata
   */
  [key: string]: unknown;
}

/**
 * Session data
 */
export interface Session {
  /**
   * Unique session identifier
   */
  id: string;

  /**
   * Session state
   */
  state: SessionState;

  /**
   * Conversation messages
   */
  messages: LLMMessage[];

  /**
   * Session metadata
   */
  metadata: SessionMetadata;

  /**
   * Creation timestamp
   */
  createdAt: number;

  /**
   * Last updated timestamp
   */
  updatedAt: number;

  /**
   * Expiration timestamp (optional)
   */
  expiresAt?: number;
}

/**
 * Session storage interface
 */
export interface SessionStorage {
  /**
   * Get session by ID
   */
  get(sessionId: string): Promise<Session | null>;

  /**
   * Save session
   */
  save(session: Session): Promise<void>;

  /**
   * Delete session
   */
  delete(sessionId: string): Promise<void>;

  /**
   * List sessions
   */
  list(options?: {
    userId?: string;
    state?: SessionState;
    limit?: number;
    offset?: number;
  }): Promise<Session[]>;

  /**
   * Update session state
   */
  updateState(sessionId: string, state: SessionState): Promise<void>;

  /**
   * Add messages to session
   */
  addMessages(sessionId: string, messages: LLMMessage[]): Promise<void>;
}

/**
 * Session manager interface
 */
export interface SessionManager {
  /**
   * Create new session
   */
  create(metadata?: SessionMetadata): Promise<Session>;

  /**
   * Load existing session
   */
  load(sessionId: string): Promise<Session | null>;

  /**
   * Update session
   */
  update(session: Session): Promise<void>;

  /**
   * Close session
   */
  close(sessionId: string): Promise<void>;

  /**
   * Clean up expired sessions
   */
  cleanup(): Promise<number>;
}

/**
 * Session configuration
 */
export interface SessionConfig {
  /**
   * Storage implementation
   */
  storage: SessionStorage;

  /**
   * Session TTL in milliseconds
   */
  ttl?: number;

  /**
   * Maximum messages per session
   */
  maxMessages?: number;

  /**
   * Auto-save interval in milliseconds
   */
  autoSaveInterval?: number;
}
