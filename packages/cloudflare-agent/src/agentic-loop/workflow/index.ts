/**
 * Workflow-Based AgenticLoop Module
 *
 * Exports for the Cloudflare Workflow implementation of the agentic loop.
 * This module provides timeout-resistant agent execution by running
 * iterations as durable workflow steps.
 *
 * @module agentic-loop/workflow
 */

// Main workflow class
export { AgenticLoopWorkflow } from './agentic-loop-workflow.js';

// Types
export type {
  AgenticLoopWorkflowEnv,
  AgenticLoopWorkflowParams,
  IterationStepResult,
  JsonRecord,
  JsonValue,
  ProgressCallbackConfig,
  SerializedTool,
  WorkflowCompletionResult,
  WorkflowDebugContext,
  WorkflowLLMResponse,
  WorkflowProgressUpdate,
  WorkflowToolCall,
  WorkflowToolResult,
} from './types.js';

// Helper functions
export { isAssistantMessage, isToolResultMessage, serializeTools } from './types.js';
