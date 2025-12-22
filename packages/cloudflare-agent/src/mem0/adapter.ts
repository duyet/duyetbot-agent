/**
 * Mem0 Memory Adapter
 *
 * Implements MemoryAdapter using mem0.ai memory platform
 */

import type {
  LongTermMemoryEntry,
  MemoryAdapter,
  MemoryData,
  MemorySearchResult,
  SaveLongTermMemoryResult,
  SaveMemoryResult,
  SaveShortTermMemoryResult,
  SessionInfo,
  ShortTermMemoryEntry,
} from '../memory-adapter.js';
import { toMemoryMessage } from '../memory-adapter.js';
import type { Message } from '../types.js';
import type {
  Mem0AddMemoryRequest,
  Mem0AddMemoryResponse,
  Mem0Config,
  Mem0GetMemoriesRequest,
  Mem0Memory,
  Mem0SearchRequest,
} from './types.js';
import { MEM0_CATEGORY_MAP } from './types.js';

/**
 * Mem0 Memory Adapter implementation
 */
export class Mem0MemoryAdapter implements MemoryAdapter {
  private apiKey: string;
  private baseURL: string;
  private userId: string;
  private agentId: string | undefined;
  private timeout: number;

  constructor(config: Mem0Config) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL?.replace(/\/$/, '') ?? 'https://api.mem0.ai';
    this.userId = config.userId;
    this.agentId = config.agentId ?? undefined;
    this.timeout = config.timeout ?? 5000;
  }

  /**
   * Get messages for a session
   * Note: Mem0 doesn't have session concept, we use run_id as sessionId
   */
  async getMemory(
    sessionId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<MemoryData> {
    const request: Mem0GetMemoriesRequest = {
      filters: {
        user_id: this.userId,
        run_id: sessionId,
      },
      page: options?.offset ? Math.floor(options.offset / (options?.limit || 10)) + 1 : 1,
      page_size: options?.limit || 50,
    };

    const response = await this.request<{ results: Mem0Memory[] }>('/v1/memories/', {
      method: 'GET',
      params: {
        user_id: this.userId,
        run_id: sessionId,
        page: request.page,
        page_size: request.page_size,
      },
    });

    // Convert mem0 memories to messages
    const messages = response.results.map((mem) => ({
      role: 'assistant' as const,
      content: mem.memory,
      timestamp: new Date(mem.created_at).getTime(),
      ...(mem.metadata && { metadata: mem.metadata }),
    }));

    return {
      sessionId,
      messages,
      metadata: {},
    };
  }

  /**
   * Save messages for a session
   */
  async saveMemory(
    sessionId: string,
    messages: Message[],
    metadata?: Record<string, unknown>
  ): Promise<SaveMemoryResult> {
    const memoryMessages = messages.map(toMemoryMessage);

    // Convert to mem0 format
    const request: Mem0AddMemoryRequest = {
      messages: memoryMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      user_id: this.userId,
      run_id: sessionId,
      ...(this.agentId && { agent_id: this.agentId }),
      ...(metadata && { metadata }),
      infer: true, // Let mem0 automatically infer important memories
    };

    const response = await this.request<Mem0AddMemoryResponse>('/v1/memories/', {
      method: 'POST',
      body: request,
    });

    return {
      sessionId,
      savedCount: response.results.filter((r) => r.event === 'ADD' || r.event === 'UPDATE').length,
      updatedAt: Date.now(),
    };
  }

  /**
   * Search across memory using semantic search
   */
  async searchMemory(
    query: string,
    options?: {
      limit?: number;
      sessionId?: string;
    }
  ): Promise<MemorySearchResult[]> {
    const request: Mem0SearchRequest = {
      query,
      filters: {
        user_id: this.userId,
        ...(options?.sessionId && { run_id: options.sessionId }),
      },
      top_k: options?.limit || 10,
      rerank: true,
    };

    const response = await this.request<{ results: Array<Mem0Memory & { score: number }> }>(
      '/v1/memories/search/',
      {
        method: 'POST',
        body: request,
      }
    );

    return response.results.map((mem) => ({
      sessionId: mem.run_id ?? 'unknown',
      message: {
        role: 'assistant' as const,
        content: mem.memory,
        timestamp: new Date(mem.created_at).getTime(),
        ...(mem.metadata && { metadata: mem.metadata }),
      },
      score: mem.score,
      context: [],
    }));
  }

  /**
   * List all sessions
   * Note: Not directly supported by mem0, return empty
   */
  async listSessions(): Promise<{ sessions: SessionInfo[]; total: number }> {
    return { sessions: [], total: 0 };
  }

  /**
   * Save a short-term memory item (session-scoped, with TTL)
   * Note: Implemented using mem0 with expiration_date
   */
  async saveShortTermMemory(
    sessionId: string,
    key: string,
    value: string,
    ttlSeconds?: number
  ): Promise<SaveShortTermMemoryResult> {
    const expirationDate = ttlSeconds
      ? new Date(Date.now() + ttlSeconds * 1000).toISOString().split('T')[0]
      : undefined;

    const request: Mem0AddMemoryRequest = {
      messages: [{ role: 'system', content: `${key}: ${value}` }],
      user_id: this.userId,
      run_id: sessionId,
      ...(this.agentId && { agent_id: this.agentId }),
      metadata: { type: 'short_term', key },
      categories: ['short_term_memory'],
      ...(expirationDate && { expiration_date: expirationDate }),
      infer: false,
    };

    await this.request<Mem0AddMemoryResponse>('/v1/memories/', {
      method: 'POST',
      body: request,
    });

    return {
      key,
      expiresAt: expirationDate ? new Date(expirationDate).getTime() : Date.now() + 86400000,
      success: true,
    };
  }

  /**
   * Get a short-term memory item by key
   */
  async getShortTermMemory(sessionId: string, key: string): Promise<ShortTermMemoryEntry | null> {
    const request: Mem0SearchRequest = {
      query: key,
      filters: {
        user_id: this.userId,
        run_id: sessionId,
        categories: { in: ['short_term_memory'] },
      },
      top_k: 1,
    };

    const response = await this.request<{ results: Mem0Memory[] }>('/v1/memories/search/', {
      method: 'POST',
      body: request,
    });

    if (response.results.length === 0) {
      return null;
    }

    const memory = response.results[0];
    if (!memory) {
      return null;
    }

    const expiresAt = memory.expiration_date
      ? new Date(memory.expiration_date).getTime()
      : Date.now() + 86400000;

    return {
      key,
      value: memory.memory,
      expiresAt,
    };
  }

  /**
   * List all short-term memory items for a session
   */
  async listShortTermMemory(sessionId: string): Promise<ShortTermMemoryEntry[]> {
    const response = await this.request<{ results: Mem0Memory[] }>('/v1/memories/', {
      method: 'GET',
      params: {
        user_id: this.userId,
        run_id: sessionId,
      },
    });

    return response.results
      .filter((mem) => mem.categories?.includes('short_term_memory'))
      .map((mem) => ({
        key: (mem.metadata?.key as string) || mem.id,
        value: mem.memory,
        expiresAt: mem.expiration_date
          ? new Date(mem.expiration_date).getTime()
          : Date.now() + 86400000,
      }));
  }

  /**
   * Delete a short-term memory item
   */
  async deleteShortTermMemory(sessionId: string, key: string): Promise<boolean> {
    // First find the memory
    const memory = await this.getShortTermMemory(sessionId, key);
    if (!memory) {
      return false;
    }

    // Search to get the ID
    const request: Mem0SearchRequest = {
      query: key,
      filters: {
        user_id: this.userId,
        run_id: sessionId,
        categories: { in: ['short_term_memory'] },
      },
      top_k: 1,
    };

    const response = await this.request<{ results: Mem0Memory[] }>('/v1/memories/search/', {
      method: 'POST',
      body: request,
    });

    if (response.results.length === 0) {
      return false;
    }

    // Delete the memory
    const memoryToDelete = response.results[0];
    if (!memoryToDelete) {
      return false;
    }

    await this.request(`/v1/memories/${memoryToDelete.id}/`, {
      method: 'DELETE',
    });

    return true;
  }

  /**
   * Save a long-term memory item (persistent)
   */
  async saveLongTermMemory(
    category: 'fact' | 'preference' | 'pattern' | 'decision' | 'note',
    key: string,
    value: string,
    importance?: number,
    metadata?: Record<string, unknown>
  ): Promise<SaveLongTermMemoryResult> {
    const mem0Category = MEM0_CATEGORY_MAP[category];

    const request: Mem0AddMemoryRequest = {
      messages: [{ role: 'system', content: `${key}: ${value}` }],
      user_id: this.userId,
      ...(this.agentId && { agent_id: this.agentId }),
      metadata: {
        type: 'long_term',
        category,
        key,
        importance: importance ?? 0.5,
        ...metadata,
      },
      categories: [mem0Category],
      infer: false,
    };

    const response = await this.request<Mem0AddMemoryResponse>('/v1/memories/', {
      method: 'POST',
      body: request,
    });

    const result = response.results[0];
    if (!result) {
      throw new Mem0AdapterError('No result returned from memory creation', 500, '/v1/memories/');
    }

    return {
      id: result.id,
      created: result.event === 'ADD',
      success: true,
    };
  }

  /**
   * Get long-term memory items by category and/or key
   */
  async getLongTermMemory(filters?: {
    category?: 'fact' | 'preference' | 'pattern' | 'decision' | 'note';
    key?: string;
    limit?: number;
  }): Promise<LongTermMemoryEntry[]> {
    const response = await this.request<{ results: Mem0Memory[] }>('/v1/memories/', {
      method: 'GET',
      params: {
        user_id: this.userId,
        ...(filters?.limit && { page_size: filters.limit }),
      },
    });

    let results = response.results.filter((mem) =>
      mem.categories?.some((cat) => Object.values(MEM0_CATEGORY_MAP).includes(cat as any))
    );

    // Filter by key if provided
    if (filters?.key) {
      results = results.filter((mem) => mem.metadata?.key === filters.key);
    }

    return results.map((mem) => ({
      id: mem.id,
      category: this.getMappedCategory(mem.categories?.[0]),
      key: (mem.metadata?.key as string) ?? mem.id,
      value: mem.memory,
      importance: (mem.metadata?.importance as number) ?? 0.5,
      createdAt: new Date(mem.created_at).getTime(),
      updatedAt: new Date(mem.updated_at).getTime(),
    }));
  }

  /**
   * Update a long-term memory item
   */
  async updateLongTermMemory(
    id: string,
    updates: {
      value?: string;
      importance?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<boolean> {
    const request: Partial<Mem0Memory> = {
      ...(updates.value && { memory: updates.value }),
      ...(updates.metadata && {
        metadata: {
          ...updates.metadata,
          ...(updates.importance !== undefined && { importance: updates.importance }),
        },
      }),
    };

    await this.request(`/v1/memories/${id}/`, {
      method: 'PATCH',
      body: request,
    });

    return true;
  }

  /**
   * Delete a long-term memory item
   */
  async deleteLongTermMemory(id: string): Promise<boolean> {
    await this.request(`/v1/memories/${id}/`, {
      method: 'DELETE',
    });

    return true;
  }

  /**
   * Search memory using natural language query
   */
  async searchMemoryByQuery(
    query: string,
    filters?: {
      categories?: string[];
      limit?: number;
    }
  ): Promise<Array<{ id: string; content: string; category: string; score: number }>> {
    const mem0Categories = filters?.categories
      ?.map((cat) => MEM0_CATEGORY_MAP[cat as keyof typeof MEM0_CATEGORY_MAP])
      .filter(Boolean);

    const request: Mem0SearchRequest = {
      query,
      filters: {
        user_id: this.userId,
        ...(mem0Categories &&
          mem0Categories.length > 0 && {
            categories: { in: mem0Categories },
          }),
      },
      top_k: filters?.limit || 10,
      rerank: true,
    };

    const response = await this.request<{ results: Array<Mem0Memory & { score: number }> }>(
      '/v1/memories/search/',
      {
        method: 'POST',
        body: request,
      }
    );

    return response.results.map((mem) => ({
      id: mem.id,
      content: mem.memory,
      category: this.getMappedCategory(mem.categories?.[0]) ?? 'note',
      score: mem.score,
    }));
  }

  /**
   * Map mem0 category to duyetbot category
   */
  private getMappedCategory(
    mem0Category?: string
  ): 'fact' | 'preference' | 'pattern' | 'decision' | 'note' {
    for (const [key, value] of Object.entries(MEM0_CATEGORY_MAP)) {
      if (value === mem0Category) {
        return key as 'fact' | 'preference' | 'pattern' | 'decision' | 'note';
      }
    }
    return 'note';
  }

  /**
   * Make a request to the Mem0 API
   */
  private async request<T>(
    path: string,
    options: {
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
      body?: unknown;
      params?: Record<string, unknown>;
    }
  ): Promise<T> {
    const { method, body, params } = options;

    const url = new URL(`${this.baseURL}${path}`);
    if (params && typeof params === 'object') {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Token ${this.apiKey}`,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (body) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url.toString(), fetchOptions);

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Mem0AdapterError(
          errorData.detail || `Request failed with status ${response.status}`,
          response.status,
          path
        );
      }

      // DELETE requests may not return a body
      if (method === 'DELETE') {
        return {} as T;
      }

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Mem0AdapterError) {
        throw err;
      }
      throw new Mem0AdapterError(err instanceof Error ? err.message : 'Request failed', 0, path);
    }
  }
}

/**
 * Error thrown by Mem0 memory adapter
 */
export class Mem0AdapterError extends Error {
  public statusCode: number;
  public path: string;

  constructor(message: string, statusCode: number, path: string) {
    super(message);
    this.name = 'Mem0AdapterError';
    this.statusCode = statusCode;
    this.path = path;
  }
}

/**
 * Create a Mem0 memory adapter
 */
export function createMem0MemoryAdapter(config: Mem0Config): Mem0MemoryAdapter {
  return new Mem0MemoryAdapter(config);
}
