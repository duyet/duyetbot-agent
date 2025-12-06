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

import { logger } from '@duyetbot/hono-middleware';
import type { AgentContext, AgentResult } from '../agents/base-agent.js';
import type { BatchState, PendingMessage, RetryConfig } from '../batch-types.js';
import { combineBatchMessages } from '../batch-types.js';
import {
  createThinkingRotator,
  getDefaultThinkingMessages,
  type ThinkingRotator,
} from '../format.js';
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
export class BatchProcessor<TContext, TEnv> {
  private readonly config: BatchProcessorConfig;

  constructor(config: BatchProcessorConfig = {}) {
    this.config = {
      thinkingMessages: config.thinkingMessages ?? getDefaultThinkingMessages(),
      thinkingRotationInterval: config.thinkingRotationInterval ?? 5000,
      ...config,
    };
  }

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
  async process(
    batch: BatchState,
    deps: BatchProcessorDeps<TContext, TEnv>,
    env: TEnv,
    _platform: string
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    const eventIds: string[] = [];

    try {
      // Validate batch state
      if (!batch || batch.pendingMessages.length === 0) {
        return {
          success: false,
          error: 'Batch is empty or invalid',
          durationMs: Date.now() - startTime,
        };
      }

      if (!deps.transport) {
        throw new Error('Transport not configured');
      }

      // Get first message for context and metadata
      const firstMessage = batch.pendingMessages[0];
      if (!firstMessage) {
        return {
          success: false,
          error: 'No first message in batch',
          durationMs: Date.now() - startTime,
        };
      }

      // Collect event IDs for observability correlation
      for (const msg of batch.pendingMessages) {
        if (msg.eventId) {
          eventIds.push(msg.eventId);
        }
      }

      // Log batch start
      deps.observability?.logBatchStart(batch.batchId || '', batch.pendingMessages.length);
      if (deps.stateReporter) {
        void deps.stateReporter.registerBatch(batch.batchId || '', batch.pendingMessages.length);
      }

      // Handle /clear command specially (process alone, discard others)
      const firstText = firstMessage.text ?? '';
      const firstCommand = firstText.split(/[\s\n]/)[0]?.toLowerCase();

      if (firstCommand === '/clear') {
        logger.info('[BatchProcessor] Processing /clear command alone', {
          batchId: batch.batchId,
          discardedMessages: batch.pendingMessages.length - 1,
        });

        // Initialize user context
        await deps.initUser(firstMessage.userId, firstMessage.chatId);

        // Process /clear via clearHistory
        const response = await deps.clearHistory();
        deps.observability?.logBatchComplete(batch.batchId || '', Date.now() - startTime);
        if (deps.stateReporter) {
          void deps.stateReporter.completeBatch(batch.batchId || '', true, Date.now() - startTime);
        }

        return {
          success: true,
          response,
          durationMs: Date.now() - startTime,
          eventIds,
        };
      }

      // Normal batch processing - combine messages
      const combinedText = combineBatchMessages(batch.pendingMessages);

      logger.info('[BatchProcessor] Combined batch messages', {
        batchId: batch.batchId,
        messageCount: batch.pendingMessages.length,
        combinedLength: combinedText.length,
      });

      // Initialize user context
      await deps.initUser(firstMessage.userId, firstMessage.chatId);

      // Reconstruct transport context from first message
      const ctx = this.buildTransportContext(
        firstMessage,
        combinedText,
        env,
        deps.transport
      ) as TContext;

      // Send typing indicator if supported
      if (deps.transport.typing) {
        await deps.transport.typing(ctx);
      }

      // Create and start thinking message rotation
      const rotator = createThinkingRotator({
        messages: this.config.thinkingMessages ?? getDefaultThinkingMessages(),
        interval: this.config.thinkingRotationInterval ?? 5000,
      });

      // Send initial thinking message
      const messageRef = await deps.transport.send(ctx, rotator.getCurrentMessage());

      // Start rotation with heartbeat reporting
      let response: string | undefined;
      const processingError = await this.executeProcessing(
        combinedText,
        batch,
        firstMessage,
        ctx,
        deps,
        rotator
      )
        .then((result) => {
          response = result;
          return null;
        })
        .catch((error) => error);

      // Stop rotation and wait for pending callbacks
      rotator.stop();
      await rotator.waitForPending();

      // Handle processing error
      if (processingError) {
        throw processingError;
      }

      if (!response) {
        throw new Error('No response from processing');
      }

      // Update thinking message with final response
      if (deps.transport.edit) {
        try {
          await deps.transport.edit(ctx, messageRef, response);
        } catch (err) {
          // Edit failed (message deleted, etc.) - send as new message
          logger.warn('[BatchProcessor] Failed to edit thinking message, sending as new', {
            error: err instanceof Error ? err.message : String(err),
          });
          await deps.transport.send(ctx, response);
        }
      } else {
        // Transport doesn't support edit - send as new message
        await deps.transport.send(ctx, response);
      }

      // Log success
      const durationMs = Date.now() - startTime;
      deps.observability?.logBatchComplete(batch.batchId || '', durationMs);
      if (deps.stateReporter) {
        void deps.stateReporter.completeBatch(batch.batchId || '', true, durationMs);
      }

      return {
        success: true,
        response,
        durationMs,
        eventIds,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('[BatchProcessor] Processing failed', {
        batchId: batch.batchId,
        error: errorMessage,
        durationMs,
      });

      deps.observability?.logBatchError(batch.batchId || '', errorMessage);
      if (deps.stateReporter) {
        void deps.stateReporter.completeBatch(batch.batchId || '', false, durationMs);
      }

      return {
        success: false,
        error: errorMessage,
        durationMs,
        eventIds,
      };
    }
  }

  /**
   * Execute the main processing workflow
   * Handles routing decision and chat execution with rotator management
   */
  private async executeProcessing(
    combinedText: string,
    batch: BatchState,
    firstMessage: PendingMessage,
    _ctx: TContext,
    deps: BatchProcessorDeps<TContext, TEnv>,
    rotator: ThinkingRotator
  ): Promise<string> {
    try {
      // Try routing first (if enabled)
      const agentContext = this.buildAgentContext(firstMessage, combinedText, deps.env);

      const routingResult = await deps.routeQuery(combinedText, agentContext);

      if (routingResult?.content) {
        logger.info('[BatchProcessor] Routed to specialized agent', {
          batchId: batch.batchId,
          target: routingResult.content.substring(0, 100),
        });
        return routingResult.content;
      }

      // Fall back to direct chat
      logger.info('[BatchProcessor] Routing unavailable, using direct chat', {
        batchId: batch.batchId,
      });

      return await deps.chat(combinedText, firstMessage.eventId);
    } finally {
      // Ensure rotator is always stopped
      rotator.stop();
    }
  }

  /**
   * Build transport context from pending message
   * Preserves original context and injects platform-specific secrets from environment
   */
  private buildTransportContext(
    message: PendingMessage,
    text: string,
    env: TEnv,
    _transport: Transport<TContext>
  ): Record<string, unknown> {
    const envRecord = env as Record<string, unknown>;

    // Start with original context if available
    const base: Record<string, unknown> = {
      ...((message.originalContext as Record<string, unknown>) ?? {}),
    };

    // Override core fields from message
    base.chatId = message.chatId;
    base.userId = message.userId;
    base.username = message.username;
    base.text = text;

    // Inject platform-specific secrets from environment
    if (envRecord.TELEGRAM_BOT_TOKEN && !base.token) {
      base.token = envRecord.TELEGRAM_BOT_TOKEN;
    }
    if (envRecord.GITHUB_TOKEN && !base.githubToken) {
      base.githubToken = envRecord.GITHUB_TOKEN;
    }

    return base;
  }

  /**
   * Build AgentContext for routing decisions
   * Contains query and platform information for classifier
   */
  private buildAgentContext(message: PendingMessage, query: string, env: TEnv): AgentContext {
    const envRecord = env as Record<string, unknown>;
    const platform = (envRecord.PLATFORM as string) || 'api';

    return {
      query,
      platform: platform as 'telegram' | 'github' | 'api' | 'cli',
      ...(message.userId && { userId: String(message.userId) }),
      ...(message.chatId && { chatId: String(message.chatId) }),
    };
  }
}

/**
 * Factory function to create BatchProcessor with default configuration
 * @param config - Optional configuration overrides
 * @returns New BatchProcessor instance
 */
export function createBatchProcessor<TContext, TEnv>(
  config?: BatchProcessorConfig
): BatchProcessor<TContext, TEnv> {
  return new BatchProcessor<TContext, TEnv>(config);
}
