/**
 * MCP Memory Adapter
 *
 * Implements MemoryAdapter using the duyetbot memory MCP server
 */
import { fromMemoryMessage, toMemoryMessage } from './memory-adapter.js';
/**
 * MCP Memory Adapter implementation
 */
export class MCPMemoryAdapter {
  baseURL;
  token;
  constructor(config) {
    this.baseURL = config.baseURL.replace(/\/$/, '');
    this.token = config.token;
  }
  /**
   * Set authentication token
   */
  setToken(token) {
    this.token = token;
  }
  /**
   * Authenticate with GitHub token and get session token
   */
  async authenticate(githubToken) {
    const response = await this.request('/api/authenticate', {
      method: 'POST',
      body: { github_token: githubToken },
      auth: false,
    });
    const result = response;
    this.token = result.session_token;
    return {
      userId: result.user_id,
      sessionToken: result.session_token,
      expiresAt: result.expires_at,
    };
  }
  /**
   * Get messages for a session
   */
  async getMemory(sessionId, options) {
    const response = await this.request('/api/memory/get', {
      method: 'POST',
      body: {
        session_id: sessionId,
        ...options,
      },
    });
    return {
      sessionId: response.session_id,
      messages: response.messages,
      metadata: response.metadata,
    };
  }
  /**
   * Save messages for a session
   */
  async saveMemory(sessionId, messages, metadata) {
    const memoryMessages = messages.map(toMemoryMessage);
    const response = await this.request('/api/memory/save', {
      method: 'POST',
      body: {
        session_id: sessionId,
        messages: memoryMessages,
        metadata,
      },
    });
    return {
      sessionId: response.session_id,
      savedCount: response.saved_count,
      updatedAt: response.updated_at,
    };
  }
  /**
   * Search across memory
   */
  async searchMemory(query, options) {
    const response = await this.request('/api/memory/search', {
      method: 'POST',
      body: {
        query,
        limit: options?.limit,
        filter: options?.sessionId ? { session_id: options.sessionId } : undefined,
      },
    });
    return response.results.map((r) => ({
      sessionId: r.session_id,
      message: r.message,
      score: r.score,
      context: r.context,
    }));
  }
  /**
   * List all sessions
   */
  async listSessions(options) {
    const response = await this.request('/api/sessions/list', {
      method: 'POST',
      body: options || {},
    });
    return {
      sessions: response.sessions.map((s) => ({
        id: s.id,
        title: s.title,
        state: s.state,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        messageCount: s.message_count,
      })),
      total: response.total,
    };
  }
  /**
   * Make a request to the MCP server
   */
  async request(path, options) {
    const { method, body, auth = true } = options;
    const headers = {
      'Content-Type': 'application/json',
    };
    if (auth && this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    const fetchOptions = {
      method,
      headers,
    };
    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }
    const response = await fetch(`${this.baseURL}${path}`, fetchOptions);
    const data = await response.json();
    if (!response.ok) {
      throw new MCPMemoryAdapterError(data.error || 'Request failed', response.status, path);
    }
    return data;
  }
}
/**
 * Error thrown by MCP memory adapter
 */
export class MCPMemoryAdapterError extends Error {
  statusCode;
  path;
  constructor(message, statusCode, path) {
    super(message);
    this.name = 'MCPMemoryAdapterError';
    this.statusCode = statusCode;
    this.path = path;
  }
}
/**
 * Create an MCP memory adapter
 */
export function createMCPMemoryAdapter(config) {
  return new MCPMemoryAdapter(config);
}
/**
 * Default memory MCP server URL
 */
export const DEFAULT_MEMORY_MCP_URL = 'https://duyetbot-memory.duyet.workers.dev';
/**
 * Resilient MCP Memory Adapter with graceful degradation
 *
 * This adapter wraps MCPMemoryAdapter and provides:
 * - Health checking with timeout
 * - Availability caching
 * - Silent failure mode (returns empty data instead of throwing)
 */
export class ResilientMCPMemoryAdapter {
  adapter;
  baseURL;
  isAvailable = true;
  lastCheck = 0;
  checkInterval = 60000; // 1 minute
  initTimeout;
  constructor(config) {
    this.adapter = new MCPMemoryAdapter(config);
    this.baseURL = config.baseURL.replace(/\/$/, '');
    this.initTimeout = config.initTimeout ?? 2000; // 2s default for fast init
  }
  /**
   * Check if MCP server is available (with caching)
   */
  async checkAvailability() {
    const now = Date.now();
    if (now - this.lastCheck < this.checkInterval) {
      return this.isAvailable;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.initTimeout);
      // Try a simple request to check availability
      const response = await fetch(`${this.baseURL}/api/sessions/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 1 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      this.isAvailable = response.ok || response.status === 401; // 401 means server is up but needs auth
    } catch {
      this.isAvailable = false;
    }
    this.lastCheck = now;
    return this.isAvailable;
  }
  async getMemory(sessionId, options) {
    if (!(await this.checkAvailability())) {
      return { sessionId, messages: [], metadata: {} };
    }
    try {
      return await this.adapter.getMemory(sessionId, options);
    } catch (err) {
      console.warn('Memory getMemory failed:', err);
      return { sessionId, messages: [], metadata: {} };
    }
  }
  async saveMemory(sessionId, messages, metadata) {
    if (!(await this.checkAvailability())) {
      return { sessionId, savedCount: 0, updatedAt: Date.now() };
    }
    try {
      return await this.adapter.saveMemory(sessionId, messages, metadata);
    } catch (err) {
      console.warn('Memory saveMemory failed:', err);
      return { sessionId, savedCount: 0, updatedAt: Date.now() };
    }
  }
  async searchMemory(query, options) {
    if (!(await this.checkAvailability())) {
      return [];
    }
    try {
      return await this.adapter.searchMemory(query, options);
    } catch (err) {
      console.warn('Memory searchMemory failed:', err);
      return [];
    }
  }
  async listSessions(options) {
    if (!(await this.checkAvailability())) {
      return { sessions: [], total: 0 };
    }
    try {
      return await this.adapter.listSessions(options);
    } catch (err) {
      console.warn('Memory listSessions failed:', err);
      return { sessions: [], total: 0 };
    }
  }
}
/**
 * Create a resilient MCP memory adapter with graceful degradation
 */
export function createResilientMCPMemoryAdapter(config) {
  return new ResilientMCPMemoryAdapter(config);
}
// Re-export helper for converting messages
export { fromMemoryMessage };
