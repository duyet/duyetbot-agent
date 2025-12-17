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

/**
 * Base step properties shared by all step types
 */
interface BaseStep {
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
interface ThinkingStep extends BaseStep {
  type: 'thinking';
  /** Thinking/reasoning text from LLM */
  thinking?: string;
}

/**
 * Tool start step - tool execution beginning
 */
interface ToolStartStep extends BaseStep {
  type: 'tool_start';
  /** Tool name (required for tool steps) */
  toolName: string;
  /** Tool arguments */
  args?: Record<string, unknown>;
}

/**
 * Tool complete step - tool finished successfully
 */
interface ToolCompleteStep extends BaseStep {
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
interface ToolErrorStep extends BaseStep {
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
interface ToolExecutionStep extends BaseStep {
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
interface RoutingStep extends BaseStep {
  type: 'routing';
  /** Agent name (required for routing steps) */
  agentName: string;
}

/**
 * LLM iteration step - multi-turn conversation
 */
interface LlmIterationStep extends BaseStep {
  type: 'llm_iteration';
  /** Max iterations for progress display */
  maxIterations?: number;
}

/**
 * Preparing step - finalizing response
 */
interface PreparingStep extends BaseStep {
  type: 'preparing';
}

/**
 * Responding step - sending response
 */
interface RespondingStep extends BaseStep {
  type: 'responding';
}

/**
 * Discriminated union of all execution step types
 * TypeScript will enforce required fields based on the 'type' discriminator
 */
export type ExecutionStep =
  | ThinkingStep
  | ToolStartStep
  | ToolCompleteStep
  | ToolErrorStep
  | ToolExecutionStep
  | RoutingStep
  | LlmIterationStep
  | PreparingStep
  | RespondingStep;

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
  /**
   * Detailed execution steps for chain display
   * Shows thinking text, tool calls, and results in order
   */
  steps?: ExecutionStep[];
}

/**
 * Progress callback interface for real-time execution updates
 *
 * Used to emit progress events during agent execution for:
 * - Real-time message editing (showing tool chain as it executes)
 * - Accumulating steps for debug footer
 */
export interface ProgressCallback {
  /** Emit thinking/reasoning text from LLM */
  onThinking: (text: string) => Promise<void>;
  /** Emit tool execution start */
  onToolStart: (toolName: string, args: Record<string, unknown>) => Promise<void>;
  /** Emit tool execution completion */
  onToolComplete: (toolName: string, result: string, durationMs: number) => Promise<void>;
  /** Emit tool execution error */
  onToolError: (toolName: string, error: string, durationMs?: number) => Promise<void>;
}

/**
 * Progress entry for accumulating execution chain
 */
export interface ProgressEntry {
  type: 'thinking' | 'tool_start' | 'tool_complete' | 'tool_error';
  message: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  durationMs?: number;
  timestamp: number;
}

// Re-export step progress types for convenience
export type {
  StepEvent,
  StepProgressConfig,
  StepType,
} from './workflow/step-tracker.js';
export { StepProgressTracker } from './workflow/step-tracker.js';
