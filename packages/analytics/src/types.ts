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
  repo?: string;
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

/**
 * Analytics conversation type
 */
export interface AnalyticsConversation {
  id: number;
  conversationId: string;
  userId: string;
  platform: 'telegram' | 'github' | 'cli' | 'api';
  title?: string;
  summary?: string;
  visibility: 'private' | 'public' | 'unlisted';
  isArchived: boolean;
  isStarred: boolean;
  messageCount: number;
  sessionCount: number;
  totalTokens: number;
  firstMessageAt?: number;
  lastMessageAt?: number;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * Alias for AnalyticsConversation
 */
export type Conversation = AnalyticsConversation;

/**
 * Daily aggregate type
 */
export interface DailyAggregate {
  id: number;
  aggregateType: AggregateType;
  aggregateKey: string;
  periodType: PeriodType;
  periodStart: number;
  periodEnd: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  eventCount: number;
  sessionCount: number;
  successCount: number;
  errorCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs?: number;
  maxDurationMs?: number;
  p50DurationMs?: number;
  p95DurationMs?: number;
  p99DurationMs?: number;
  estimatedCostUsd: number;
  lastComputedAt: number;
  computationDurationMs?: number;
  createdAt: number;
}

/**
 * Token aggregate (alias for DailyAggregate)
 */
export type TokenAggregate = DailyAggregate;

/**
 * Cost configuration for model pricing
 */
export interface CostConfig {
  id: number;
  model: string;
  provider: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
  cachedCostPer1k: number;
  reasoningCostPer1k: number;
  effectiveFrom: number;
  effectiveTo?: number;
  notes?: string;
  createdAt: number;
  createdBy?: string;
}

/**
 * Date range for queries
 */
export interface DateRange {
  from: number;
  to: number;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Query options with pagination and date range
 */
export interface QueryOptions extends PaginationOptions {
  dateRange?: DateRange;
}

/**
 * Search options
 */
export interface SearchOptions extends PaginationOptions {
  dateRange?: DateRange;
  platform?: 'telegram' | 'github' | 'cli' | 'api';
  visibility?: 'private' | 'public' | 'unlisted';
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Session stats
 */
export interface SessionStats {
  sessionId: string;
  messageCount: number;
  userMessages: number;
  assistantMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  firstMessageAt?: number;
  lastMessageAt?: number;
  durationMs?: number;
}

/**
 * User stats
 */
export interface UserStats {
  userId: string;
  messageCount: number;
  sessionCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

/**
 * Agent step hierarchy (nested structure)
 */
export interface AgentStepHierarchy {
  step: AnalyticsAgentStep;
  children: AgentStepHierarchy[];
}

/**
 * Agent performance stats
 */
export interface AgentPerformanceStats {
  agentName: string;
  totalExecutions: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgTokensPerExecution: number;
}

/**
 * Time series data point
 */
export interface TimeSeriesData {
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  messageCount: number;
}

/**
 * Platform stats
 */
export interface PlatformStats {
  platform: 'telegram' | 'github' | 'cli' | 'api';
  messageCount: number;
  userCount: number;
  sessionCount: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

/**
 * Model usage stats
 */
export interface ModelUsageStats {
  model: string;
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}
