/**
 * Shared types for chat-web application
 */

/**
 * Execution step type for progress tracking
 * Matches StepEvent from cloudflare-agent StepProgressTracker
 */
export type ExecutionStep =
  | {
      type: 'thinking';
      iteration?: number;
      thinking?: string;
    }
  | {
      type: 'tool_start';
      toolName: string;
      args?: Record<string, unknown>;
      iteration?: number;
    }
  | {
      type: 'tool_complete';
      toolName: string;
      args?: Record<string, unknown>;
      result?: string | { success?: boolean; output?: string; durationMs?: number; error?: string };
      durationMs?: number;
    }
  | {
      type: 'tool_error';
      toolName: string;
      args?: Record<string, unknown>;
      error: string;
    }
  | {
      type: 'tool_execution';
      toolName: string;
      args?: Record<string, unknown>;
      durationMs?: number;
    }
  | {
      type: 'routing';
      agentName: string;
      iteration?: number;
    }
  | {
      type: 'llm_iteration';
      iteration?: number;
      maxIterations?: number;
    }
  | {
      type: 'preparing';
    }
  | {
      type: 'responding';
    }
  | {
      type: 'parallel_tools';
      args?: Record<string, unknown>;
      iteration?: number;
    }
  | {
      type: 'subagent';
      agentName: string;
      args?: Record<string, unknown>;
      iteration?: number;
    };

/**
 * Progress event from SSE stream
 */
export type ProgressEvent =
  | { type: 'connected'; data: { sessionId: string; timestamp: number } }
  | { type: 'thinking'; data: { message: string; iteration?: number; timestamp?: number } }
  | {
      type: 'tool_start';
      data: {
        toolName: string;
        args?: Record<string, unknown>;
        iteration?: number;
        timestamp?: number;
      };
    }
  | {
      type: 'tool_complete';
      data: {
        toolName: string;
        result?: string;
        durationMs?: number;
        inputTokens?: number;
        outputTokens?: number;
        timestamp?: number;
      };
    }
  | {
      type: 'tool_error';
      data: {
        toolName: string;
        error?: string;
        timestamp?: number;
      };
    }
  | { type: 'llm_iteration'; data: { iteration?: number; timestamp?: number } }
  | { type: 'preparing'; data: { message: string; timestamp?: number } }
  | {
      type: 'complete';
      data: {
        executionId: string;
        timestamp?: number;
        durationMs?: number;
        totalTokens?: number;
      };
    }
  | { type: 'error'; data: { error: string; timestamp?: number } }
  | { type: 'heartbeat'; data: { timestamp: number } };

/**
 * Chat message for session storage
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/**
 * Session metadata
 */
export interface Session {
  sessionId: string;
  userId: string;
  chatId: string;
  title?: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}
