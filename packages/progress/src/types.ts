/**
 * Core type definitions for the @duyetbot/progress package.
 * This module provides the canonical type definitions for tracking and rendering
 * agent execution steps, token usage, and rendering options.
 */

/**
 * Union type of all possible step types in agent execution.
 */
export type StepType =
  | 'thinking'
  | 'tool_start'
  | 'tool_complete'
  | 'tool_error'
  | 'routing'
  | 'llm_iteration'
  | 'preparing'
  | 'parallel_tools'
  | 'subagent';

/**
 * Base properties shared by all step types.
 */
export interface BaseStep {
  /**
   * The iteration number when this step occurred.
   * Typically corresponds to the LLM request/response cycle.
   */
  iteration: number;

  /**
   * ISO 8601 timestamp when the step was created.
   */
  timestamp: string;

  /**
   * Duration of the step in milliseconds.
   * May be 0 for instant steps or not yet completed steps.
   */
  durationMs: number;
}

/**
 * Step representing an agent's thinking or reasoning phase.
 */
export interface ThinkingStep extends BaseStep {
  type: 'thinking';

  /**
   * Optional thinking content or reasoning trace.
   * May be omitted if thinking is internal only.
   */
  thinking?: string;
}

/**
 * Step representing the start of a tool execution.
 */
export interface ToolStartStep extends BaseStep {
  type: 'tool_start';

  /**
   * Name of the tool being executed.
   */
  toolName: string;

  /**
   * Arguments passed to the tool.
   */
  args: Record<string, unknown>;
}

/**
 * Step representing successful completion of a tool execution.
 */
export interface ToolCompleteStep extends BaseStep {
  type: 'tool_complete';

  /**
   * Name of the tool that was executed.
   */
  toolName: string;

  /**
   * Arguments that were passed to the tool.
   */
  args: Record<string, unknown>;

  /**
   * Result returned by the tool (stringified).
   */
  result: string;
}

/**
 * Step representing a tool execution error.
 */
export interface ToolErrorStep extends BaseStep {
  type: 'tool_error';

  /**
   * Name of the tool that failed.
   */
  toolName: string;

  /**
   * Arguments that were passed to the tool.
   */
  args: Record<string, unknown>;

  /**
   * Error message or description.
   */
  error: string;
}

/**
 * Step representing routing to a specific agent.
 */
export interface RoutingStep extends BaseStep {
  type: 'routing';

  /**
   * Name of the agent being routed to.
   */
  agentName: string;
}

/**
 * Step representing the start of an LLM iteration cycle.
 */
export interface LlmIterationStep extends BaseStep {
  type: 'llm_iteration';

  /**
   * Maximum number of iterations allowed for this execution.
   */
  maxIterations: number;
}

/**
 * Step representing a preparation phase before execution.
 */
export interface PreparingStep extends BaseStep {
  type: 'preparing';
}

/**
 * Individual tool within a parallel execution group.
 */
export interface ParallelToolInfo {
  /** Unique identifier for this tool execution */
  id: string;
  /** Name of the tool being executed */
  toolName: string;
  /** Arguments passed to the tool */
  args: Record<string, unknown>;
  /** Current status of this tool */
  status: 'running' | 'completed' | 'error';
  /** Result if completed */
  result?: string;
  /** Error message if failed */
  error?: string;
  /** Duration in milliseconds */
  durationMs?: number;
}

/**
 * Step representing multiple tools executing in parallel.
 */
export interface ParallelToolsStep extends BaseStep {
  type: 'parallel_tools';
  /** Array of tools in this parallel execution group */
  tools: ParallelToolInfo[];
}

/**
 * Step representing a sub-agent execution.
 */
export interface SubAgentStep extends BaseStep {
  type: 'subagent';
  /** Unique identifier for this sub-agent execution */
  id: string;
  /** Name of the sub-agent (e.g., "Plan", "Explore", "Research") */
  agentName: string;
  /** Description of the sub-agent's task */
  description: string;
  /** Current status */
  status: 'running' | 'completed' | 'error';
  /** Number of tool uses by this sub-agent */
  toolUses?: number;
  /** Total tokens consumed by sub-agent */
  tokenCount?: number;
  /** Result summary if completed */
  result?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Discriminated union of all possible step types.
 * Use the 'type' field to discriminate between step types.
 */
export type Step =
  | ThinkingStep
  | ToolStartStep
  | ToolCompleteStep
  | ToolErrorStep
  | RoutingStep
  | LlmIterationStep
  | PreparingStep
  | ParallelToolsStep
  | SubAgentStep;

/**
 * Token usage statistics for LLM interactions.
 */
export interface TokenUsage {
  /**
   * Number of input tokens consumed.
   */
  input: number;

  /**
   * Number of output tokens generated.
   */
  output: number;

  /**
   * Total tokens (input + output).
   */
  total: number;

  /**
   * Number of cached tokens (if applicable).
   * Cached tokens are typically cheaper than regular input tokens.
   */
  cached?: number;

  /**
   * Number of reasoning tokens (if applicable).
   * Used by models with extended thinking capabilities.
   */
  reasoning?: number;

  /**
   * Estimated cost in USD for this token usage.
   */
  costUsd?: number;
}

/**
 * Collection of steps representing a complete or partial agent execution.
 */
export interface StepCollection {
  /**
   * Array of execution steps in chronological order.
   */
  steps: Step[];

  /**
   * Aggregated token usage across all steps.
   */
  tokenUsage?: TokenUsage;

  /**
   * Model identifier used for this execution.
   * Example: "anthropic/claude-3-5-sonnet"
   */
  model?: string;

  /**
   * ISO 8601 timestamp when the execution started.
   */
  startedAt: string;

  /**
   * Total duration of the execution in milliseconds.
   * May be undefined if execution is still in progress.
   */
  durationMs?: number;

  /**
   * Unique trace identifier for this execution.
   * Used for debugging and observability.
   */
  traceId?: string;
}

/**
 * Supported rendering formats for step collections.
 */
export type RenderFormat = 'html' | 'markdownV2' | 'markdown' | 'plain';

/**
 * Options for customizing step rendering.
 */
export interface RenderOptions {
  /**
   * Output format for rendering.
   * @default 'plain'
   */
  format?: RenderFormat;

  /**
   * Whether to include token usage information in the output.
   * @default true
   */
  includeTokenUsage?: boolean;

  /**
   * Whether to include timing information for each step.
   * @default true
   */
  includeTiming?: boolean;

  /**
   * Whether to include detailed tool arguments in the output.
   * @default false
   */
  includeToolArgs?: boolean;

  /**
   * Whether to include tool results in the output.
   * @default false
   */
  includeToolResults?: boolean;

  /**
   * Whether to collapse consecutive steps of the same type.
   * @default false
   */
  collapseSteps?: boolean;

  /**
   * Maximum length for truncating long values (tool args, results).
   * Set to 0 to disable truncation.
   * @default 100
   */
  maxValueLength?: number;

  /**
   * Whether to include the trace ID in the output.
   * @default true
   */
  includeTraceId?: boolean;

  /**
   * Whether to include the model identifier in the output.
   * @default true
   */
  includeModel?: boolean;

  /**
   * Custom emoji or symbols for different step types.
   * If not provided, default emojis will be used.
   */
  customEmojis?: Partial<Record<StepType, string>>;
}
