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
 * Debug context for routing/orchestration tracing
 * Used by admin users to see agent flow and timing
 */
export interface DebugContext {
  /** Routing flow showing agent -> agent transitions */
  routingFlow: Array<{
    /** Agent name (e.g., 'router', 'simple-agent', 'orchestrator') */
    agent: string;
    /** Tools used by this agent (if any) - kept for backwards compat */
    tools?: string[];
    /** Ordered tool execution chain (e.g., ['duyet_cv', 'get_posts']) */
    toolChain?: string[];
    /** Execution duration for this step in milliseconds */
    durationMs?: number;
    /** Error message if this agent failed */
    error?: string;
    /** Current execution status for progressive updates */
    status?: ExecutionStatus;
    /** Token usage for this routing step */
    tokenUsage?: TokenUsage;
    /** Model used for this routing step (e.g., 'claude-3-5-sonnet-20241022') */
    model?: string;
  }>;
  /** Router classification duration in milliseconds (separate from agent execution) */
  routerDurationMs?: number;
  /** Total execution duration in milliseconds */
  totalDurationMs?: number;
  /** Query classification details */
  classification?: {
    /** Query type (simple, complex, tool_confirmation) */
    type: string;
    /** Query category (general, code, research, github, admin) */
    category: string;
    /** Complexity level (low, medium, high) */
    complexity: string;
  };
  /** Worker execution details for orchestrator (displayed as nested list) */
  workers?: WorkerDebugInfo[];
  /** Additional debug metadata (fallback, cache, timeout) */
  metadata?: DebugMetadata;
  /** Execution path trace for step-by-step debugging */
  executionPath?: string[];
}

// Re-export step progress types for convenience
export type {
  StepEvent,
  StepProgressConfig,
  StepType,
} from './workflow/step-tracker.js';
export { StepProgressTracker } from './workflow/step-tracker.js';
