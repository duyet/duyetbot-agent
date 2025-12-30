/**
 * Agent Capability Components
 *
 * Collection of components for displaying agent execution progress,
 * token usage, tool execution timeline, and debug information.
 *
 * @module components/agent-capabilities
 */

// Progress tracking
export { ProgressTracker } from "./progress-tracker";

// Token usage tracking
export { default as TokenTracker } from "./token-tracker";

// Execution timeline
export {
  ExecutionTimeline,
  CompactExecutionTimeline,
} from "./execution-timeline";

// Debug footer
export {
  DebugFooter,
  DebugFooterToggle,
  DebugIndicator,
} from "./debug-footer";

// Tool rendering enhancements
export { ToolRenderer, ToolStatusBadge } from "./tool-renderer";

// Re-export types from @duyetbot/progress for convenience
export type {
  Step,
  StepCollection,
  StepType,
  TokenUsage,
  ToolStartStep,
  ToolCompleteStep,
  ToolErrorStep,
  ThinkingStep,
  RoutingStep,
  LlmIterationStep,
  PreparingStep,
  ParallelToolsStep,
  SubAgentStep,
  BaseStep,
} from "@duyetbot/progress";

// Re-export format utilities
export {
  formatCost,
  formatCompactNumber,
  formatDuration,
  formatToolArgs,
  formatToolArgsVerbose,
  formatToolResult,
  truncate,
} from "@duyetbot/progress";
