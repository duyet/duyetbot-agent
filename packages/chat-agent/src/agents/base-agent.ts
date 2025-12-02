/**
 * Base Agent
 *
 * Abstract base class for all agents in the routing/orchestration system.
 * Provides common functionality for Durable Object agents.
 */

import { logger } from "@duyetbot/hono-middleware";
import type { Agent } from "agents";
import type { LLMProvider, Message } from "../types.js";

/**
 * Base state interface for all agents
 */
export interface BaseAgentState {
  /** Session identifier */
  sessionId: string;
  /** Conversation messages */
  messages: Message[];
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for base agent
 */
export interface BaseAgentConfig<TEnv> {
  /** Function to create LLM provider from env */
  createProvider: (env: TEnv) => LLMProvider;
  /** System prompt for the agent */
  systemPrompt: string;
  /** Maximum messages in history */
  maxHistory?: number;
  /** Agent name for logging */
  name: string;
}

// ============================================================================
// Platform Configuration Types
// ============================================================================

/**
 * Common configuration shared across all platforms.
 * Contains non-secret environment variables from parent workers.
 *
 * Note: Properties use `| undefined` to support exactOptionalPropertyTypes,
 * allowing direct assignment from optional env vars.
 */
export interface CommonPlatformConfig {
  /** Environment (production, development) */
  environment?: "production" | "development" | string | undefined;
  /** LLM model identifier */
  model?: string | undefined;
  /** Cloudflare AI Gateway name */
  aiGatewayName?: string | undefined;
  /** AI Gateway API key for BYOK authentication (passed from parent worker) */
  aiGatewayApiKey?: string | undefined;
}

/**
 * Telegram-specific configuration
 */
export interface TelegramPlatformConfig extends CommonPlatformConfig {
  platform: "telegram";
  /** Response format: 'HTML' (default) or 'MarkdownV2' */
  parseMode?: "HTML" | "MarkdownV2" | undefined;
  /** Admin username for verbose error messages */
  adminUsername?: string | undefined;
  /** Comma-separated user IDs (empty = allow all) */
  allowedUsers?: string | undefined;
}

/**
 * GitHub-specific configuration
 */
export interface GitHubPlatformConfig extends CommonPlatformConfig {
  platform: "github";
  /** Bot username for @mentions */
  botUsername?: string | undefined;
  /** Admin username for debug footer visibility */
  adminUsername?: string | undefined;
}

/**
 * Generic platform configuration for CLI, API, etc.
 */
export interface GenericPlatformConfig extends CommonPlatformConfig {
  platform: "cli" | "api" | string;
}

/**
 * Discriminated union of all platform configurations.
 * Use TypeScript narrowing with `config.platform` to access platform-specific fields.
 *
 * @example
 * ```typescript
 * if (config.platform === 'telegram') {
 *   // TypeScript knows config.parseMode exists here
 *   const mode = config.parseMode;
 * }
 * ```
 */
export type PlatformConfig =
  | TelegramPlatformConfig
  | GitHubPlatformConfig
  | GenericPlatformConfig;

// ============================================================================
// Agent Context
// ============================================================================

/**
 * Context passed between agents during routing
 */
export interface AgentContext {
  /** Original query from user */
  query: string;
  /** User identifier */
  userId?: string | number;
  /** Chat/session identifier */
  chatId?: string | number;
  /** Username (platform-specific: Telegram @username, GitHub login) */
  username?: string;
  /** Platform (telegram, github, api) */
  platform?: string;
  /** Additional context data */
  data?: Record<string, unknown>;
  /** Parent agent ID (for orchestration) */
  parentAgentId?: string;
  /** Trace ID for distributed tracing */
  traceId?: string;
  /**
   * Conversation history from parent agent.
   * Child agents should use this instead of maintaining their own messages[] state.
   * This enables centralized state management where only the parent agent stores history.
   */
  conversationHistory?: Message[];
  /**
   * Platform-specific configuration from parent worker.
   * Contains non-secret env vars (parseMode, model, etc.) that shared DOs need.
   * @see PlatformConfig
   */
  platformConfig?: PlatformConfig;
}

/**
 * Worker execution info for debug context
 */
export interface WorkerExecutionInfo {
  /** Worker name (e.g., 'code-worker', 'research-worker') */
  name: string;
  /** Execution duration in milliseconds */
  durationMs?: number;
  /** Current execution status */
  status?: "running" | "completed" | "error";
}

/**
 * Debug information from agent execution
 * Used for admin debugging in Telegram messages
 */
export interface AgentDebugInfo {
  /** Tools used by this agent during execution */
  tools?: string[];
  /** Sub-agents delegated to (for orchestrator pattern) */
  subAgents?: string[];
  /** Workers executed by orchestrator (with timing info) */
  workers?: WorkerExecutionInfo[];
  /** Additional metadata (fallback, cache, timeout info) */
  metadata?: {
    /** Whether response is a fallback due to error */
    fallback?: boolean;
    /** Original error message if fallback */
    originalError?: string;
    /** Cache statistics */
    cacheHits?: number;
    cacheMisses?: number;
    /** Tool timeout count */
    toolTimeouts?: number;
    /** Tools that timed out */
    timedOutTools?: string[];
    /** Tool error count */
    toolErrors?: number;
    /** Last tool error message (truncated) */
    lastToolError?: string;
    /** Execution timing breakdown for debug footer */
    timing?: {
      mcpConnect?: string;
      toolDiscovery?: string;
      llmCall?: string;
      toolExecution?: string;
      total?: string;
    };
    /** Whether this was a retry after DO reset */
    retried?: boolean;
  };
}

/**
 * Result from agent execution
 */
export interface AgentResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Response content */
  content: string | undefined;
  /** Structured data */
  data: unknown | undefined;
  /** Error message if failed */
  error: string | undefined;
  /** Execution duration in ms */
  durationMs: number;
  /** Token usage */
  tokensUsed: number | undefined;
  /** Next action (for HITL) */
  nextAction: "await_confirmation" | "continue" | "complete" | undefined;
  /** Debug information for admin users */
  debug?: AgentDebugInfo;
}

/**
 * Helper to create a base state
 */
export function createBaseState(sessionId: string): BaseAgentState {
  return {
    sessionId,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Mixin to add common agent functionality
 *
 * Since we can't use abstract classes with Durable Objects easily,
 * this provides utility functions that agents can use.
 */
export const AgentMixin = {
  /**
   * Trim message history to max length
   */
  trimHistory(messages: Message[], maxHistory: number): Message[] {
    if (messages.length <= maxHistory) {
      return messages;
    }
    // Keep system messages and trim from the beginning
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");
    const trimmed = nonSystemMessages.slice(
      -(maxHistory - systemMessages.length),
    );
    return [...systemMessages, ...trimmed];
  },

  /**
   * Generate a unique ID
   */
  generateId(prefix = "id"): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  },

  /**
   * Log agent activity
   */
  log(agentName: string, action: string, data?: Record<string, unknown>): void {
    logger.info(`[${agentName}] ${action}`, data);
  },

  /**
   * Log agent error
   */
  logError(
    agentName: string,
    action: string,
    error: unknown,
    data?: Record<string, unknown>,
  ): void {
    logger.error(`[${agentName}] ${action}`, {
      ...data,
      error: error instanceof Error ? error.message : String(error),
    });
  },

  /**
   * Measure execution time
   */
  async timed<T>(
    fn: () => Promise<T>,
  ): Promise<{ result: T; durationMs: number }> {
    const start = Date.now();
    const result = await fn();
    return { result, durationMs: Date.now() - start };
  },

  /**
   * Create agent result
   */
  createResult(
    success: boolean,
    content: string | undefined,
    durationMs: number,
    extra?: Partial<AgentResult>,
  ): AgentResult {
    return {
      success,
      content,
      durationMs,
      data: undefined,
      error: undefined,
      tokensUsed: undefined,
      nextAction: undefined,
      ...extra,
    };
  },

  /**
   * Create error result
   */
  createErrorResult(error: unknown, durationMs: number): AgentResult {
    return {
      success: false,
      content: undefined,
      data: undefined,
      error: error instanceof Error ? error.message : String(error),
      durationMs,
      tokensUsed: undefined,
      nextAction: undefined,
    };
  },
};

/**
 * Type guard to check if an object is an Agent
 */
export function isAgent<TEnv, TState>(
  obj: unknown,
): obj is Agent<TEnv, TState> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "state" in obj &&
    "setState" in obj
  );
}

/**
 * Helper to safely get agent by name with proper typing
 */
export async function getTypedAgent<TAgent extends Agent<unknown, unknown>>(
  namespace: {
    idFromName: (name: string) => unknown;
    get: (id: unknown) => TAgent;
  },
  name: string,
): Promise<TAgent> {
  const id = namespace.idFromName(name);
  return namespace.get(id);
}
