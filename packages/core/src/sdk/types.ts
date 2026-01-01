/**
 * SDK Types
 *
 * Type definitions for Claude Agent SDK integration
 */

import type { z } from 'zod';

/**
 * Permission modes for tool execution
 *
 * - `default`: Standard permissions (ask for approval on tool use)
 * - `acceptEdits`: Auto-approve file edits (for trusted environments)
 * - `bypassPermissions`: Skip all permission checks (testing only)
 */
export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions';

/**
 * Model selection
 *
 * Can be a short name ('haiku', 'sonnet', 'opus') or a full model ID string.
 */
export type ModelType = 'haiku' | 'sonnet' | 'opus' | string;

/**
 * MCP server connection types
 *
 * - `stdio`: Standard input/output (local processes)
 * - `sse`: Server-Sent Events (HTTP long-lived connections)
 * - `http`: REST API style (stateless HTTP requests)
 * - `sdk`: In-process SDK integration
 */
export type MCPServerType = 'stdio' | 'sse' | 'http' | 'sdk';

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  type: MCPServerType;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  toolAllowlist?: string[];
}

/**
 * Subagent definition
 */
export interface SubagentConfig {
  name: string;
  description: string;
  tools?: string[];
  prompt?: string;
  model?: ModelType;
}

/**
 * SDK message types
 */
export type SDKMessageType =
  | 'user'
  | 'assistant'
  | 'result'
  | 'system'
  | 'tool_use'
  | 'tool_result';

/**
 * Base SDK message
 */
export interface SDKMessage {
  type: SDKMessageType;
  sessionId?: string;
  uuid?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * User message
 */
export interface SDKUserMessage extends SDKMessage {
  type: 'user';
  content: string;
}

/**
 * Assistant message
 */
export interface SDKAssistantMessage extends SDKMessage {
  type: 'assistant';
  content: string;
  stopReason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'interrupt';
}

/**
 * Tool use message
 */
export interface SDKToolUseMessage extends SDKMessage {
  type: 'tool_use';
  toolName: string;
  toolInput: unknown;
  toolUseId: string;
}

/**
 * Tool result message
 */
export interface SDKToolResultMessage extends SDKMessage {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
}

/**
 * Result message (final response)
 */
export interface SDKResultMessage extends SDKMessage {
  type: 'result';
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  duration?: number;
}

/**
 * System message
 */
export interface SDKSystemMessage extends SDKMessage {
  type: 'system';
  content: string;
}

/**
 * Union of all message types
 */
export type SDKAnyMessage =
  | SDKUserMessage
  | SDKAssistantMessage
  | SDKToolUseMessage
  | SDKToolResultMessage
  | SDKResultMessage
  | SDKSystemMessage;

/**
 * SDK tool definition
 */
export interface SDKTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  handler: (input: TInput) => Promise<TOutput>;
}

/**
 * SDK tool result
 */
export interface SDKToolResult {
  content: string;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Query input - can be string or async iterable for streaming
 */
export type QueryInput = string | AsyncIterable<SDKUserMessage>;

/**
 * Query abort controller for interruption
 */
export interface QueryController {
  interrupt: () => void;
  signal: AbortSignal;
}
