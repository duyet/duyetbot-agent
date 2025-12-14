/**
 * Durable ChatLoop Types
 *
 * Types for alarm-based chat loop execution that provides durability
 * without requiring Cloudflare Workflows.
 */

import type { Message } from '../types.js';
import type { QuotedContext } from '../workflow/types.js';

/**
 * Execution step for debug tracking
 */
export interface ExecutionStep {
  type: 'thinking' | 'tool_start' | 'tool_complete' | 'tool_error' | 'llm_call';
  iteration: number;
  toolName?: string | undefined;
  args?: Record<string, unknown> | undefined;
  result?: string | undefined;
  error?: string | undefined;
  thinking?: string | undefined;
  timestamp: number;
  durationMs?: number | undefined;
}

/**
 * State for a durable chat loop execution
 * Persisted in DO state between alarm invocations
 */
export interface ChatLoopExecution {
  // Identity
  executionId: string;
  traceId?: string | undefined;
  eventId?: string | undefined;

  // Iteration tracking
  iteration: number;
  maxIterations: number;
  startedAt: number;

  // Input
  userMessage: string;
  systemPrompt: string;
  quotedContext?: QuotedContext | undefined;

  // Conversation state (accumulates across iterations)
  conversationHistory: Message[]; // History before this execution
  iterationMessages: Array<{
    // Messages from current execution
    role: 'assistant' | 'user';
    content: string;
  }>;

  // Current iteration state
  lastAssistantContent?: string | undefined;
  pendingToolCalls?:
    | Array<{
        id: string;
        name: string;
        arguments: string;
      }>
    | undefined;

  // Progress tracking
  messageRef: number; // Platform message to edit
  platform: 'telegram' | 'github';
  tokenUsage: {
    input: number;
    output: number;
    cached?: number | undefined;
  };
  toolsUsed: string[];
  executionSteps: ExecutionStep[];

  // Transport context reconstruction
  transportMetadata: Record<string, unknown>;

  // Completion
  done: boolean;
  response?: string | undefined;
  error?: string | undefined;
}

/**
 * Result from a single chat iteration
 */
export interface ChatIterationResult {
  done: boolean;
  response?: string | undefined;
  hasToolCalls: boolean;
  tokenUsage: {
    input: number;
    output: number;
    cached?: number | undefined;
  };
}

/**
 * Alarm types for DO scheduling
 */
export type AlarmType = 'chatloop' | 'batch';
