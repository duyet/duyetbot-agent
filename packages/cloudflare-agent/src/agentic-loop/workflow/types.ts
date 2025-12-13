/**
 * Workflow-Based AgenticLoop Type Definitions
 *
 * Types for the Cloudflare Workflow-based agentic loop that eliminates
 * the 30-second DO timeout constraint by running iterations as durable steps.
 *
 * Key differences from synchronous AgenticLoop:
 * - Each iteration is a separate workflow step with automatic persistence
 * - Progress is reported via HTTP to the CloudflareAgent DO
 * - State is serializable for cross-step persistence
 * - Tools execute in-step (within the 30s per-step budget)
 */

import type { LoopMessage, LoopTool } from '../types.js';

/**
 * JSON-safe primitive types for workflow serialization
 * Note: We avoid recursive types to prevent "Type instantiation is excessively deep"
 * errors when combined with Cloudflare's Serializable<T> mapped type.
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * JSON-safe record type for workflow serialization
 * Uses 'any' at the leaf level to avoid recursive type instantiation issues
 * with Cloudflare's Serializable<T> type. The actual values are JSON-safe.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonRecord = Record<string, any>;

/**
 * Alias for backwards compatibility
 */
export type JsonValue = JsonPrimitive | JsonRecord | JsonValue[];

/**
 * Simplified tool result for debug context
 * (Doesn't need the full ToolResult type)
 */
export interface WorkflowToolResult {
  success: boolean;
  output: string;
  durationMs: number;
  error?: string;
}

// ============================================================================
// Workflow Parameters
// ============================================================================

/**
 * Parameters passed to the AgenticLoopWorkflow when created
 *
 * These params are serialized and stored with the workflow instance,
 * available via event.payload in the run() method.
 */
export interface AgenticLoopWorkflowParams {
  /** Unique execution ID for tracking and correlation */
  executionId: string;

  /** User's query/message to process */
  query: string;

  /** System prompt for the agent */
  systemPrompt?: string;

  /** Conversation history for context */
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;

  /** Maximum iterations before stopping (safety limit) */
  maxIterations: number;

  /** Tool definitions (serialized for workflow storage) */
  tools: SerializedTool[];

  /** Progress callback configuration for reporting back to DO */
  progressCallback: ProgressCallbackConfig;

  /** Platform identifier (telegram, github) */
  platform: 'telegram' | 'github';

  /** Chat/conversation ID for the platform */
  chatId: string;

  /** Message ID to edit with progress/final response */
  messageId: number;

  /** Whether this workflow is a subagent (prevents recursive spawning) */
  isSubagent?: boolean;

  /** Parent workflow ID if this is a subagent */
  parentWorkflowId?: string;

  /** Trace ID for debugging */
  traceId?: string;
}

/**
 * Serialized tool definition for workflow storage
 *
 * Tools can't be serialized with their execute functions, so we store
 * just the metadata and recreate the tools at runtime.
 */
export interface SerializedTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    description?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

/**
 * Configuration for progress reporting back to CloudflareAgent DO
 */
export interface ProgressCallbackConfig {
  /** DO namespace name (for getting stub) */
  doNamespace: string;
  /** DO instance ID (hex string from ctx.id) */
  doId: string;
  /** Execution ID for correlation */
  executionId: string;
}

// ============================================================================
// Progress Updates
// ============================================================================

/**
 * Information about a tool in parallel execution
 */
export interface ParallelToolInfo {
  /** Unique tool call ID */
  id: string;

  /** Tool name */
  name: string;

  /** Stringified tool arguments for display */
  argsStr: string;

  /** Tool execution result (when completed) */
  result?: {
    /** Result status */
    status: 'completed' | 'error';
    /** Result summary */
    summary: string;
    /** Duration in ms */
    durationMs?: number;
  };
}

/**
 * Progress update sent to CloudflareAgent DO during execution
 */
export interface WorkflowProgressUpdate {
  /** Type of progress event */
  type:
    | 'thinking'
    | 'tool_start'
    | 'tool_complete'
    | 'tool_error'
    | 'parallel_tools_start'
    | 'parallel_tool_complete'
    | 'responding';

  /** Current iteration (0-indexed) */
  iteration: number;

  /** Human-readable message */
  message: string;

  /** Tool name (for tool_* events) */
  toolName?: string;

  /** Tool arguments for display (for tool_* events) */
  toolArgs?: Record<string, unknown>;

  /** Tool result for display (for tool_complete events) */
  toolResult?: string;

  /** Duration in ms (for tool_complete/tool_error) */
  durationMs?: number;

  /** Timestamp of this update */
  timestamp: number;

  /** Parallel tools info (for parallel_tools_start and parallel_tool_complete) */
  parallelTools?: ParallelToolInfo[];

  /** Tool call ID (for parallel_tool_complete) */
  toolCallId?: string;
}

/**
 * Completion result sent to CloudflareAgent DO when workflow finishes
 */
export interface WorkflowCompletionResult {
  /** Whether the workflow completed successfully */
  success: boolean;

  /** Final response text */
  response: string;

  /** Number of iterations executed */
  iterations: number;

  /** Tools that were used */
  toolsUsed: string[];

  /** Total execution time */
  totalDurationMs: number;

  /** Token usage if available */
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };

  /** Error message if failed */
  error?: string;

  /** Debug context for observability */
  debugContext?: WorkflowDebugContext;
}

/**
 * Debug context capturing execution details
 */
export interface WorkflowDebugContext {
  steps: Array<{
    iteration: number;
    type: 'thinking' | 'tool_execution';
    toolName?: string;
    args?: JsonRecord;
    result?: WorkflowToolResult;
    thinking?: string;
  }>;
}

// ============================================================================
// Workflow Step State
// ============================================================================

/**
 * State persisted between workflow steps
 *
 * Each step.do() returns this state, which is automatically
 * persisted by the workflow engine.
 */
export interface IterationStepResult {
  /** Whether the loop should terminate */
  done: boolean;

  /** Final response (only when done=true) */
  response?: string;

  /** Updated message history */
  messages: LoopMessage[];

  /** Tools used so far */
  toolsUsed: string[];

  /** Token usage accumulated */
  tokenUsage: {
    input: number;
    output: number;
  };

  /** Debug steps for this iteration */
  debugSteps: Array<{
    iteration: number;
    type: 'thinking' | 'tool_execution';
    toolName?: string;
    args?: JsonRecord;
    result?: WorkflowToolResult;
    thinking?: string;
  }>;
}

// ============================================================================
// LLM Response Types (for workflow context)
// ============================================================================

/**
 * Tool call from LLM response
 */
export interface WorkflowToolCall {
  id: string;
  name: string;
  arguments: JsonRecord;
}

/**
 * LLM response within workflow context
 */
export interface WorkflowLLMResponse {
  content: string;
  toolCalls?: WorkflowToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ============================================================================
// Workflow Binding Types
// ============================================================================

/**
 * Environment bindings required by AgenticLoopWorkflow
 *
 * These bindings mirror what's expected by @duyetbot/providers.
 * The AI binding provides the gateway() method for constructing AI Gateway URLs.
 *
 * @see https://developers.cloudflare.com/ai-gateway/
 */
export interface AgenticLoopWorkflowEnv {
  /**
   * Cloudflare AI binding with gateway support
   *
   * The gateway() method is used to construct AI Gateway URLs for
   * routing requests through Cloudflare's AI Gateway to providers like OpenRouter.
   */
  AI: {
    /** Workers AI run method (not used - we use AI Gateway instead) */
    run: (model: string, options: unknown) => Promise<unknown>;
    /** Get AI Gateway instance for URL construction */
    gateway: (gatewayId: string) => {
      getUrl: (provider: string) => Promise<string>;
    };
  };

  /**
   * Platform-specific DO bindings for progress callbacks
   *
   * The workflow uses cross-script bindings to call back to the originating
   * app's CloudflareAgent (TelegramAgent or GitHubAgent) for message updates.
   */

  /** TelegramAgent DO binding (from duyetbot-telegram) */
  TelegramAgent?: {
    idFromName: (name: string) => unknown;
    get: (id: unknown) => { fetch: (req: Request) => Promise<Response> };
  };

  /** GitHubAgent DO binding (from duyetbot-github) */
  GitHubAgent?: {
    idFromName: (name: string) => unknown;
    get: (id: unknown) => { fetch: (req: Request) => Promise<Response> };
  };

  /** Model to use for LLM calls (e.g., '@preset/duyetbot', 'anthropic/claude-sonnet-4') */
  MODEL?: string;

  /** AI Gateway name configured in Cloudflare dashboard (required) */
  AI_GATEWAY_NAME: string;

  /** AI Gateway API key for BYOK authentication (required) */
  AI_GATEWAY_API_KEY: string;

  /** GitHub token for GitHub tools */
  GITHUB_TOKEN?: string;

  /** Memory MCP URL for memory tool */
  MEMORY_MCP_URL?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Serialize LoopTool array for workflow storage
 *
 * Strips execute functions since they can't be serialized.
 * Tools are recreated at runtime using createCoreTools().
 */
export function serializeTools(tools: LoopTool[]): SerializedTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

/**
 * Check if a message is a tool result
 */
export function isToolResultMessage(
  msg: LoopMessage
): msg is LoopMessage & { role: 'tool_result' } {
  return msg.role === 'tool_result';
}

/**
 * Check if a message is an assistant message
 */
export function isAssistantMessage(msg: LoopMessage): msg is LoopMessage & { role: 'assistant' } {
  return msg.role === 'assistant';
}
