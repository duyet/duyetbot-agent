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
 * Response from LLM provider
 */
export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
}

/**
 * LLM provider interface - implement this for different backends
 */
export interface LLMProvider {
  chat(messages: LLMMessage[], tools?: OpenAITool[]): Promise<LLMResponse>;
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
