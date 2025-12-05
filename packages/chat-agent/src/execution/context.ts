/**
 * ExecutionContext and related types
 *
 * Provides execution context for agent operations in the Durable Object architecture.
 * Tracks trace identifiers, platform origin, message references, timing, and debug information.
 */

import { randomUUID } from 'node:crypto';
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
  // Trace Identifiers
  /** Unique trace ID for correlating all spans in this execution */
  traceId: string;
  /** Current span ID for this agent execution */
  spanId: string;
  /** Parent span ID for correlation with parent agent */
  parentSpanId?: string;
  /** Event ID for D1 observability correlation (full UUID from webhook) */
  eventId?: string;

  // Platform Origin
  /** Platform where message originated */
  platform: Platform;
  /** User ID from the platform */
  userId: string | number;
  /** Chat/conversation ID from the platform */
  chatId: string | number;
  /** Optional username (not all platforms provide) */
  username?: string;

  // Message References
  /** Message ID from user's message (can be string or number depending on platform) */
  userMessageId: string | number;
  /** Message ID of agent's response (can be string or number depending on platform) */
  responseMessageId?: string | number;

  // Provider Information
  /** LLM provider name (e.g., 'claude', 'openrouter') */
  provider: string;
  /** Model name (e.g., 'claude-opus', 'claude-sonnet') */
  model: string;

  // Input
  /** User's input query */
  query: string;
  /** Conversation history up to this message */
  conversationHistory: Message[];

  // Debug
  /** Debug information accumulator */
  debug: DebugAccumulator;

  // Timing
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
export function createTraceId(): string {
  return randomUUID();
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
 * Create an empty debug accumulator
 *
 * @returns Initialized DebugAccumulator
 */
export function createDebugAccumulator(): DebugAccumulator {
  return {
    agentChain: [],
    toolCalls: [],
    warnings: [],
    errors: [],
  };
}

/**
 * Record an agent execution span in the debug accumulator
 *
 * @param debug - Debug accumulator to update
 * @param agent - Agent name
 * @param spanId - Span ID for this execution
 * @param durationMs - Duration in milliseconds
 * @param parentSpanId - Parent span ID for correlation (optional)
 */
export function recordAgentSpan(
  debug: DebugAccumulator,
  agent: string,
  spanId: string,
  durationMs: number,
  parentSpanId?: string
): void {
  debug.agentChain.push({
    agent,
    spanId,
    ...(parentSpanId && { parentSpanId }),
    durationMs,
    timestamp: Date.now(),
  });
}

/**
 * Record a tool call in the debug accumulator
 *
 * @param debug - Debug accumulator to update
 * @param toolCall - Tool call information
 */
export function recordToolCall(debug: DebugAccumulator, toolCall: DebugToolCall): void {
  debug.toolCalls.push(toolCall);
}

/**
 * Add a warning message to debug accumulator
 *
 * @param debug - Debug accumulator to update
 * @param warning - Warning message
 */
export function addDebugWarning(debug: DebugAccumulator, warning: string): void {
  debug.warnings.push(warning);
}

/**
 * Add an error message to debug accumulator
 *
 * @param debug - Debug accumulator to update
 * @param error - Error message
 */
export function addDebugError(debug: DebugAccumulator, error: string): void {
  debug.errors.push(error);
}

/**
 * Create an ExecutionContext from ParsedInput (backward compatibility)
 *
 * @param input - ParsedInput containing extracted message data
 * @param platform - Platform identifier
 * @returns ExecutionContext with basic initialization
 *
 * @deprecated Use direct ExecutionContext creation instead
 */
export function createExecutionContext(input: ParsedInput, platform?: string): ExecutionContext {
  const traceId = createTraceId();
  const spanId = createSpanId();
  const eventId = input.metadata?.eventId as string | undefined;
  return {
    traceId,
    spanId,
    ...(eventId && { eventId }),
    platform: (platform || 'api') as Platform,
    userId: input.userId,
    chatId: input.chatId,
    ...(input.username && { username: input.username }),
    userMessageId: input.messageRef || 0,
    provider: 'claude',
    model: 'claude-3-5-sonnet-20241022',
    query: input.text,
    conversationHistory: [],
    debug: createDebugAccumulator(),
    startedAt: Date.now(),
    deadline: Date.now() + 30000,
  };
}
