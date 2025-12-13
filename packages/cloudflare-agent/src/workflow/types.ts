/**
 * Active workflow execution tracking
 */

/** Progress update entry for workflow execution */
export interface WorkflowProgressEntry {
  type: string;
  iteration: number;
  message: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  durationMs?: number;
  timestamp: number;
  parallelTools?: Array<{
    id: string;
    name: string;
    argsStr: string;
    result?: {
      status: 'completed' | 'error';
      summary: string;
      durationMs?: number;
    };
  }>;
  toolCallId?: string;
}

export interface QuotedContext {
  text: string;
  username?: string;
}

export interface ActiveWorkflowExecution {
  /** Workflow instance ID from Cloudflare */
  workflowId: string;
  /** Our execution ID for correlation */
  executionId: string;
  /** Timestamp when workflow was spawned */
  startedAt: number;
  /** Last progress update received */
  lastProgress?: WorkflowProgressEntry;
  /** Accumulated progress history for display */
  progressHistory?: WorkflowProgressEntry[];
  /** Message ID for editing progress (MessageRef = string | number) */
  messageId: number;
  /** Platform for transport reconstruction */
  platform: 'telegram' | 'github';
  /** Chat ID for transport reconstruction */
  chatId: string;
}
