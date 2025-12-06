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
import type { Message } from './types.js';
/**
 * Interface for the Memory Service RPC binding
 */
export interface MemoryServiceBinding {
  getMemory(
    userId: string,
    sessionId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
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
  ): Promise<{
    sessions: SessionInfo[];
    total: number;
  }>;
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
export declare class ServiceBindingMemoryAdapter implements MemoryAdapter {
  private service;
  private userId;
  constructor(config: ServiceBindingMemoryAdapterConfig);
  /**
   * Get messages for a session
   */
  getMemory(
    sessionId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<MemoryData>;
  /**
   * Save messages to a session
   */
  saveMemory(
    sessionId: string,
    messages: Message[],
    metadata?: Record<string, unknown>
  ): Promise<SaveMemoryResult>;
  /**
   * Search across messages
   */
  searchMemory(
    query: string,
    options?: {
      limit?: number;
      sessionId?: string;
    }
  ): Promise<MemorySearchResult[]>;
  /**
   * List sessions
   */
  listSessions(options?: {
    limit?: number;
    offset?: number;
    state?: 'active' | 'paused' | 'completed';
  }): Promise<{
    sessions: SessionInfo[];
    total: number;
  }>;
}
/**
 * Create a service binding memory adapter
 */
export declare function createServiceBindingMemoryAdapter(
  config: ServiceBindingMemoryAdapterConfig
): ServiceBindingMemoryAdapter;
//# sourceMappingURL=service-binding-adapter.d.ts.map
