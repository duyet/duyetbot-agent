/**
 * API Client
 *
 * Client library for interacting with duyetbot central API
 */

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

/**
 * API client configuration
 */
export interface APIClientConfig {
  apiUrl: string;
  accessToken?: string;
  refreshToken?: string;
  onTokenRefresh?: (accessToken: string, refreshToken: string) => void;
}

/**
 * User profile response
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Session response
 */
export interface SessionResponse {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Chat message request
 */
export interface ChatRequest {
  sessionId?: string;
  message: string;
  model?: string;
}

/**
 * API Error
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * API Client for duyetbot central API
 */
export class APIClient {
  private config: APIClientConfig;

  constructor(config: APIClientConfig) {
    this.config = config;
  }

  /**
   * Make authenticated request
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.apiUrl}${path}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    // Add authorization header if token exists
    if (this.config.accessToken) {
      headers.Authorization = `Bearer ${this.config.accessToken}`;
    }

    let response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle token expiration
    if (response.status === 401 && this.config.refreshToken) {
      // Try to refresh token
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        // Retry with new token
        headers.Authorization = `Bearer ${this.config.accessToken}`;
        response = await fetch(url, {
          ...options,
          headers,
        });
      }
    }

    // Parse response
    const data = await response.json();

    if (!response.ok) {
      throw new APIError(data.message || 'Request failed', response.status, data.code);
    }

    return data.data as T;
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(): Promise<boolean> {
    if (!this.config.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: this.config.refreshToken,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      this.config.accessToken = data.data.accessToken;

      // Notify callback
      if (this.config.onTokenRefresh && this.config.refreshToken) {
        this.config.onTokenRefresh(this.config.accessToken, this.config.refreshToken);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/users/me');
  }

  /**
   * List user sessions
   */
  async listSessions(): Promise<SessionResponse[]> {
    return this.request<SessionResponse[]>('/agent/sessions');
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<SessionResponse> {
    return this.request<SessionResponse>(`/agent/sessions/${sessionId}`);
  }

  /**
   * Create new session
   */
  async createSession(title?: string): Promise<SessionResponse> {
    return this.request<SessionResponse>('/agent/sessions', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.request<void>(`/agent/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Send chat message (streaming)
   */
  async *chat(request: ChatRequest): AsyncGenerator<SDKMessage> {
    const url = `${this.config.apiUrl}/agent/chat`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.config.accessToken) {
      headers.Authorization = `Bearer ${this.config.accessToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new APIError(data.message || 'Chat request failed', response.status, data.code);
    }

    // Parse SSE stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }

          try {
            const message = JSON.parse(data) as SDKMessage;
            yield message;
          } catch {
            // Invalid JSON, skip
          }
        }
      }
    }
  }

  /**
   * Logout (revoke refresh token)
   */
  async logout(): Promise<void> {
    if (this.config.refreshToken) {
      await this.request<void>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({
          refreshToken: this.config.refreshToken,
        }),
      });
    }

    this.config.accessToken = undefined;
    this.config.refreshToken = undefined;
  }
}
