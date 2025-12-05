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

  // Per-agent token counts (embedded)
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

  // Source information
  /** App that received the webhook */
  appSource: AppSource;
  /** Event type: 'message', 'callback_query', 'issue_comment', 'pr_review', etc. */
  eventType: string;

  // Trigger context
  /** Platform user ID */
  userId?: string;
  /** Platform username */
  username?: string;
  /** Telegram chat ID or GitHub issue number */
  chatId?: string;
  /** GitHub repository (owner/repo) */
  repo?: string;

  // Timing
  /** Timestamp when webhook was received */
  triggeredAt: number;
  /** Timestamp when processing completed */
  completedAt?: number;
  /** Total duration in milliseconds */
  durationMs?: number;

  // Status
  /** Current event status */
  status: EventStatus;
  /** Error type if failed (e.g., 'ValidationError', 'TimeoutError') */
  errorType?: string;
  /** Error message if failed */
  errorMessage?: string;

  // Full content
  /** Full user input text */
  inputText?: string;
  /** Full response text */
  responseText?: string;

  // Classification from router
  /** Router classification result */
  classification?: Classification;

  // Agent execution chain
  /** Full agent execution path with embedded tokens */
  agents: AgentStep[];

  // Token totals (aggregated from all agents)
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
  status: string;
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
  metadata?: Record<string, unknown>;
}

/**
 * Convert DebugContext from chat-agent to AgentStep[] for observability storage.
 *
 * @param debugContext - The debug context from StepProgressTracker
 * @returns Array of AgentStep objects with embedded token counts
 */
export function debugContextToAgentSteps(debugContext: DebugContext): AgentStep[] {
  const steps: AgentStep[] = [];

  for (const flow of debugContext.routingFlow) {
    const step: AgentStep = {
      name: flow.agent,
      type: 'agent',
      duration_ms: flow.durationMs ?? 0,
      input_tokens: flow.tokenUsage?.inputTokens ?? 0,
      output_tokens: flow.tokenUsage?.outputTokens ?? 0,
    };

    // Add optional token fields
    if (flow.tokenUsage?.cachedTokens !== undefined) {
      step.cached_tokens = flow.tokenUsage.cachedTokens;
    }
    if (flow.tokenUsage?.reasoningTokens !== undefined) {
      step.reasoning_tokens = flow.tokenUsage.reasoningTokens;
    }

    // Add error if present
    if (flow.error) {
      step.error = flow.error;
    }

    steps.push(step);
  }

  // Add workers as nested steps under orchestrator (if present)
  if (debugContext.workers && debugContext.workers.length > 0) {
    // Find orchestrator in steps
    const orchestratorIndex = steps.findIndex(
      (s) => s.name === 'orchestrator-agent' || s.name === 'orchestrator'
    );

    const workerSteps: AgentStep[] = debugContext.workers.map((w) => {
      const workerStep: AgentStep = {
        name: w.name,
        type: 'worker',
        duration_ms: w.durationMs ?? 0,
        input_tokens: w.tokenUsage?.inputTokens ?? 0,
        output_tokens: w.tokenUsage?.outputTokens ?? 0,
      };

      if (w.tokenUsage?.cachedTokens !== undefined) {
        workerStep.cached_tokens = w.tokenUsage.cachedTokens;
      }
      if (w.tokenUsage?.reasoningTokens !== undefined) {
        workerStep.reasoning_tokens = w.tokenUsage.reasoningTokens;
      }

      return workerStep;
    });

    const orchestrator = steps[orchestratorIndex];
    if (orchestratorIndex >= 0 && orchestrator) {
      // Nest workers under orchestrator
      orchestrator.workers = workerSteps;
    } else {
      // No orchestrator found, add workers as top-level steps
      steps.push(...workerSteps);
    }
  }

  return steps;
}
