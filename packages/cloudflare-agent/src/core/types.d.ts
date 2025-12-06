/**
 * Type definitions for CloudflareAgent core orchestrator
 *
 * Separates configuration and state types from the main orchestrator class
 * for better maintainability and dependency injection.
 */
import type { Tool } from '@duyetbot/types';
import type { Agent } from 'agents';
import type { AgentContext, AgentResult, PlatformConfig } from '../agents/base-agent.js';
import type { BatchConfig, BatchState, RetryConfig } from '../batch-types.js';
import type { RoutingFlags } from '../feature-flags.js';
import type { ParsedInput, Transport, TransportHooks } from '../transport.js';
import type { LLMProvider, Message, OpenAITool } from '../types.js';
/**
 * MCP server configuration for connecting to external MCP servers
 */
export interface MCPServerConnection {
  /** Unique name for this MCP server connection */
  name: string;
  /** URL of the MCP server (SSE endpoint) */
  url: string;
  /** Function to get authorization header value from env */
  getAuthHeader?: (env: Record<string, unknown>) => string | undefined;
}
/**
 * State persisted in Durable Object
 */
export interface CloudflareAgentState {
  messages: Message[];
  userId?: string | number;
  chatId?: string | number;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
  /**
   * Active batch - currently being processed (IMMUTABLE during processing)
   * Once a batch starts processing, it cannot be modified
   */
  activeBatch?: BatchState;
  /**
   * Pending batch - collecting new messages (MUTABLE)
   * New messages always go here, never to activeBatch
   */
  pendingBatch?: BatchState;
  /** Request IDs for deduplication (rolling window) */
  processedRequestIds?: string[];
}
/**
 * Router configuration for feature flag-based routing
 */
export interface RouterConfig {
  /** Platform identifier for routing decisions */
  platform: 'telegram' | 'github' | 'cli' | 'api';
  /** Feature flags (if not provided, parsed from env) */
  flags?: RoutingFlags;
  /** Enable debug logging for routing decisions */
  debug?: boolean;
}
/**
 * Configuration for CloudflareChatAgent
 *
 * @template TEnv - Environment type with bindings
 * @template TContext - Platform-specific context type for transport
 */
export interface CloudflareAgentConfig<TEnv, TContext = unknown> {
  /** Function to create LLM provider from env */
  createProvider: (env: TEnv) => LLMProvider;
  /** System prompt - static string or function that receives env for dynamic configuration */
  systemPrompt: string | ((env: TEnv) => string);
  /** Welcome message for /start command */
  welcomeMessage?: string;
  /** Help message for /help command */
  helpMessage?: string;
  /** Maximum messages in history (default: 100) */
  maxHistory?: number;
  /** Transport layer for platform-specific messaging (optional for backward compatibility) */
  transport?: Transport<TContext>;
  /** Lifecycle hooks for handle() method */
  hooks?: TransportHooks<TContext>;
  /** MCP servers to connect to for tool capabilities */
  mcpServers?: MCPServerConnection[];
  /** Built-in tools from @duyetbot/tools */
  tools?: Tool[];
  /** Thinking messages to rotate while processing */
  thinkingMessages?: string[];
  /** Interval in ms to rotate thinking messages (default: 5000) */
  thinkingRotationInterval?: number;
  /** Maximum tool call iterations per message (default: 5) */
  maxToolIterations?: number;
  /** Maximum number of tools to expose to LLM (default: unlimited) */
  maxTools?: number;
  /**
   * Router configuration for Phase 4 integration
   * When enabled, queries are classified and routed to specialized agents
   */
  router?: RouterConfig;
  /**
   * Batch configuration for message coalescing
   * When enabled, rapid messages are combined within a time window
   */
  batchConfig?: Partial<BatchConfig>;
  /**
   * Retry configuration for batch processing failures
   * When enabled, failed batches will retry with exponential backoff
   * Uses DEFAULT_RETRY_CONFIG if not specified
   */
  retryConfig?: RetryConfig;
  /**
   * Extract platform-specific configuration from environment.
   * Called when building AgentContext for routing to shared agents.
   * Only non-secret values should be included (no tokens/API keys).
   *
   * @example
   * ```typescript
   * extractPlatformConfig: (env) => ({
   *   platform: 'telegram' as const,
   *   environment: env.ENVIRONMENT,
   *   model: env.MODEL,
   *   parseMode: env.TELEGRAM_PARSE_MODE,
   * })
   * ```
   */
  extractPlatformConfig?: (env: TEnv) => PlatformConfig;
  /**
   * Adapter bundle for dependency injection (optional)
   * If not provided, defaults are created based on environment bindings
   */
  adapters?: {
    observability: any;
    stateReporter: any;
    messagePersistence: any;
  };
}
/**
 * Interface for adapter factory
 */
export interface AdapterBundle {
  observability: any;
  stateReporter: any;
  messagePersistence: any;
}
/**
 * Interface for the CloudflareChatAgent class methods
 * This defines all public methods added by createCloudflareChatAgent
 */
export interface CloudflareChatAgentMethods<TContext = unknown> {
  initMcp(): Promise<void>;
  getMcpTools(): OpenAITool[];
  init(userId?: string | number, chatId?: string | number): Promise<void>;
  chat(userMessage: string): Promise<string>;
  clearHistory(): Promise<string>;
  getWelcome(): string;
  getHelp(): string;
  getMessageCount(): number;
  setMetadata(metadata: Record<string, unknown>): void;
  getMetadata(): Record<string, unknown> | undefined;
  /** @deprecated Use handleBuiltinCommand instead */
  handleCommand(text: string): Promise<string>;
  /** Handle built-in commands, returns null for unknown commands */
  handleBuiltinCommand(text: string): Promise<string | null>;
  /** Transform slash command to natural language for LLM */
  transformSlashCommand(text: string): string;
  handle(ctx: TContext): Promise<void>;
  /**
   * Check if routing is enabled for this request
   * @param userId - User ID for deterministic rollout assignment
   */
  shouldRoute(userId?: string): boolean;
  /**
   * Route a query through RouterAgent if enabled
   * @param query - The user's message
   * @param context - Agent context with platform info
   * @returns AgentResult from RouterAgent, or null if routing disabled
   */
  routeQuery(query: string, context: AgentContext): Promise<AgentResult | null>;
  /**
   * Get routing statistics from RouterAgent if available
   * @returns Routing stats or null if RouterAgent not available
   */
  getRoutingStats(): Promise<{
    totalRouted: number;
    byTarget: Record<string, number>;
    avgDurationMs: number;
  } | null>;
  /**
   * Get routing history from RouterAgent if available
   * @param limit - Optional limit for number of history entries
   * @returns Routing history or null if RouterAgent not available
   */
  getRoutingHistory(limit?: number): Promise<unknown[] | null>;
  /**
   * Queue a message for batch processing with alarm-based execution
   * Messages within the batch window are combined into a single LLM call
   * @param ctx - Platform-specific context
   * @returns Object with queued status
   */
  queueMessage(ctx: TContext): Promise<{
    queued: boolean;
    batchId?: string;
  }>;
  /**
   * Receive a message directly via ParsedInput (RPC-friendly)
   * This is the preferred method for calling from webhooks as it doesn't require transport context.
   * @param input - Parsed message input
   * @returns Object with trace ID and processing status
   */
  receiveMessage(input: ParsedInput): Promise<{
    traceId: string;
    queued: boolean;
    batchId?: string;
  }>;
  /**
   * Get current batch state for debugging/monitoring
   */
  getBatchState(): {
    activeBatch?: BatchState;
    pendingBatch?: BatchState;
  };
}
/**
 * Type for the CloudflareChatAgent class constructor
 * Extends typeof Agent to maintain compatibility with AgentNamespace
 */
export type CloudflareChatAgentClass<TEnv, TContext = unknown> = typeof Agent<
  TEnv,
  CloudflareAgentState
> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, CloudflareAgentState>>
  ): Agent<TEnv, CloudflareAgentState> & CloudflareChatAgentMethods<TContext>;
};
/**
 * Adapter factory return type for dependency injection
 */
export type AdapterFactory<TEnv> = (env: TEnv) => AdapterBundle;
//# sourceMappingURL=types.d.ts.map
