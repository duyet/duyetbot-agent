/**
 * MCP Memory Adapter
 *
 * Implements MemoryAdapter using the duyetbot memory MCP server
 */
import type {
  MemoryAdapter,
  MemoryData,
  MemorySearchResult,
  SaveMemoryResult,
  SessionInfo,
} from './memory-adapter.js';
import { fromMemoryMessage } from './memory-adapter.js';
import type { Message } from './types.js';
/**
 * Configuration for MCP Memory Adapter
 */
export interface MCPMemoryAdapterConfig {
  /** Base URL of the memory MCP server */
  baseURL: string;
  /** Bearer token for authentication */
  token?: string | undefined;
}
/**
 * MCP Memory Adapter implementation
 */
export declare class MCPMemoryAdapter implements MemoryAdapter {
  private baseURL;
  private token;
  constructor(config: MCPMemoryAdapterConfig);
  /**
   * Set authentication token
   */
  setToken(token: string): void;
  /**
   * Authenticate with GitHub token and get session token
   */
  authenticate(githubToken: string): Promise<{
    userId: string;
    sessionToken: string;
    expiresAt: number;
  }>;
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
  searchMemory(
    query: string,
    options?: {
      limit?: number;
      sessionId?: string;
    }
  ): Promise<MemorySearchResult[]>;
  /**
   * List all sessions
   */
  listSessions(options?: {
    limit?: number;
    offset?: number;
    state?: 'active' | 'paused' | 'completed';
  }): Promise<{
    sessions: SessionInfo[];
    total: number;
  }>;
  /**
   * Make a request to the MCP server
   */
  private request;
}
/**
 * Error thrown by MCP memory adapter
 */
export declare class MCPMemoryAdapterError extends Error {
  statusCode: number;
  path: string;
  constructor(message: string, statusCode: number, path: string);
}
/**
 * Create an MCP memory adapter
 */
export declare function createMCPMemoryAdapter(config: MCPMemoryAdapterConfig): MCPMemoryAdapter;
/**
 * Default memory MCP server URL
 */
export declare const DEFAULT_MEMORY_MCP_URL = 'https://duyetbot-memory.duyet.workers.dev';
/**
 * Resilient MCP Memory Adapter with graceful degradation
 *
 * This adapter wraps MCPMemoryAdapter and provides:
 * - Health checking with timeout
 * - Availability caching
 * - Silent failure mode (returns empty data instead of throwing)
 */
export declare class ResilientMCPMemoryAdapter implements MemoryAdapter {
  private adapter;
  private baseURL;
  private isAvailable;
  private lastCheck;
  private checkInterval;
  private initTimeout;
  constructor(
    config: MCPMemoryAdapterConfig & {
      initTimeout?: number;
    }
  );
  /**
   * Check if MCP server is available (with caching)
   */
  private checkAvailability;
  getMemory(
    sessionId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<MemoryData>;
  saveMemory(
    sessionId: string,
    messages: Message[],
    metadata?: Record<string, unknown>
  ): Promise<SaveMemoryResult>;
  searchMemory(
    query: string,
    options?: {
      limit?: number;
      sessionId?: string;
    }
  ): Promise<MemorySearchResult[]>;
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
 * Create a resilient MCP memory adapter with graceful degradation
 */
export declare function createResilientMCPMemoryAdapter(
  config: MCPMemoryAdapterConfig
): ResilientMCPMemoryAdapter;
export { fromMemoryMessage };
//# sourceMappingURL=mcp-memory-adapter.d.ts.map
