/**
 * Tool Types and Interfaces
 *
 * Defines the unified interface for all tools that agents can execute
 */

import type { z } from 'zod';

/**
 * Tool execution status
 */
export type ToolStatus = 'success' | 'error' | 'timeout' | 'cancelled';

/**
 * Tool input
 */
export interface ToolInput {
  content: string | Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Tool error information
 */
export interface ToolError {
  message: string;
  code?: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Tool output
 */
export interface ToolOutput {
  status: ToolStatus;
  content: string | Record<string, unknown>;
  error?: ToolError;
  metadata?: Record<string, unknown>;
}

/**
 * Tool parameter definition
 */
export interface ToolParameters {
  required?: string[];
  optional?: string[];
}

/**
 * Tool definition
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  parameters?: ToolParameters;
  examples?: Array<{
    input: ToolInput;
    output: ToolOutput;
  }>;
  metadata?: Record<string, unknown>;
}

/**
 * Tool interface
 */
export interface Tool extends ToolDefinition {
  /**
   * Execute the tool with given input
   */
  execute(input: ToolInput): Promise<ToolOutput>;

  /**
   * Validate input before execution
   */
  validate?(input: ToolInput): boolean;

  /**
   * Cleanup resources after execution
   */
  cleanup?(): Promise<void>;

  /**
   * Get current state of the tool
   */
  getState?(): Record<string, unknown>;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  requestId?: string;
  sessionId?: string;
  userId?: string;
  timeout?: number;
  env?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/**
 * Tool execution error
 */
export class ToolExecutionError extends Error {
  public toolName: string;
  public code?: string;
  public override cause?: Error;
  public metadata?: Record<string, unknown>;

  constructor(
    toolName: string,
    message: string,
    code?: string,
    cause?: Error,
    metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    if (code !== undefined) {
      this.code = code;
    }
    if (cause !== undefined) {
      this.cause = cause;
    }
    if (metadata !== undefined) {
      this.metadata = metadata;
    }
  }
}

/**
 * Tool registry entry
 */
export interface ToolRegistryEntry {
  tool: Tool;
  enabled: boolean;
  usageCount: number;
  lastUsed?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Tool execution result with timing
 */
export interface ToolExecutionResult extends ToolOutput {
  toolName: string;
  startTime: number;
  endTime: number;
  duration: number;
}

/**
 * Tool lifecycle hooks
 */
export interface ToolHooks {
  beforeExecute?(tool: Tool, input: ToolInput, context?: ToolContext): Promise<void>;
  afterExecute?(tool: Tool, output: ToolOutput, context?: ToolContext): Promise<void>;
  onError?(tool: Tool, error: Error, context?: ToolContext): Promise<void>;
}
