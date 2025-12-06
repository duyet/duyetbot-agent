/**
 * Service Binding Memory Adapter
 *
 * Uses Cloudflare Service Bindings for fast, non-blocking memory operations.
 * No HTTP overhead - direct RPC calls within the same datacenter.
 */

import type {
  MemoryAdapter,
  MemoryData,
  MemorySearchResult,
  SaveMemoryResult,
  SessionInfo,
} from './memory-adapter.js';
import { toMemoryMessage } from './memory-adapter.js';
import type { Message } from './types.js';

/**
 * Interface for the Memory Service RPC binding
 */
export interface MemoryServiceBinding {
  getMemory(
    userId: string,
    sessionId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<MemoryData>;

  saveMemory(
    userId: string,
    sessionId: string | undefined,
    messages: Array<{
      role: 'user' | 'assistant' | 'system' | 'tool';
      content: string;
      timestamp?: number;
      metadata?: Record<string, unknown>;
    }>,
    metadata?: Record<string, unknown>
  ): Promise<SaveMemoryResult>;

  searchMemory(
    userId: string,
    query: string,
    options?: {
      limit?: number;
      sessionId?: string;
    }
  ): Promise<MemorySearchResult[]>;

  listSessions(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      state?: 'active' | 'paused' | 'completed';
    }
  ): Promise<{ sessions: SessionInfo[]; total: number }>;
}

/**
 * Configuration for ServiceBindingMemoryAdapter
 */
export interface ServiceBindingMemoryAdapterConfig {
  /** Service binding from env */
  service: MemoryServiceBinding;
  /** User ID for authentication */
  userId: string;
}

/**
 * Memory adapter using Cloudflare Service Bindings
 *
 * This adapter provides:
 * - Sub-millisecond latency (no network overhead)
 * - Non-blocking operations (no blockConcurrencyWhile issues)
 * - Direct RPC calls to the memory service
 */
export class ServiceBindingMemoryAdapter implements MemoryAdapter {
  private service: MemoryServiceBinding;
  private userId: string;

  constructor(config: ServiceBindingMemoryAdapterConfig) {
    this.service = config.service;
    this.userId = config.userId;
  }

  /**
   * Get messages for a session
   */
  async getMemory(
    sessionId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<MemoryData> {
    try {
      return await this.service.getMemory(this.userId, sessionId, options);
    } catch (err) {
      console.warn('ServiceBinding getMemory failed:', err);
      return { sessionId, messages: [], metadata: {} };
    }
  }

  /**
   * Save messages to a session
   */
  async saveMemory(
    sessionId: string,
    messages: Message[],
    metadata?: Record<string, unknown>
  ): Promise<SaveMemoryResult> {
    try {
      const memoryMessages = messages.map(toMemoryMessage);
      return await this.service.saveMemory(this.userId, sessionId, memoryMessages, metadata);
    } catch (err) {
      console.warn('ServiceBinding saveMemory failed:', err);
      return { sessionId, savedCount: 0, updatedAt: Date.now() };
    }
  }

  /**
   * Search across messages
   */
  async searchMemory(
    query: string,
    options?: {
      limit?: number;
      sessionId?: string;
    }
  ): Promise<MemorySearchResult[]> {
    try {
      return await this.service.searchMemory(this.userId, query, options);
    } catch (err) {
      console.warn('ServiceBinding searchMemory failed:', err);
      return [];
    }
  }

  /**
   * List sessions
   */
  async listSessions(options?: {
    limit?: number;
    offset?: number;
    state?: 'active' | 'paused' | 'completed';
  }): Promise<{ sessions: SessionInfo[]; total: number }> {
    try {
      return await this.service.listSessions(this.userId, options);
    } catch (err) {
      console.warn('ServiceBinding listSessions failed:', err);
      return { sessions: [], total: 0 };
    }
  }
}

/**
 * Create a service binding memory adapter
 */
export function createServiceBindingMemoryAdapter(
  config: ServiceBindingMemoryAdapterConfig
): ServiceBindingMemoryAdapter {
  return new ServiceBindingMemoryAdapter(config);
}
