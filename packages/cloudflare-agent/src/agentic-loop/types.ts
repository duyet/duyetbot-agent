/**
 * Agentic Loop Type Definitions
 *
 * Provides core type definitions for the agentic loop system including:
 * - Tool definitions and results
 * - Loop configuration and context
 * - Progress tracking and callbacks
 * - Tool invocation history
 * - Loop execution results
 *
 * The agentic loop implements the core agent reasoning loop pattern:
 * User Query → Loop [Thinking → Tool Use → Tool Results]* → Response
 */

import type { AgentResult } from '../base/base-types.js';
import type { ExecutionContext } from '../execution/context.js';

// ============================================================================
// Tool Definitions and Results
// ============================================================================

/**
 * JSON Schema-like parameter definition for tool arguments
 *
 * Matches the OpenAI tools format for parameter specification.
 * Enables proper validation and documentation of tool arguments.
 */
export interface ToolParameters {
  /** JSON Schema type (object, string, number, array, boolean) */
  type: string;
  /** Description of what this parameter does */
  description?: string;
  /** Required properties for object types */
  properties?: Record<string, unknown>;
  /** Required field names for object types */
  required?: string[];
  /** Additional JSON schema properties (enum, pattern, etc.) */
  [key: string]: unknown;
}

/**
 * Result of executing a tool
 *
 * Provides information about tool execution success/failure,
 * execution duration, and the actual output or error.
 *
 * @example
 * ```typescript
 * const result: ToolResult = {
 *   success: true,
 *   output: 'File contents...',
 *   durationMs: 156
 * };
 * ```
 */
export interface ToolResult {
  /** Whether tool execution succeeded without errors */
  success: boolean;
  /** Primary output string (always provided for LLM consumption) */
  output: string;
  /** Structured data result (optional, for programmatic use) */
  data?: unknown;
  /** Error message if execution failed (only populated when success=false) */
  error?: string;
  /** Time taken to execute the tool in milliseconds */
  durationMs: number;
}

/**
 * Tool definition for execution within the agentic loop
 *
 * Defines a callable tool that the agent can use during reasoning.
 * Each tool has metadata for discovery and a function for execution.
 *
 * @example
 * ```typescript
 * const readFileTool: LoopTool = {
 *   name: 'read_file',
 *   description: 'Read contents of a file',
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       path: { type: 'string', description: 'File path to read' }
 *     },
 *     required: ['path']
 *   },
 *   execute: async (args, ctx) => {
 *     const start = Date.now();
 *     const contents = await fs.readFile(args.path as string);
 *     return {
 *       success: true,
 *       output: contents,
 *       durationMs: Date.now() - start
 *     };
 *   }
 * };
 * ```
 */
export interface LoopTool {
  /** Unique tool identifier (alphanumeric + underscore, no spaces) */
  name: string;
  /** Human-readable description of what this tool does */
  description: string;
  /** Parameter schema for tool arguments (JSON Schema format) */
  parameters: ToolParameters;
  /** Execute function - called when agent invokes this tool */
  execute: (args: Record<string, unknown>, ctx: LoopContext) => Promise<ToolResult>;
}

// ============================================================================
// Progress Tracking
// ============================================================================

/**
 * Progress update for real-time agent execution tracking
 *
 * Emitted during agent execution to provide visibility into what the agent
 * is doing. Useful for Telegram/GitHub bots to update users in real-time.
 *
 * @example
 * ```typescript
 * const progress: ProgressUpdate = {
 *   type: 'tool_start',
 *   message: 'Searching for relevant documents...',
 *   toolName: 'search',
 *   iteration: 2,
 *   timestamp: Date.now()
 * };
 * ```
 */
export interface ProgressUpdate {
  /** Type of progress event occurring */
  type: 'thinking' | 'tool_start' | 'tool_complete' | 'tool_error' | 'responding';
  /** Human-readable message describing current activity */
  message: string;
  /** Tool name if this is a tool_start/tool_complete/tool_error event */
  toolName?: string;
  /** Current iteration number (0-indexed) */
  iteration: number;
  /** Unix timestamp when this event occurred (milliseconds) */
  timestamp: number;
  /** Duration in milliseconds (populated for tool_complete/tool_error) */
  durationMs?: number;
}

// ============================================================================
// Loop Configuration
// ============================================================================

/**
 * Debug info captured for a single tool call
 *
 * Contains sanitized tool invocation details for observability.
 *
 * @example
 * ```typescript
 * const debugInfo: ToolCallDebugInfo = {
 *   name: 'search',
 *   args: { query: 'React patterns' },
 *   result: {
 *     success: true,
 *     output: '5 results found',
 *     durationMs: 234
 *   }
 * };
 * ```
 */
export interface ToolCallDebugInfo {
  /** Tool name that was invoked */
  name: string;
  /** Arguments passed to the tool (may be sanitized) */
  args: Record<string, unknown>;
  /** Result from tool execution */
  result: ToolResult;
  /** Iteration number when this tool was called */
  iteration: number;
}

/**
 * Configuration for the agentic loop
 *
 * Controls loop behavior including iteration limits, available tools,
 * and callback functions for progress tracking.
 *
 * @example
 * ```typescript
 * const config: AgenticLoopConfig = {
 *   maxIterations: 10,
 *   tools: [readFileTool, searchTool],
 *   systemPrompt: 'You are a helpful assistant...',
 *   onProgress: async (update) => {
 *     console.log(`[${update.iteration}] ${update.message}`);
 *   },
 *   debugAccumulator: async (info) => {
 *     observability.recordToolCall(info);
 *   }
 * };
 * ```
 */
export interface AgenticLoopConfig {
  /** Maximum iterations before stopping (safety limit, typically 5-50) */
  maxIterations: number;
  /** Optional maximum tokens per iteration for token budget management */
  maxTokensPerIteration?: number;
  /** Available tools the agent can use */
  tools: LoopTool[];
  /** Optional system prompt (overrides default agent system prompt) */
  systemPrompt?: string;
  /** Callback: Called when agent makes progress (thinking, tool calls, etc.) */
  onProgress?: (update: ProgressUpdate) => Promise<void>;
  /** Callback: Called when agent starts invoking a tool */
  onToolStart?: (toolName: string, args: Record<string, unknown>) => Promise<void>;
  /** Callback: Called when tool execution completes (success or failure) */
  onToolEnd?: (toolName: string, result: ToolResult) => Promise<void>;
  /** Callback: Called with tool call debug info for observability collection */
  debugAccumulator?: (info: ToolCallDebugInfo) => Promise<void>;
}

// ============================================================================
// Loop Context
// ============================================================================

/**
 * Execution context for the agentic loop
 *
 * Extends ExecutionContext with loop-specific state including iteration count,
 * tool history, and subagent tracking. Passed to all tool execute functions.
 *
 * @example
 * ```typescript
 * const ctx: LoopContext = {
 *   executionContext: execCtx,
 *   iteration: 2,
 *   toolHistory: [...previousInvocations],
 *   isSubagent: false
 * };
 * ```
 */
export interface LoopContext {
  /** Base execution context with platform info, tracing, etc. */
  executionContext: ExecutionContext;
  /** Current iteration number (0-indexed) */
  iteration: number;
  /** History of all tool invocations so far in this loop */
  toolHistory: ToolInvocation[];
  /** Whether this loop is executing as a subagent (for orchestrator pattern) */
  isSubagent: boolean;
  /** Parent loop ID if this is a subagent (for hierarchical tracing) */
  parentLoopId?: string;
}

// ============================================================================
// Tool Invocation Tracking
// ============================================================================

/**
 * Record of a single tool invocation in the agentic loop
 *
 * Tracks what tool was called, what arguments were passed, and what result
 * was returned. Used for history, debugging, and prompt context.
 *
 * @example
 * ```typescript
 * const invocation: ToolInvocation = {
 *   toolName: 'search',
 *   args: { query: 'how to use React hooks' },
 *   result: {
 *     success: true,
 *     output: '5 results found...',
 *     durationMs: 234
 *   },
 *   iteration: 1,
 *   timestamp: 1702345678000
 * };
 * ```
 */
export interface ToolInvocation {
  /** Name of the tool that was invoked */
  toolName: string;
  /** Arguments passed to the tool */
  args: Record<string, unknown>;
  /** Result returned from tool execution */
  result: ToolResult;
  /** Which iteration this tool was called in (0-indexed) */
  iteration: number;
  /** Unix timestamp when this tool was invoked (milliseconds) */
  timestamp: number;
}

// ============================================================================
// Loop Results
// ============================================================================

/**
 * Result of executing the agentic loop
 *
 * Provides the final response, metrics about loop execution,
 * and information about tools used and tokens consumed.
 *
 * @example
 * ```typescript
 * const result: AgenticLoopResult = {
 *   success: true,
 *   response: 'Here is the analysis...',
 *   iterations: 3,
 *   toolsUsed: ['search', 'analyze'],
 *   totalDurationMs: 2456,
 *   tokenUsage: {
 *     input: 2400,
 *     output: 580,
 *     total: 2980
 *   },
 *   debugContext: {
 *     steps: [...]
 *   }
 * };
 * ```
 */
export interface AgenticLoopResult {
  /** Whether the loop completed successfully */
  success: boolean;
  /** Final response from the agent */
  response: string;
  /** Number of iterations the loop ran */
  iterations: number;
  /** List of tool names that were used */
  toolsUsed: string[];
  /** Total time spent in the loop (milliseconds) */
  totalDurationMs: number;
  /** Token usage across all LLM calls in the loop */
  tokenUsage?: {
    /** Tokens consumed in prompts */
    input: number;
    /** Tokens generated in responses */
    output: number;
    /** Total tokens (input + output) */
    total: number;
  };
  /** Error message if success=false */
  error?: string;
  /** Debug context with step-by-step execution details for observability */
  debugContext?: {
    /** Execution steps including tool calls and results */
    steps: Array<{
      iteration: number;
      type: 'thinking' | 'tool_execution';
      toolName?: string;
      args?: Record<string, unknown>;
      result?: ToolResult;
      thinking?: string;
    }>;
  };
}

// ============================================================================
// LLM Message Types
// ============================================================================

/**
 * LLM tool invocation from agent reasoning
 *
 * Represents a tool call generated by the LLM during agent reasoning.
 * The loop will execute this tool and collect results.
 *
 * @example
 * ```typescript
 * const toolCall: ToolCall = {
 *   id: 'call_abc123',
 *   name: 'search',
 *   arguments: { query: 'React hooks best practices' }
 * };
 * ```
 */
export interface ToolCall {
  /** Unique identifier for this tool call (for correlating results) */
  id: string;
  /** Name of the tool to invoke */
  name: string;
  /** Arguments to pass to the tool (parsed from LLM output) */
  arguments: Record<string, unknown>;
}

/**
 * Messages in the loop conversation history
 *
 * Represents different message types exchanged between user, assistant,
 * and tools during loop execution.
 *
 * @example
 * ```typescript
 * const messages: LoopMessage[] = [
 *   { role: 'user', content: 'Find React documentation' },
 *   { role: 'assistant', content: 'I'll search for that', toolCalls: [...] },
 *   { role: 'tool_result', toolCallId: 'call_abc123', content: 'Found 5 pages' }
 * ];
 * ```
 */
export type LoopMessage =
  | {
      /** User message initiating or continuing the conversation */
      role: 'user';
      /** User's input text */
      content: string;
    }
  | {
      /** Assistant message (from LLM) */
      role: 'assistant';
      /** Assistant's response text */
      content: string;
      /** Tool calls generated by the assistant (optional) */
      toolCalls?: ToolCall[];
    }
  | {
      /** Tool result message (result of executing a tool) */
      role: 'tool_result';
      /** ID of the tool call this is a result for */
      toolCallId: string;
      /** Output/result from the tool execution */
      content: string;
    };

// ============================================================================
// Anthropic Compatibility
// ============================================================================

/**
 * Anthropic-compatible tool definition for LLM
 *
 * Represents a tool in the format expected by Claude API for tool_use.
 * This is the format sent to the LLM for discovery and invocation.
 *
 * @example
 * ```typescript
 * const tool: AnthropicTool = {
 *   name: 'search',
 *   description: 'Search the web',
 *   input_schema: {
 *     type: 'object',
 *     properties: {
 *       query: { type: 'string', description: 'Search query' }
 *     },
 *     required: ['query']
 *   }
 * };
 * ```
 */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description?: string;
        enum?: string[];
      }
    >;
    required?: string[];
  };
}

// ============================================================================
// Conversion/Adapter Types
// ============================================================================

/**
 * Convert AgenticLoopResult to AgentResult for higher-level APIs
 *
 * Useful when the agentic loop is used within a larger agent framework.
 * Maps loop-specific metrics to the standard AgentResult format.
 *
 * @param loopResult - The loop result to convert
 * @param durationMs - Total duration for the agent operation
 * @returns AgentResult in standard format
 *
 * @example
 * ```typescript
 * const loopResult: AgenticLoopResult = { ... };
 * const agentResult: AgentResult = {
 *   success: loopResult.success,
 *   content: loopResult.response,
 *   durationMs: 2500,
 *   tokensUsed: loopResult.tokenUsage?.total,
 *   debug: {
 *     tools: loopResult.toolsUsed
 *   }
 * };
 * ```
 */
export function agenticLoopResultToAgentResult(
  loopResult: AgenticLoopResult,
  durationMs: number
): AgentResult {
  const result: AgentResult = {
    success: loopResult.success,
    durationMs,
    debug: {
      tools: loopResult.toolsUsed,
    },
  };

  // Only include optional fields if they have values
  if (loopResult.response) result.content = loopResult.response;
  if (loopResult.error) result.error = loopResult.error;
  if (loopResult.tokenUsage?.total) result.tokensUsed = loopResult.tokenUsage.total;

  return result;
}
