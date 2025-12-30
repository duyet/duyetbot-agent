/**
 * Agent Capability Components
 *
 * Collection of components for displaying agent execution progress,
 * token usage, tool execution timeline, and debug information.
 *
 * @module components/agent-capabilities
 */

// Re-export types from @duyetbot/progress for convenience
export type {
	BaseStep,
	LlmIterationStep,
	ParallelToolsStep,
	PreparingStep,
	RoutingStep,
	Step,
	StepCollection,
	StepType,
	SubAgentStep,
	ThinkingStep,
	TokenUsage,
	ToolCompleteStep,
	ToolErrorStep,
	ToolStartStep,
} from "@duyetbot/progress";
// Re-export format utilities
export {
	formatCompactNumber,
	formatCost,
	formatDuration,
	formatToolArgs,
	formatToolArgsVerbose,
	formatToolResult,
	truncate,
} from "@duyetbot/progress";
// Debug footer
export {
	DebugFooter,
	DebugFooterToggle,
	DebugIndicator,
} from "./debug-footer";
// Execution timeline
export {
	CompactExecutionTimeline,
	ExecutionTimeline,
} from "./execution-timeline";
// Progress tracking
export { ProgressTracker } from "./progress-tracker";
// Token usage tracking
export { default as TokenTracker } from "./token-tracker";
// Tool rendering enhancements
export { ToolRenderer, ToolStatusBadge } from "./tool-renderer";
