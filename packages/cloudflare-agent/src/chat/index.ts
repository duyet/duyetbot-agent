/**
 * Chat Module - Modular chat loop components
 *
 * Exports:
 * - ChatLoop: Main orchestrator for LLM chat with tool iterations
 * - DurableChatLoop: Alarm-based iteration for unlimited execution time
 * - ToolExecutor: Execute builtin and MCP tools
 * - ContextBuilder: Build LLM messages with history
 * - ResponseHandler: Parse LLM responses
 */

export { ChatLoop, type ChatLoopConfig, type ChatResult } from './chat-loop.js';
export {
  buildInitialMessages,
  buildToolIterationMessages,
  type ContextBuilderConfig,
} from './context-builder.js';
// Durable chat loop functions
export {
  createChatExecution,
  type DurableChatLoopConfig,
  formatExecutionProgress,
  runChatIteration,
} from './durable-chat-loop.js';
export { getToolCalls, hasToolCalls, type ParsedResponse, parse } from './response-handler.js';
export {
  type MCPCallResult,
  type MCPToolCallParams,
  type ToolExecutionResult,
  ToolExecutor,
  type ToolExecutorConfig,
} from './tool-executor.js';
// Durable chat loop types
export type {
  AlarmType,
  ChatIterationResult,
  ChatLoopExecution,
  ExecutionStep,
} from './types.js';
