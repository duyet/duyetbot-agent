/**
 * Observability types for tracking webhook events, agent executions, and token usage.
 */
/**
 * Represents a single agent or worker execution step with embedded token counts.
 */
export interface AgentStep {
  /** Agent name: 'router', 'simple-agent', 'orchestrator', etc. */
  name: string;
  /** Whether this is an agent or worker */
  type: 'agent' | 'worker';
  /** Execution duration in milliseconds */
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  cached_tokens?: number;
  reasoning_tokens?: number;
  /** Nested workers (for orchestrator agent) */
  workers?: AgentStep[];
  /** Error message if this step failed */
  error?: string;
}
/**
 * Application source for the event.
 */
export type AppSource = 'telegram-webhook' | 'github-webhook';
/**
 * Event status during lifecycle.
 */
export type EventStatus = 'pending' | 'processing' | 'success' | 'error';
/**
 * Classification result from router agent.
 */
export interface Classification {
  /** Query type: 'simple', 'complex', 'tool_confirmation', etc. */
  type: string;
  /** Category: 'general', 'code', 'research', 'github', 'duyet', etc. */
  category: string;
  /** Complexity level: 'low', 'medium', 'high' */
  complexity: string;
}
/**
 * Complete observability event representing a single webhook request.
 * One row per request in D1 database.
 */
export interface ObservabilityEvent {
  /** Unique event ID (UUID) */
  eventId: string;
  /** Request ID for trace correlation */
  requestId?: string;
  /** App that received the webhook */
  appSource: AppSource;
  /** Event type: 'message', 'callback_query', 'issue_comment', 'pr_review', etc. */
  eventType: string;
  /** Platform user ID */
  userId?: string;
  /** Platform username */
  username?: string;
  /** Telegram chat ID or GitHub issue number */
  chatId?: string;
  /** GitHub repository (owner/repo) */
  repo?: string;
  /** Timestamp when webhook was received */
  triggeredAt: number;
  /** Timestamp when processing completed */
  completedAt?: number;
  /** Total duration in milliseconds */
  durationMs?: number;
  /** Current event status */
  status: EventStatus;
  /** Error type if failed (e.g., 'ValidationError', 'TimeoutError') */
  errorType?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Full user input text */
  inputText?: string;
  /** Full response text */
  responseText?: string;
  /** Router classification result */
  classification?: Classification;
  /** Full agent execution path with embedded tokens */
  agents: AgentStep[];
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  /** Primary model used */
  model?: string;
  /** Extensible metadata (JSON) */
  metadata?: Record<string, unknown>;
}
/**
 * Daily metrics aggregation from the daily_metrics view.
 */
export interface DailyMetric {
  date: string;
  appSource: AppSource;
  totalEvents: number;
  successful: number;
  failed: number;
  avgDurationMs: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
}
/**
 * Category statistics from the category_stats view.
 */
export interface CategoryStat {
  classificationCategory: string;
  total: number;
  avgDurationMs: number;
  totalTokens: number;
}
/**
 * Chat message role types.
 */
export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'tool';
/**
 * A single chat message stored in D1.
 */
export interface ChatMessage {
  /** Auto-generated database ID */
  id?: number;
  /** Optional event ID for webhook correlation */
  eventId?: string;
  /** Session identifier (format: "platform:userId:chatId") */
  sessionId: string;
  /** Message sequence number (0-indexed) */
  sequence: number;
  /** Message role */
  role: ChatMessageRole;
  /** Message content */
  content: string;
  /** Input tokens used for this message */
  inputTokens?: number;
  /** Output tokens generated (for assistant messages) */
  outputTokens?: number;
  /** Timestamp when message was created */
  timestamp: number;
}
/**
 * Session statistics from chat_session_stats view.
 */
export interface ChatSessionStats {
  sessionId: string;
  messageCount: number;
  userMessages: number;
  assistantMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  firstMessageAt: number;
  lastMessageAt: number;
}
/**
 * Token counts structure used during accumulation.
 */
export interface TokenCounts {
  input: number;
  output: number;
  cached?: number;
  reasoning?: number;
}
/**
 * Token usage from chat-agent package (compatible interface).
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
}
/**
 * Worker debug info from chat-agent (compatible interface).
 */
export interface WorkerDebugInfo {
  name: string;
  /** Current execution status (optional to match chat-agent) */
  status?: string;
  durationMs?: number;
  tokenUsage?: TokenUsage;
}
/**
 * Debug context from chat-agent StepProgressTracker (compatible interface).
 */
export interface DebugContext {
  routingFlow: Array<{
    agent: string;
    tools?: string[];
    toolChain?: string[];
    durationMs?: number;
    error?: string;
    status?: string;
    tokenUsage?: TokenUsage;
  }>;
  routerDurationMs?: number;
  totalDurationMs?: number;
  classification?: {
    type?: string;
    category?: string;
    complexity?: string;
  };
  workers?: WorkerDebugInfo[];
  /** Additional debug metadata (accepts any object type for flexibility) */
  metadata?: {
    fallback?: boolean;
    originalError?: string;
    cacheHits?: number;
    cacheMisses?: number;
    toolTimeouts?: number;
    timedOutTools?: string[];
    toolErrors?: number;
    lastToolError?: string;
    tokenUsage?: TokenUsage;
    [key: string]: unknown;
  };
}
/**
 * Convert DebugContext from chat-agent to AgentStep[] for observability storage.
 *
 * @param debugContext - The debug context from StepProgressTracker
 * @returns Array of AgentStep objects with embedded token counts
 */
export declare function debugContextToAgentSteps(debugContext: DebugContext): AgentStep[];
//# sourceMappingURL=types.d.ts.map
