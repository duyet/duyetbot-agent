/**
 * ExecutionContext and related types
 *
 * Provides execution context for agent operations in the Durable Object architecture.
 * Tracks trace identifiers, platform origin, message references, timing, and debug information.
 */
import type { ParsedInput } from '../transport.js';
import type { Message } from '../types.js';
/**
 * Platform type for message origin
 */
export type Platform = 'telegram' | 'github' | 'api';
/**
 * Agent execution span for tracing
 */
export interface AgentSpan {
  /** Name of the agent that executed */
  agent: string;
  /** Unique span identifier for this agent execution */
  spanId: string;
  /** Parent span ID for correlation (undefined for root agent) */
  parentSpanId?: string;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Timestamp when span was created */
  timestamp: number;
}
/**
 * Tool invocation recorded in debug information
 */
export interface DebugToolCall {
  /** Tool name */
  name: string;
  /** Tool arguments as a Record (parsed from JSON) */
  arguments: Record<string, unknown>;
  /** Tool result (if execution completed) */
  result?: unknown;
  /** Execution duration in milliseconds (if completed) */
  durationMs?: number;
  /** Error message (if execution failed) */
  error?: string;
}
/**
 * Debug information accumulator for execution tracing
 */
export interface DebugAccumulator {
  /** Chain of agent executions in order */
  agentChain: AgentSpan[];
  /** Query classification duration in milliseconds */
  classificationMs?: number;
  /** Router decision duration in milliseconds */
  routerMs?: number;
  /** LLM API call duration in milliseconds */
  llmMs?: number;
  /** Total execution duration in milliseconds */
  totalMs?: number;
  /** Query classification details (deferred to avoid circular deps) */
  classification?: unknown;
  /** Ordered list of tool calls executed */
  toolCalls: DebugToolCall[];
  /** Non-critical warnings during execution */
  warnings: string[];
  /** Non-critical errors during execution */
  errors: string[];
}
/**
 * Execution context for agent operations
 *
 * Provides complete context for a single user query through the agent system,
 * including tracing, platform information, timing, and debug accumulation.
 */
export interface ExecutionContext {
  /** Unique trace ID for correlating all spans in this execution */
  traceId: string;
  /** Current span ID for this agent execution */
  spanId: string;
  /** Parent span ID for correlation with parent agent */
  parentSpanId?: string;
  /** Event ID for D1 observability correlation (full UUID from webhook) */
  eventId?: string;
  /** Platform where message originated */
  platform: Platform;
  /** User ID from the platform */
  userId: string | number;
  /** Chat/conversation ID from the platform */
  chatId: string | number;
  /** Optional username (not all platforms provide) */
  username?: string;
  /** Message ID from user's message (can be string or number depending on platform) */
  userMessageId: string | number;
  /** Message ID of agent's response (can be string or number depending on platform) */
  responseMessageId?: string | number;
  /** LLM provider name (e.g., 'claude', 'openrouter') */
  provider: string;
  /** Model name (e.g., 'claude-opus', 'claude-sonnet') */
  model: string;
  /** User's input query */
  query: string;
  /** Conversation history up to this message */
  conversationHistory: Message[];
  /** Debug information accumulator */
  debug: DebugAccumulator;
  /** When execution started (milliseconds since epoch) */
  startedAt: number;
  /** Execution deadline (milliseconds since epoch) - for Durable Object request timeout */
  deadline: number;
}
/**
 * Generate a new trace ID using UUID v4
 *
 * @returns New trace ID
 */
export declare function createTraceId(): string;
/**
 * Generate a new span ID using UUID v4
 *
 * @returns New span ID
 */
export declare function createSpanId(): string;
/**
 * Create an empty debug accumulator
 *
 * @returns Initialized DebugAccumulator
 */
export declare function createDebugAccumulator(): DebugAccumulator;
/**
 * Record an agent execution span in the debug accumulator
 *
 * @param debug - Debug accumulator to update
 * @param agent - Agent name
 * @param spanId - Span ID for this execution
 * @param durationMs - Duration in milliseconds
 * @param parentSpanId - Parent span ID for correlation (optional)
 */
export declare function recordAgentSpan(
  debug: DebugAccumulator,
  agent: string,
  spanId: string,
  durationMs: number,
  parentSpanId?: string
): void;
/**
 * Record a tool call in the debug accumulator
 *
 * @param debug - Debug accumulator to update
 * @param toolCall - Tool call information
 */
export declare function recordToolCall(debug: DebugAccumulator, toolCall: DebugToolCall): void;
/**
 * Add a warning message to debug accumulator
 *
 * @param debug - Debug accumulator to update
 * @param warning - Warning message
 */
export declare function addDebugWarning(debug: DebugAccumulator, warning: string): void;
/**
 * Add an error message to debug accumulator
 *
 * @param debug - Debug accumulator to update
 * @param error - Error message
 */
export declare function addDebugError(debug: DebugAccumulator, error: string): void;
/**
 * Create an ExecutionContext from ParsedInput (backward compatibility)
 *
 * @param input - ParsedInput containing extracted message data
 * @param platform - Platform identifier
 * @returns ExecutionContext with basic initialization
 *
 * @deprecated Use direct ExecutionContext creation instead
 */
export declare function createExecutionContext(
  input: ParsedInput,
  platform?: string
): ExecutionContext;
//# sourceMappingURL=context.d.ts.map
