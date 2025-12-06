/**
 * Agent Types and Interfaces
 *
 * Defines types for agent orchestration and execution
 */
import type { LLMMessage, LLMProvider } from './provider.js';
import type { Tool } from './tool.js';
/**
 * Agent state
 */
export type AgentState = 'idle' | 'running' | 'paused' | 'completed' | 'error';
/**
 * Agent execution mode
 */
export type AgentMode = 'streaming' | 'single';
/**
 * Agent configuration
 */
export interface AgentConfig {
  /**
   * Agent name/identifier
   */
  name?: string;
  /**
   * System prompt for the agent
   */
  systemPrompt?: string;
  /**
   * LLM provider to use
   */
  provider: LLMProvider;
  /**
   * Available tools
   */
  tools?: Tool[];
  /**
   * Execution mode
   */
  mode?: AgentMode;
  /**
   * Session ID for persistence
   */
  sessionId?: string;
  /**
   * Initial messages
   */
  initialMessages?: LLMMessage[];
  /**
   * Maximum turns before stopping
   */
  maxTurns?: number;
  /**
   * Agent metadata
   */
  metadata?: Record<string, unknown>;
}
/**
 * Agent execution result
 */
export interface AgentResult {
  /**
   * Final response content
   */
  content: string;
  /**
   * All messages in the conversation
   */
  messages: LLMMessage[];
  /**
   * Execution metadata
   */
  metadata: {
    turns: number;
    totalTokens: number;
    duration: number;
    stopReason: string;
  };
}
/**
 * Agent execution context
 */
export interface AgentContext {
  /**
   * Request ID
   */
  requestId: string;
  /**
   * Session ID
   */
  sessionId: string;
  /**
   * User ID (if authenticated)
   */
  userId?: string;
  /**
   * Agent state
   */
  state: AgentState;
  /**
   * Start time
   */
  startTime: number;
  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}
/**
 * Agent event types
 */
export type AgentEventType =
  | 'start'
  | 'message'
  | 'tool_call'
  | 'tool_result'
  | 'pause'
  | 'resume'
  | 'complete'
  | 'error';
/**
 * Agent event
 */
export interface AgentEvent {
  type: AgentEventType;
  timestamp: number;
  data: unknown;
  metadata?: Record<string, unknown>;
}
/**
 * Agent lifecycle hooks
 */
export interface AgentHooks {
  onStart?(context: AgentContext): Promise<void>;
  onMessage?(message: LLMMessage, context: AgentContext): Promise<void>;
  onToolCall?(toolName: string, input: unknown, context: AgentContext): Promise<void>;
  onToolResult?(toolName: string, output: unknown, context: AgentContext): Promise<void>;
  onComplete?(result: AgentResult, context: AgentContext): Promise<void>;
  onError?(error: Error, context: AgentContext): Promise<void>;
}
//# sourceMappingURL=agent.d.ts.map
