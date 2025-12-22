/**
 * Mem0.ai API Types
 *
 * Type definitions for the mem0.ai memory service API
 */

/**
 * Configuration for mem0.ai client
 */
export interface Mem0Config {
  /** Mem0.ai API key */
  apiKey: string;
  /** Base URL for API (default: https://api.mem0.ai) */
  baseURL?: string;
  /** User ID for memory operations */
  userId: string;
  /** Optional agent ID for scoping memories */
  agentId?: string;
  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number;
}

/**
 * Memory object from mem0.ai
 */
export interface Mem0Memory {
  /** Unique memory ID */
  id: string;
  /** Memory content */
  memory: string;
  /** User ID this memory belongs to */
  user_id: string;
  /** Optional agent ID */
  agent_id?: string;
  /** Optional run ID for conversation tracking */
  run_id?: string;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Memory categories */
  categories?: string[];
  /** Whether memory is immutable */
  immutable?: boolean;
  /** Optional expiration date */
  expiration_date?: string | null;
}

/**
 * Request for adding memory
 */
export interface Mem0AddMemoryRequest {
  /** Messages to extract memory from */
  messages: Array<{ role: string; content: string }>;
  /** User ID */
  user_id: string;
  /** Optional run ID for conversation tracking */
  run_id?: string;
  /** Optional agent ID */
  agent_id?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Memory categories */
  categories?: string[];
  /** Custom category mappings */
  custom_categories?: Record<string, string>;
  /** Optional expiration date (YYYY-MM-DD format) */
  expiration_date?: string;
  /** Whether to infer memories automatically */
  infer?: boolean;
}

/**
 * Response from adding memory
 */
export interface Mem0AddMemoryResponse {
  /** Results of memory operations */
  results: Array<{
    /** Memory ID */
    id: string;
    /** Event type */
    event: 'ADD' | 'UPDATE' | 'DELETE' | 'NOOP';
    /** Memory data */
    data: { memory: string };
  }>;
}

/**
 * Request for searching memory
 */
export interface Mem0SearchRequest {
  /** Search query */
  query: string;
  /** Search filters */
  filters: {
    /** AND conditions */
    AND?: Record<string, unknown>[];
    /** OR conditions */
    OR?: Record<string, unknown>[];
    /** Filter by user ID */
    user_id?: string;
    /** Filter by run ID */
    run_id?: string;
    /** Filter by categories */
    categories?: { in: string[] };
  };
  /** API version */
  version?: string;
  /** Number of results to return */
  top_k?: number;
  /** Score threshold */
  threshold?: number;
  /** Whether to rerank results */
  rerank?: boolean;
}

/**
 * Request for getting memories
 */
export interface Mem0GetMemoriesRequest {
  /** Filters for memory retrieval */
  filters: {
    /** AND conditions */
    AND?: Record<string, unknown>[];
    /** Filter by user ID */
    user_id?: string;
    /** Filter by run ID */
    run_id?: string;
  };
  /** Page number */
  page?: number;
  /** Page size */
  page_size?: number;
}

/**
 * Category mapping from duyetbot to mem0
 */
export const MEM0_CATEGORY_MAP = {
  fact: 'user_facts',
  preference: 'user_preferences',
  pattern: 'behavior_patterns',
  decision: 'decisions',
  note: 'general_notes',
} as const;

/**
 * Duyetbot category type
 */
export type DuyetbotCategory = keyof typeof MEM0_CATEGORY_MAP;

/**
 * Mem0 category type
 */
export type Mem0Category = (typeof MEM0_CATEGORY_MAP)[DuyetbotCategory];
