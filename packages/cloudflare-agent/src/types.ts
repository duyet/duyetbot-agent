/**
 * Core types for the chat agent
 */

import type { MemoryAdapter } from './memory-adapter.js';

/**
 * Message role in conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * A message in the conversation history
 */
export interface Message {
  role: MessageRole;
  content: string;
  toolCallId?: string;
  name?: string;
}

/**
 * Message format for LLM APIs (OpenAI-compatible)
 */
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

/**
 * Tool definition for function calling
 */
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Tool formatted for OpenAI-compatible APIs
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * A tool call from the LLM
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * Token usage metrics from LLM response
 */
export interface TokenUsage {
  /** Input/prompt tokens consumed */
  inputTokens: number;
  /** Output/completion tokens generated */
  outputTokens: number;
  /** Total tokens (input + output) */
  totalTokens: number;
  /** Cached prompt tokens (prompt cache hits) */
  cachedTokens?: number;
  /** Reasoning tokens (o1/o3 internal reasoning) */
  reasoningTokens?: number;
  /** Actual cost in USD from provider API (e.g., OpenRouter usage.cost) */
  actualCostUsd?: number;
  /** Estimated cost in USD (calculated from model pricing) */
  estimatedCostUsd?: number;
}

/**
 * Web search citation from LLM provider (OpenRouter annotations)
 * @see https://openrouter.ai/docs/guides/features/web-search.md
 */
export interface Citation {
  /** Source URL */
  url: string;
  /** Page title */
  title: string;
  /** Snippet/excerpt from the page (optional) */
  content?: string;
}

/**
 * Response from LLM provider
 */
export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  /** Token usage metrics */
  usage?: TokenUsage;
  /** Model identifier used for the response */
  model?: string;
  /** Web search citations (from OpenRouter annotations) */
  citations?: Citation[];
}

/**
 * OpenRouter web search plugin configuration
 * @deprecated Use ChatOptions.webSearch instead with :online model suffix
 */
export interface WebSearchPlugin {
  id: 'web';
  engine?: 'native' | 'exa';
  max_results?: number;
}

/**
 * Options for LLM chat requests
 */
export interface ChatOptions {
  /**
   * Enable web search by appending :online suffix to model name.
   * This is the recommended approach as it works reliably through
   * Cloudflare AI Gateway to OpenRouter.
   *
   * When enabled, xAI/OpenAI/Anthropic models use native search,
   * other models use Exa-powered search.
   *
   * @see https://openrouter.ai/docs/guides/features/web-search
   */
  webSearch?: boolean;

  /**
   * OpenRouter plugins (e.g., web search)
   * @deprecated Use webSearch: true instead - plugins may not pass through AI Gateway
   */
  plugins?: WebSearchPlugin[];
}

/**
 * LLM provider interface - implement this for different backends
 */
export interface LLMProvider {
  chat(messages: LLMMessage[], tools?: OpenAITool[], options?: ChatOptions): Promise<LLMResponse>;
  /**
   * Stream chat response with tokens as they arrive
   * Each yielded response contains partial content or tool calls
   */
  streamChat?(
    messages: LLMMessage[],
    tools?: OpenAITool[],
    options?: ChatOptions
  ): AsyncIterable<LLMResponse>;
}

/**
 * Tool executor function type
 */
export type ToolExecutor = (call: ToolCall) => Promise<string>;

/**
 * Configuration for ChatAgent
 */
export interface ChatAgentConfig {
  /** LLM provider for making API calls */
  llmProvider: LLMProvider;
  /** System prompt for the agent */
  systemPrompt: string;
  /** Maximum messages to keep in history (default: 20) */
  maxHistory?: number;
  /** Available tools for the agent */
  tools?: Tool[];
  /** Function to execute tool calls */
  onToolCall?: ToolExecutor;
  /** Maximum tool call iterations (default: 5) */
  maxToolIterations?: number;
  /** Optional memory adapter for persistence */
  memoryAdapter?: MemoryAdapter | undefined;
  /** Session ID for memory persistence */
  sessionId?: string;
  /** Auto-save messages after each chat (default: true when adapter is set) */
  autoSave?: boolean;
}

/**
 * Agent state that can be persisted
 */
export interface AgentState {
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Debug metadata for agent execution
 * Includes index signature for compatibility with observability package
 */
export interface DebugMetadata {
  /** Whether response is a fallback due to error */
  fallback?: boolean;
  /** Original error message if fallback */
  originalError?: string;
  /** Cache statistics */
  cacheHits?: number;
  cacheMisses?: number;
  /** Tool timeout count */
  toolTimeouts?: number;
  /** Tools that timed out */
  timedOutTools?: string[];
  /** Tool error count */
  toolErrors?: number;
  /** Last tool error message (truncated) */
  lastToolError?: string;
  /** Aggregated token usage for entire request */
  tokenUsage?: TokenUsage;
  /** Primary model used for generation (e.g., 'claude-3-5-sonnet-20241022') */
  model?: string;
  /** Trace ID for log correlation */
  traceId?: string;
  /** Request ID from platform */
  requestId?: string;
  /** Whether web search was enabled for this request */
  webSearchEnabled?: boolean;
  /** Web search citations from the response */
  citations?: Citation[];
  /** Index signature for extensibility */
  [key: string]: unknown;
}

/**
 * Execution status for progressive debug footer updates
 */
export type ExecutionStatus = 'running' | 'completed' | 'error';

/**
 * Worker execution info for orchestrator debug context
 */
export interface WorkerDebugInfo {
  /** Worker name (e.g., 'code-worker', 'research-worker') */
  name: string;
  /** Execution duration in milliseconds */
  durationMs?: number;
  /** Current execution status */
  status?: ExecutionStatus;
  /** Token usage for this worker */
  tokenUsage?: TokenUsage;
}

/**
 * Progress callback for real-time execution updates
 */
export interface ProgressCallback {
  onThinking: (text: string) => Promise<void>;
  onToolStart: (toolName: string, args: Record<string, unknown>) => Promise<void>;
  onToolComplete: (toolName: string, result: string, durationMs: number) => Promise<void>;
  onToolError: (toolName: string, error: string, durationMs?: number) => Promise<void>;
}

/**
 * Debug context for routing/orchestration tracing
 * Used by admin users to see agent flow and timing
 */

/**
 * Base step properties shared by all step types
 */
export interface BaseStep {
  /** Step iteration number */
  iteration: number;
  /** Timestamp when step occurred (optional for backwards compat) */
  timestamp?: number;
  /** Duration in milliseconds */
  durationMs?: number;
}

/**
 * Thinking step - LLM is reasoning
 */
export interface ThinkingStep extends BaseStep {
  type: 'thinking';
  /** Thinking/reasoning text from LLM */
  thinking?: string;
}

/**
 * Tool start step - tool execution beginning
 */
export interface ToolStartStep extends BaseStep {
  type: 'tool_start';
  /** Tool name (required for tool steps) */
  toolName: string;
  /** Tool arguments */
  args?: Record<string, unknown>;
}

/**
 * Tool complete step - tool finished successfully
 */
export interface ToolCompleteStep extends BaseStep {
  type: 'tool_complete';
  /** Tool name (required for tool steps) */
  toolName: string;
  /** Tool arguments */
  args?: Record<string, unknown>;
  /** Tool result */
  result: string | { success?: boolean; output?: string; durationMs?: number; error?: string };
}

/**
 * Tool error step - tool execution failed
 */
export interface ToolErrorStep extends BaseStep {
  type: 'tool_error';
  /** Tool name (required for tool steps) */
  toolName: string;
  /** Tool arguments */
  args?: Record<string, unknown>;
  /** Error message (required for error steps) */
  error: string;
}

/**
 * Tool execution step - combined start/complete (for display)
 */
export interface ToolExecutionStep extends BaseStep {
  type: 'tool_execution';
  /** Tool name (required for tool steps) */
  toolName: string;
  /** Tool arguments */
  args?: Record<string, unknown>;
  /** Tool result */
  result?: string | { success?: boolean; output?: string; durationMs?: number; error?: string };
}

/**
 * Routing step - agent handoff
 */
export interface RoutingStep extends BaseStep {
  type: 'routing';
  /** Agent name (required for routing steps) */
  agentName: string;
}

/**
 * Execution step with timestamp for D1 persistence
 * Combines ExecutionStep properties with timestamp
 */
export interface ExecutionStepWithTimestamp {
  /** Step iteration number */
  iteration: number;
  /** Timestamp when step occurred */
  timestamp: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Step discriminator type */
  type:
    | 'thinking'
    | 'tool_start'
    | 'tool_complete'
    | 'tool_error'
    | 'tool_execution'
    | 'routing'
    | 'llm_iteration'
    | 'preparing'
    | 'responding';
  /** Additional step properties */
  [key: string]: unknown;
}

/**
 * Execution summary for completing an execution
 */
export interface ExecutionSummary {
  /** Final response content */
  finalResponse: string;
  /** Completion timestamp */
  completedAt: number;
  /** Token usage */
  tokenUsage?: TokenUsage | undefined;
  /** Duration in milliseconds */
  duration?: number | undefined;
  /** Model used */
  model?: string;
}

/**
 * Complete execution chain with steps
 */
export interface ExecutionChain {
  /** Execution ID */
  id: string;
  /** Execution ID (alias for compatibility) */
  executionId: string;
  /** Session ID */
  sessionId: string;
  /** User message that triggered execution */
  userMessage: string;
  /** Final assistant response */
  finalResponse: string;
  /** When execution started */
  startedAt: number;
  /** When execution completed */
  completedAt?: number;
  /** Execution status */
  status: 'running' | 'completed' | 'error';
  /** Execution steps */
  steps: ExecutionStepWithTimestamp[];
  /** Token usage */
  tokenUsage?: TokenUsage | undefined;
  /** Duration in milliseconds */
  duration?: number | undefined;
  /** Model used */
  model?: string;
}

/**
 * Execution summary for completing an execution
 */
export interface ExecutionSummary {
  /** Final response content */
  finalResponse: string;
  /** Completion timestamp */
  completedAt: number;
  /** Token usage */
  tokenUsage?: TokenUsage;
  /** Duration in milliseconds */
  duration?: number;
  /** Model used */
  model?: string;
}

/**
 * Complete execution chain with steps
 */
export interface ExecutionChain {
  /** Execution ID */
  id: string;
  /** Session ID */
  sessionId: string;
  /** User message that triggered the execution */
  userMessage: string;
  /** Final assistant response */
  finalResponse: string;
  /** When execution started */
  startedAt: number;
  /** When execution completed */
  completedAt?: number;
  /** Execution status */
  status: 'running' | 'completed' | 'error';
  /** Execution steps */
  steps: ExecutionStepWithTimestamp[];
  /** Token usage */
  tokenUsage?: TokenUsage;
  /** Duration in milliseconds */
  duration?: number;
  /** Model used */
  model?: string;
}

// Re-export debug context types
export type { DebugContext } from './workflow/debug-footer.js';
// Re-export step progress types for convenience
export type {
  StepEvent,
  StepProgressConfig,
  StepType,
} from './workflow/step-tracker.js';
export { StepProgressTracker } from './workflow/step-tracker.js';

// Execution step union for use across codebase
export type ExecutionStep =
  | {
      iteration: number;
      type: 'thinking';
      thinking?: string;
      timestamp?: number;
      durationMs?: number;
    }
  | {
      iteration: number;
      type: 'tool_start';
      toolName: string;
      args?: Record<string, unknown>;
      timestamp?: number;
      durationMs?: number;
    }
  | {
      iteration: number;
      type: 'tool_complete';
      toolName: string;
      args?: Record<string, unknown>;
      result: string | { success?: boolean; output?: string; durationMs?: number; error?: string };
      timestamp?: number;
      durationMs?: number;
    }
  | {
      iteration: number;
      type: 'tool_error';
      toolName: string;
      args?: Record<string, unknown>;
      error: string;
      timestamp?: number;
      durationMs?: number;
    }
  | {
      iteration: number;
      type: 'tool_execution';
      toolName: string;
      args?: Record<string, unknown>;
      result?: string | { success?: boolean; output?: string; durationMs?: number; error?: string };
      timestamp?: number;
      durationMs?: number;
    }
  | {
      iteration: number;
      type: 'routing';
      agentName: string;
      timestamp?: number;
      durationMs?: number;
    }
  | { iteration: number; type: 'llm_iteration'; timestamp?: number; durationMs?: number }
  | { iteration: number; type: 'preparing'; timestamp?: number; durationMs?: number }
  | { iteration: number; type: 'responding'; timestamp?: number; durationMs?: number };
