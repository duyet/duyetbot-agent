/**
 * Analytics Types
 *
 * Comprehensive type definitions for message and agent step tracking.
 * All data is append-only - never deleted, only archived.
 */

/**
 * Core analytics message type
 * Represents a single message in a conversation
 */
export interface AnalyticsMessage {
  id: number;
  messageId: string; // UUID v7 for time-ordering
  sessionId: string;
  conversationId?: string;
  parentMessageId?: string;

  sequence: number; // Sequential message number within session
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  contentHash?: string; // First 16 chars of SHA-256 for dedup checking

  visibility: 'private' | 'public' | 'unlisted';
  isArchived: boolean;
  isPinned: boolean;

  eventId?: string; // Correlation ID for this conversation thread
  triggerMessageId?: string; // Parent message that triggered this response
  platformMessageId?: string; // Original message ID from platform (Telegram, GitHub)

  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  totalTokens: number;

  platform: 'telegram' | 'github' | 'cli' | 'api';
  userId: string;
  username?: string;
  chatId?: string;
  repo?: string;
  model?: string;

  createdAt: number; // milliseconds since epoch
  updatedAt: number; // milliseconds since epoch
  metadata?: Record<string, unknown>; // Additional platform-specific data
}

/**
 * Agent step type
 * Represents a single step in agent execution (routing, thinking, tool use)
 */
export interface AnalyticsAgentStep {
  id: number;
  stepId: string; // UUID v7
  eventId: string; // Correlation ID for this conversation
  messageId: string | null; // Associated message (if any)
  parentStepId: string | null; // Parent step in decomposition chain

  agentName: string; // e.g., "router-agent", "code-worker"
  agentType: 'agent' | 'worker';
  sequence: number; // Order within this event

  startedAt: number;
  completedAt: number;
  durationMs: number;
  queueTimeMs: number;

  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled';

  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;

  errorType: string | null; // Error classification
  errorMessage: string | null; // Error details
  retryCount: number;

  model: string | null;
  toolsUsed: string[] | null;
  toolCallsCount: number;

  metadata: Record<string, unknown> | null;
  createdAt: number;
}

/**
 * Input type for creating a new message
 */
export interface MessageCreateInput {
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  platform: 'telegram' | 'github' | 'cli' | 'api';
  userId: string;
  username?: string;
  chatId?: string;
  eventId?: string;
  triggerMessageId?: string;
  platformMessageId?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  model?: string;
  visibility?: 'private' | 'public' | 'unlisted';
  conversationId?: string;
  parentMessageId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input type for starting an agent step
 */
export interface StepCreateInput {
  eventId: string;
  messageId?: string;
  agentName: string;
  agentType: 'agent' | 'worker';
  parentStepId?: string;
  sequence: number;
}

/**
 * Step completion data
 */
export interface StepCompletion {
  status: 'success' | 'error';
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  model?: string;
  toolsUsed?: string[];
  toolCallsCount?: number;
  errorType?: string;
  errorMessage?: string;
}

/**
 * Period type for aggregations
 */
export type PeriodType = 'hour' | 'day' | 'week' | 'month';

/**
 * Types of aggregations supported
 */
export type AggregateType =
  | 'user_hourly'
  | 'user_daily'
  | 'user_weekly'
  | 'user_monthly'
  | 'platform_daily'
  | 'model_daily'
  | 'agent_daily'
  | 'conversation_daily';

/**
 * Token usage summary
 */
export interface TokenUsageSummary {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  messageCount: number;
  eventCount: number;
  estimatedCostUsd: number;
}

/**
 * Message query filters
 */
export interface MessageQueryFilter {
  sessionId?: string;
  userId?: string;
  platform?: 'telegram' | 'github' | 'cli' | 'api';
  role?: 'user' | 'assistant' | 'system' | 'tool';
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}

/**
 * Agent step query filters
 */
export interface StepQueryFilter {
  eventId?: string;
  agentName?: string;
  status?: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}

/**
 * Pending step tracking (internal use)
 */
export interface PendingStep {
  stepId: string;
  eventId: string;
  messageId: string | null;
  agentName: string;
  agentType: 'agent' | 'worker';
  parentStepId: string | null;
  sequence: number;
  startedAt: number;
  status: 'running';
}
