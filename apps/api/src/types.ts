/**
 * API Gateway Types
 */

export interface APIConfig {
  /** Server port */
  port: number;
  /** CORS allowed origins */
  corsOrigins?: string[];
  /** GitHub token for auth verification */
  githubToken?: string;
  /** Enable rate limiting */
  enableRateLimit?: boolean;
  /** Rate limit: requests per minute */
  rateLimit?: number;
  /** MCP memory server URL */
  mcpServerUrl?: string;
  /** Enable request logging */
  enableLogging?: boolean;
}

export interface RateLimitState {
  requests: number;
  resetTime: number;
}

export interface AuthUser {
  id: string;
  type: 'github' | 'telegram' | 'api';
  username?: string;
}

export interface APIContext {
  user?: AuthUser;
  requestId: string;
  startTime: number;
}

export interface StreamChunk {
  type: 'content' | 'tool_use' | 'tool_result' | 'error' | 'done';
  data: unknown;
}

export interface AgentRequest {
  message: string;
  sessionId?: string;
  model?: string;
  tools?: string[];
}

export interface AgentResponse {
  sessionId: string;
  message: string;
  toolCalls?: Array<{
    name: string;
    input: unknown;
    output: unknown;
  }>;
}
