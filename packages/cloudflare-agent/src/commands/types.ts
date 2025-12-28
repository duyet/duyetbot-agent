import type { CloudflareAgentState } from '../cloudflare-agent.js';

/**
 * Environment bindings for admin commands that need D1/KV access.
 */
export interface CommandEnv {
  /** D1 database for observability data */
  OBSERVABILITY_DB?: D1Database;
  /** KV namespace for heartbeat/safety */
  HEARTBEAT_KV?: KVNamespace;
  /** Platform identifier */
  ENVIRONMENT?: string;
}

/**
 * Agent status information for /agents command.
 */
export interface AgentInfo {
  name: string;
  platform: string;
  status: 'healthy' | 'degraded' | 'offline';
  lastActive?: number;
  messageCount?: number;
}

export interface CommandContext {
  /** Is the user an admin */
  isAdmin?: boolean;
  /** Username of the caller */
  username?: string;
  /** Parse mode for response formatting */
  parseMode?: 'HTML' | 'MarkdownV2';
  /** Current agent state */
  state: CloudflareAgentState;
  /** Function to update agent state */
  setState: (newState: CloudflareAgentState) => void;
  /** Reset MCP connection state */
  resetMcp?: () => void;
  /** Clear persistent messages from D1 storage */
  clearMessages?: () => Promise<number>;
  /** Environment bindings for admin queries */
  env?: CommandEnv;
  /** Agent start time for uptime calculation */
  startedAt?: number;
  /** Agent configuration */
  config: {
    welcomeMessage?: string;
    helpMessage?: string;
    tools?: Array<{ name: string; description?: string }>;
    mcpServers?: Array<{ name: string; url: string }>;
    maxHistory?: number;
    maxToolIterations?: number;
    maxTools?: number;
    thinkingRotationInterval?: number;
    router?: {
      platform: string;
      debug?: boolean;
    };
  };
}

export type CommandHandler = (text: string, ctx: CommandContext) => Promise<string | null>;
