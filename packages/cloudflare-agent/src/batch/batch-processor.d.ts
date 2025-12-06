/**
 * BatchProcessor - Core batch processing logic extraction
 *
 * Handles the primary processing workflow for combined messages:
 * - Message combination and context reconstruction
 * - Typing indicator management
 * - Thinking message rotation with heartbeat
 * - Routing decisions (pattern matching + LLM classification)
 * - Direct chat fallback
 * - Error handling with retry configuration
 * - State updates and observability reporting
 *
 * This class is dependency-injected and can be tested independently
 * of the CloudflareAgent Durable Object runtime.
 */
import type { AgentContext, AgentResult } from '../agents/base-agent.js';
import type { BatchState, RetryConfig } from '../batch-types.js';
import type { Transport } from '../transport.js';
/**
 * Result of batch processing operation
 * Contains success status, response, timing, and event IDs for observability
 */
export interface BatchProcessingResult {
  /** Whether processing succeeded */
  success: boolean;
  /** LLM response or delegated routing response */
  response?: string;
  /** Whether request was delegated to RouterAgent */
  delegated?: boolean;
  /** Error message if processing failed */
  error?: string;
  /** Total duration of batch processing in milliseconds */
  durationMs: number;
  /** Event IDs from all messages in batch (for observability correlation) */
  eventIds?: string[];
}
/**
 * Dependencies injected into BatchProcessor
 * All dependencies are required for full functionality
 */
export interface BatchProcessorDeps<TContext, TEnv> {
  /** Transport for platform-specific messaging */
  transport: Transport<TContext>;
  /** Observability adapter for logging and monitoring */
  observability?: {
    logBatchStart: (batchId: string, messageCount: number) => void;
    logBatchComplete: (batchId: string, durationMs: number) => void;
    logBatchError: (batchId: string, error: string) => void;
  };
  /** State reporter for batch registration and completion */
  stateReporter?: {
    registerBatch: (batchId: string, messageCount: number) => Promise<void>;
    reportHeartbeat: (batchId: string) => Promise<void>;
    completeBatch: (batchId: string, success: boolean, durationMs: number) => Promise<void>;
  };
  /** Function to route query through RouterAgent if enabled */
  routeQuery: (query: string, context: AgentContext) => Promise<AgentResult | null>;
  /** Function to execute direct chat (LLM) call */
  chat: (message: string, eventId?: string) => Promise<string>;
  /** Function to handle /clear command */
  clearHistory: () => Promise<string>;
  /** Function to initialize user/chat context */
  initUser: (userId?: string | number, chatId?: string | number) => Promise<void>;
  /** Environment for platform-specific secrets (bot tokens, etc.) */
  env: TEnv;
}
/**
 * Configuration for batch processor behavior
 */
export interface BatchProcessorConfig {
  /** Retry configuration for failed batches */
  retryConfig?: RetryConfig;
  /** Thinking messages to rotate while processing */
  thinkingMessages?: string[];
  /** Interval in ms to rotate thinking messages (default: 5000) */
  thinkingRotationInterval?: number;
}
/**
 * BatchProcessor handles core batch processing logic
 *
 * Responsibilities:
 * - Process batches of combined messages
 * - Handle /clear command specially
 * - Coordinate with transport for typing indicators and message editing
 * - Manage thinking message rotation with heartbeats
 * - Route queries via RouterAgent when enabled
 * - Fall back to direct chat when routing unavailable
 * - Collect event IDs for observability correlation
 *
 * @example
 * ```typescript
 * const processor = new BatchProcessor({ thinkingMessages: ['Thinking...'] });
 * const result = await processor.process(batch, deps, env, 'telegram');
 * ```
 */
export declare class BatchProcessor<TContext, TEnv> {
  private readonly config;
  constructor(config?: BatchProcessorConfig);
  /**
   * Process a batch of queued messages
   *
   * Main entry point for batch processing. Combines messages, determines if
   * routing is available, executes LLM or routing, and handles response delivery.
   *
   * @param batch - The batch state with pending messages
   * @param deps - Injected dependencies for processing
   * @param env - Environment with platform secrets
   * @param platform - Platform identifier (telegram, github, etc.)
   * @returns Result containing success status, response, and duration
   *
   * @throws Only if transport is not configured
   */
  process(
    batch: BatchState,
    deps: BatchProcessorDeps<TContext, TEnv>,
    env: TEnv,
    _platform: string
  ): Promise<BatchProcessingResult>;
  /**
   * Execute the main processing workflow
   * Handles routing decision and chat execution with rotator management
   */
  private executeProcessing;
  /**
   * Build transport context from pending message
   * Preserves original context and injects platform-specific secrets from environment
   */
  private buildTransportContext;
  /**
   * Build AgentContext for routing decisions
   * Contains query and platform information for classifier
   */
  private buildAgentContext;
}
/**
 * Factory function to create BatchProcessor with default configuration
 * @param config - Optional configuration overrides
 * @returns New BatchProcessor instance
 */
export declare function createBatchProcessor<TContext, TEnv>(
  config?: BatchProcessorConfig
): BatchProcessor<TContext, TEnv>;
//# sourceMappingURL=batch-processor.d.ts.map
