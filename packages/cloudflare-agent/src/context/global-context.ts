/**
 * GlobalContext module - Unified Pipeline Context (UPC)
 *
 * Provides a single mutable context object that flows through the entire
 * agent pipeline. Created once at webhook entry, accumulated at each step,
 * and never reconstructed.
 *
 * This solves the problem of multiple context reconstruction points causing
 * data loss in the old architecture (ParsedInput → ExecutionContext → AgentContext → WorkerInput).
 *
 * Key invariants:
 * - Created once at webhook entry via createGlobalContext()
 * - Passed by reference through all agents
 * - Accumulates data at each step (never reconstructed)
 * - Contains all fields needed by all agents
 * - Immutable fields are frozen for type safety
 * - Array push operations are atomic in JavaScript (safe for parallel execution)
 */

import { randomUUID } from 'node:crypto';
import type { Message } from '../types.js';

/**
 * Platform type for message origin
 */
export type Platform = 'telegram' | 'github' | 'api';

/**
 * Agent execution span for tracing and timing
 *
 * Records information about a single agent's execution within the pipeline,
 * including timing, parent-child relationships, and execution outcome.
 */
export interface AgentSpan {
  /** Name of the agent that executed */
  agent: string;
  /** Unique span identifier for this agent execution */
  spanId: string;
  /** Parent span ID for correlation (undefined for root agent) */
  parentSpanId?: string;
  /** When this span started (milliseconds since epoch) */
  startedAt: number;
  /** When this span completed (milliseconds since epoch) */
  endedAt?: number;
  /** Execution duration in milliseconds (endedAt - startedAt) */
  durationMs?: number;
  /** Execution result: success, error, or delegated to another agent */
  result?: 'success' | 'error' | 'delegated';
}

/**
 * Tool call record for tracking LLM function calls
 *
 * Records details about a tool/function call made by an LLM,
 * associated with a specific span for parallel execution traceability.
 */
export interface ToolCallRecord {
  /** Span ID that made this call (for parallel execution tracking) */
  spanId: string;
  /** Tool/function name */
  name: string;
  /** Arguments passed to the tool */
  arguments: Record<string, unknown>;
  /** Result returned by the tool (if completed) */
  result?: unknown;
  /** Error message (if execution failed) */
  error?: string;
  /** Execution duration in milliseconds (if completed) */
  durationMs?: number;
  /** Timestamp when the call was made */
  timestamp: number;
}

/**
 * Token usage record for tracking LLM API consumption
 *
 * Records token usage for an LLM API call,
 * associated with a specific span for per-worker accounting.
 */
export interface TokenUsageRecord {
  /** Span ID that made this call (for parallel execution tracking) */
  spanId: string;
  /** LLM provider name (e.g., 'claude', 'openrouter') */
  provider: string;
  /** Model identifier (e.g., 'claude-3-5-sonnet-20241022') */
  model: string;
  /** Input/prompt tokens consumed */
  inputTokens: number;
  /** Output/completion tokens generated */
  outputTokens: number;
  /** Timestamp when the call was made */
  timestamp: number;
}

/**
 * Routing decision record for tracking query classification
 *
 * Records the routing decision made by the router agent for a specific query.
 */
export interface RoutingDecisionRecord {
  /** Span ID that made this routing decision */
  spanId: string;
  /** Original query that was classified */
  query: string;
  /** Target agent/worker selected for handling */
  target: string;
  /** Confidence score (0.0-1.0) for this decision */
  confidence: number;
  /** Timestamp when the decision was made */
  timestamp: number;
}

/**
 * Query classification result
 *
 * Records the output of query classification by the router.
 */
export interface QueryClassification {
  /** Query type (simple, complex, tool_confirmation, etc.) */
  type: string;
  /** Query category (general, code, research, github, admin, etc.) */
  category: string;
  /** Complexity level (low, medium, high) */
  complexity: string;
  /** Confidence score (0.0-1.0) - optional if not calculated */
  confidence?: number;
  /** Timestamp when classification was made */
  timestamp: number;
}

/**
 * Unified Pipeline Context (UPC)
 *
 * Single context object that flows through the entire agent pipeline.
 * Created once at webhook entry, accumulates data at each step.
 * NEVER reconstructed - only extended.
 *
 * Divided into three sections:
 * 1. **Immutable fields**: Set once at webhook entry, frozen with Object.freeze()
 * 2. **Mutable execution state**: Can be modified during pipeline execution
 * 3. **Append-only accumulators**: Only push operations, never replace or modify existing entries
 */
export interface GlobalContext {
  // ═══════════════════════════════════════════════════════════════
  // IMMUTABLE: Set once at webhook entry, never changed
  // ═══════════════════════════════════════════════════════════════

  /** Unique trace ID for entire request lifecycle */
  readonly traceId: string;
  /** Platform where message originated */
  readonly platform: Platform;
  /** Timestamp when request was received (milliseconds since epoch) */
  readonly receivedAt: number;

  // User Identity (immutable after set)
  /** User ID from the platform */
  readonly userId: string | number;
  /** Chat/conversation ID from the platform */
  readonly chatId: string | number;
  /** Optional username from the platform (not all platforms provide) */
  readonly username?: string;
  /** Whether the user is an admin (for debug footer visibility and alerts) */
  readonly isAdmin: boolean;
  /** Admin username for alert targeting (may differ from username if sender is not admin) */
  readonly adminUsername?: string;

  // Original Message
  /** User's input query */
  readonly query: string;
  /** Message ID from user's message (can be string or number depending on platform) */
  readonly userMessageId: string | number;
  /** Message ID being replied to (if this is a reply) */
  readonly replyToMessageId?: string | number;

  // Platform-specific (immutable after set)
  /** Platform-specific configuration (e.g., Telegram parseMode, token for transport) */
  readonly platformConfig: {
    readonly parseMode?: string;
    readonly token?: string;
    [key: string]: unknown;
  };

  // ═══════════════════════════════════════════════════════════════
  // MUTABLE: Accumulated during pipeline execution
  // ═══════════════════════════════════════════════════════════════

  // Current execution state
  /** Current span ID being executed (changes during sequential agent flow) */
  currentSpanId: string;
  /** Current agent name being executed */
  currentAgent: string;
  /** Execution deadline (milliseconds since epoch) - for Durable Object request timeout */
  deadline: number;

  // Conversation (loaded once, may be trimmed)
  /** Conversation history up to current message */
  conversationHistory: Message[];

  // Response tracking
  /** Message ID of agent's response (set after sending reply) */
  responseMessageId?: string | number;
  /** Message ID of "thinking..." message (for progressive updates) */
  thinkingMessageId?: string | number;

  // Provider (may change if fallback)
  /** LLM provider name (e.g., 'claude', 'openrouter') */
  provider: string;
  /** Model name (e.g., 'claude-3-5-sonnet-20241022') */
  model: string;

  // ═══════════════════════════════════════════════════════════════
  // ACCUMULATOR: Append-only collections (parallel-safe)
  // ═══════════════════════════════════════════════════════════════

  /** Agent execution chain with timing (in execution order) */
  agentChain: AgentSpan[];

  /** All tool calls across all agents (in execution order) */
  toolCalls: ToolCallRecord[];

  /** Token usage per LLM call (in chronological order) */
  tokenUsage: TokenUsageRecord[];

  /** Routing decisions made (usually just one from the router) */
  routingDecisions: RoutingDecisionRecord[];

  /** Classification result (first classification) */
  classification?: QueryClassification;

  /** Warnings and errors (non-fatal, for observability) */
  warnings: string[];
  errors: string[];

  /** Custom metadata from any agent (keyed by spanId for parallel safety) */
  metadata: Record<string, unknown>;

  // ═══════════════════════════════════════════════════════════════
  // TIMING: Accumulated timing metrics
  // ═══════════════════════════════════════════════════════════════

  /** Timing metrics in milliseconds */
  timing: {
    /** Query classification duration */
    classificationMs?: number;
    /** Router agent execution duration */
    routerMs?: number;
    /** LLM API call duration */
    llmMs?: number;
    /** Tool execution duration */
    toolsMs?: number;
    /** Total execution duration */
    totalMs?: number;
  };

  // ═══════════════════════════════════════════════════════════════
  // OBSERVABILITY: For database tracking
  // ═══════════════════════════════════════════════════════════════

  /** Event ID for D1 observability correlation (full UUID from webhook) */
  eventId?: string;
  /** Session ID for analytics */
  sessionId?: string;
}

/**
 * Create a GlobalContext from webhook input
 *
 * This is the ONLY place a GlobalContext is created in the system.
 * Created once at webhook entry, the context is then passed by reference
 * through all agents, accumulators, and workers.
 *
 * Immutable fields are frozen with Object.freeze() to enforce type safety.
 *
 * @param input - Webhook input containing user and message information
 * @returns New GlobalContext with all fields initialized
 *
 * @example
 * ```typescript
 * // In webhook handler
 * const ctx = createGlobalContext({
 *   platform: 'telegram',
 *   userId: 12345,
 *   chatId: 12345,
 *   messageId: 99,
 *   text: 'What is Rust?',
 * });
 *
 * // Pass to agent
 * await agent.receiveMessage(ctx);
 * ```
 */
export function createGlobalContext(input: {
  platform: Platform;
  userId: string | number;
  chatId: string | number;
  username?: string;
  isAdmin?: boolean;
  adminUsername?: string;
  messageId: string | number;
  replyToMessageId?: string | number;
  text: string;
  platformConfig?: Record<string, unknown>;
  eventId?: string;
}): GlobalContext {
  const traceId = randomUUID();
  const now = Date.now();

  const result: GlobalContext = {
    // Immutable
    traceId,
    platform: input.platform,
    receivedAt: now,
    userId: input.userId,
    chatId: input.chatId,
    ...(input.username && { username: input.username }),
    isAdmin: input.isAdmin ?? false,
    ...(input.adminUsername && { adminUsername: input.adminUsername }),
    query: input.text,
    userMessageId: input.messageId,
    ...(input.replyToMessageId && { replyToMessageId: input.replyToMessageId }),
    platformConfig: Object.freeze({ ...input.platformConfig }),

    // Mutable
    currentSpanId: traceId, // Root span = trace
    currentAgent: 'entry',
    deadline: now + 30000,
    conversationHistory: [],
    provider: 'claude',
    model: 'claude-3-5-sonnet-20241022',

    // Accumulators (empty)
    agentChain: [],
    toolCalls: [],
    tokenUsage: [],
    routingDecisions: [],
    warnings: [],
    errors: [],
    metadata: {},
    timing: {},

    // Observability
    ...(input.eventId && { eventId: input.eventId }),
    sessionId: `${input.platform}:${input.userId}:${input.chatId}`,
  };

  return result;
}

/**
 * Generate a new span ID using UUID v4
 *
 * @returns New span ID
 */
export function createSpanId(): string {
  return randomUUID();
}

/**
 * Serialize GlobalContext to JSON string
 *
 * Used for storing context in Durable Object storage or batch queue.
 * Full context survives serialization without data loss.
 *
 * Preserves all accumulated data:
 * - Debug accumulators (agentChain, toolCalls, tokenUsage, routingDecisions)
 * - Timing metrics
 * - Trace IDs and spans
 * - Warnings and errors
 * - Metadata
 *
 * @param ctx - GlobalContext to serialize
 * @returns JSON string representation
 * @throws If serialization fails
 *
 * @example
 * ```typescript
 * const serialized = serializeContext(ctx);
 * message.serializedContext = serialized;
 * ```
 */
export function serializeContext(ctx: GlobalContext): string {
  try {
    // All fields are already serializable (primitives, arrays, objects)
    // Just pass through to JSON.stringify for full context preservation
    return JSON.stringify(ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to serialize GlobalContext: ${message}`);
  }
}

/**
 * Deserialize GlobalContext from JSON string
 *
 * Restores a complete GlobalContext from serialized form, including all
 * accumulated debug data, timing metrics, and execution trace information.
 *
 * Validates required fields and restores readonly semantics for immutable fields.
 *
 * @param json - JSON string representation from serializeContext
 * @returns Deserialized GlobalContext with all data intact
 * @throws If JSON is invalid, parsing fails, or required fields are missing
 *
 * @example
 * ```typescript
 * if (message.serializedContext) {
 *   const ctx = deserializeContext(message.serializedContext);
 *   // ctx has all accumulated data preserved
 * }
 * ```
 */
export function deserializeContext(json: string): GlobalContext {
  try {
    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (syntaxError) {
      throw new Error(
        `Invalid JSON: ${syntaxError instanceof Error ? syntaxError.message : 'Unknown parse error'}`
      );
    }

    // Type guard with validation
    const data = parsed as Partial<GlobalContext>;

    // Validate required immutable fields
    if (typeof data.traceId !== 'string' || !data.traceId) {
      throw new Error('Missing or invalid traceId');
    }
    if (!data.platform || !['telegram', 'github', 'api'].includes(data.platform)) {
      throw new Error('Missing or invalid platform');
    }
    if (typeof data.receivedAt !== 'number' || data.receivedAt < 0) {
      throw new Error('Missing or invalid receivedAt');
    }

    // Validate user identity
    if (data.userId === undefined) {
      throw new Error('Missing userId');
    }
    if (data.chatId === undefined) {
      throw new Error('Missing chatId');
    }

    // Validate critical mutable fields
    if (!Array.isArray(data.agentChain)) {
      throw new Error('Invalid agentChain: must be array');
    }
    if (!Array.isArray(data.toolCalls)) {
      throw new Error('Invalid toolCalls: must be array');
    }
    if (!Array.isArray(data.conversationHistory)) {
      throw new Error('Invalid conversationHistory: must be array');
    }

    // Reconstruct with validated data
    const ctx: GlobalContext = {
      // Immutable fields
      traceId: data.traceId,
      platform: data.platform as 'telegram' | 'github' | 'api',
      receivedAt: data.receivedAt,
      userId: data.userId,
      chatId: data.chatId,
      ...(data.username && { username: data.username }),
      isAdmin: data.isAdmin ?? false,
      ...(data.adminUsername && { adminUsername: data.adminUsername }),
      query: data.query ?? '',
      userMessageId: data.userMessageId ?? 0,
      ...(data.replyToMessageId && { replyToMessageId: data.replyToMessageId }),
      // Restore readonly semantics by freezing
      platformConfig: Object.freeze({ ...data.platformConfig }),

      // Mutable fields
      currentSpanId: data.currentSpanId ?? data.traceId,
      currentAgent: data.currentAgent ?? 'entry',
      deadline: data.deadline ?? Date.now() + 30000,
      conversationHistory: data.conversationHistory,
      ...(data.responseMessageId && { responseMessageId: data.responseMessageId }),
      ...(data.thinkingMessageId && { thinkingMessageId: data.thinkingMessageId }),
      provider: data.provider ?? 'claude',
      model: data.model ?? 'claude-3-5-sonnet-20241022',

      // Accumulator arrays (preserve all entries)
      agentChain: data.agentChain,
      toolCalls: data.toolCalls,
      tokenUsage: data.tokenUsage ?? [],
      routingDecisions: data.routingDecisions ?? [],
      ...(data.classification && { classification: data.classification }),
      warnings: data.warnings ?? [],
      errors: data.errors ?? [],
      metadata: data.metadata ?? {},

      // Timing metrics
      timing: data.timing ?? {},

      // Observability
      ...(data.eventId && { eventId: data.eventId }),
      ...(data.sessionId && { sessionId: data.sessionId }),
    };

    return ctx;
  } catch (error) {
    // Re-throw with context
    if (error instanceof Error) {
      throw new Error(`Failed to deserialize GlobalContext: ${error.message}`);
    }
    throw new Error(`Failed to deserialize GlobalContext: ${String(error)}`);
  }
}
