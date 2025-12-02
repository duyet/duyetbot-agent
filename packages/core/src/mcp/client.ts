/**
 * MCP Memory Client
 *
 * Client for connecting to the duyetbot memory MCP server
 * Provides session persistence and memory retrieval
 */

export interface MCPClientConfig {
  baseURL: string;
  token?: string;
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryData {
  session_id: string;
  messages: LLMMessage[];
  metadata: Record<string, unknown>;
}

export interface SaveMemoryResult {
  session_id: string;
  saved_count: number;
  updated_at: number;
}

export interface SearchResult {
  session_id: string;
  message: LLMMessage;
  score: number;
  context: LLMMessage[];
}

export interface SessionListItem {
  id: string;
  title: string | null;
  state: string;
  created_at: number;
  updated_at: number;
  message_count: number;
}

export interface AuthResult {
  user_id: string;
  session_token: string;
  expires_at: number;
}

/**
 * MCP Memory Client for interacting with the memory server
 */
export class MCPMemoryClient {
  private baseURL: string;
  private token?: string;

  constructor(config: MCPClientConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, '');
    if (config.token) {
      this.token = config.token;
    }
  }

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * Authenticate with GitHub token
   */
  async authenticate(githubToken: string): Promise<AuthResult> {
    const response = await this.request('/api/authenticate', {
      method: 'POST',
      body: { github_token: githubToken },
      auth: false,
    });

    const result = response as AuthResult;
    this.token = result.session_token;
    return result;
  }

  /**
   * Get memory for a session
   */
  async getMemory(
    sessionId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<MemoryData> {
    return this.request('/api/memory/get', {
      method: 'POST',
      body: {
        session_id: sessionId,
        ...options,
      },
    }) as Promise<MemoryData>;
  }

  /**
   * Save memory for a session
   */
  async saveMemory(
    messages: LLMMessage[],
    options?: { session_id?: string; metadata?: Record<string, unknown> }
  ): Promise<SaveMemoryResult> {
    return this.request('/api/memory/save', {
      method: 'POST',
      body: {
        messages,
        ...options,
      },
    }) as Promise<SaveMemoryResult>;
  }

  /**
   * Search memory across sessions
   */
  async searchMemory(
    query: string,
    options?: {
      limit?: number;
      filter?: {
        session_id?: string;
        date_range?: { start: number; end: number };
      };
    }
  ): Promise<{ results: SearchResult[] }> {
    return this.request('/api/memory/search', {
      method: 'POST',
      body: {
        query,
        ...options,
      },
    }) as Promise<{ results: SearchResult[] }>;
  }

  /**
   * List sessions
   */
  async listSessions(options?: {
    limit?: number;
    offset?: number;
    state?: 'active' | 'paused' | 'completed';
  }): Promise<{ sessions: SessionListItem[]; total: number }> {
    return this.request('/api/sessions/list', {
      method: 'POST',
      body: options || {},
    }) as Promise<{ sessions: SessionListItem[]; total: number }>;
  }

  /**
   * Make a request to the MCP server
   */
  private async request(
    path: string,
    options: {
      method: 'GET' | 'POST';
      body?: unknown;
      auth?: boolean;
    }
  ): Promise<unknown> {
    const { method, body, auth = true } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (auth && this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseURL}${path}`, fetchOptions);

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw new MCPClientError((data.error as string) || 'Request failed', response.status, path);
    }

    return data;
  }
}

/**
 * Error thrown by MCP client
 */
export class MCPClientError extends Error {
  public statusCode: number;
  public path: string;

  constructor(message: string, statusCode: number, path: string) {
    super(message);
    this.name = 'MCPClientError';
    this.statusCode = statusCode;
    this.path = path;
  }
}

/**
 * Create an MCP memory client
 */
export function createMCPClient(config: MCPClientConfig): MCPMemoryClient {
  return new MCPMemoryClient(config);
}
