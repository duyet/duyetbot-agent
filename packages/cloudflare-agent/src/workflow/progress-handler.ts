import { logger } from '@duyetbot/hono-middleware';
import type { Transport } from '../transport.js';
import { reconstructTransportContext } from './context-reconstruction.js';
import { formatWorkflowProgress } from './formatting.js';
import type { ActiveWorkflowExecution, WorkflowProgressEntry } from './types.js';

export interface WorkflowProgressDeps<TContext> {
  env: Record<string, unknown>;
  state: {
    activeWorkflows?: Record<string, ActiveWorkflowExecution>;
  };
  setState: (state: {
    activeWorkflows?: Record<string, ActiveWorkflowExecution>;
    updatedAt: number;
  }) => void;
  transport?: Transport<TContext>;
}

/**
 * Handle workflow progress updates
 *
 * Accumulates progress updates and formats them in Claude Code style.
 */
export async function handleWorkflowProgress<TContext>(
  request: Request,
  deps: WorkflowProgressDeps<TContext>
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      executionId: string;
      update: {
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
      };
    };

    const { executionId, update } = body;

    // Find workflow execution
    const workflow = deps.state.activeWorkflows?.[executionId];
    if (!workflow) {
      logger.warn('[CloudflareAgent][WORKFLOW] Progress for unknown execution', {
        executionId,
      });
      return new Response('Workflow not found', { status: 404 });
    }

    // Create progress entry
    const progressEntry: WorkflowProgressEntry = {
      type: update.type,
      iteration: update.iteration,
      message: update.message,
      timestamp: update.timestamp,
      ...(update.toolName !== undefined && { toolName: update.toolName }),
      ...(update.toolArgs !== undefined && { toolArgs: update.toolArgs }),
      ...(update.toolResult !== undefined && { toolResult: update.toolResult }),
      ...(update.durationMs !== undefined && { durationMs: update.durationMs }),
      ...(update.parallelTools !== undefined && { parallelTools: update.parallelTools }),
      ...(update.toolCallId !== undefined && { toolCallId: update.toolCallId }),
    };

    // Accumulate progress history
    const existingHistory = workflow.progressHistory ?? [];
    const updatedHistory = [...existingHistory, progressEntry];

    // Update state with latest progress and history
    const updatedWorkflows = {
      ...deps.state.activeWorkflows,
      [executionId]: {
        ...workflow,
        lastProgress: progressEntry,
        progressHistory: updatedHistory,
      },
    };

    deps.setState({
      ...deps.state,
      activeWorkflows: updatedWorkflows,
      updatedAt: Date.now(),
    });

    // Format accumulated progress in Claude Code style
    const formattedProgress = formatWorkflowProgress(updatedHistory);

    // Edit thinking message with accumulated progress
    if (deps.transport?.edit) {
      try {
        const ctx = reconstructTransportContext<TContext>(workflow, deps.env);
        if (ctx) {
          await deps.transport.edit(ctx, workflow.messageId, formattedProgress);
        }
      } catch (editError) {
        logger.warn('[CloudflareAgent][WORKFLOW] Failed to edit progress message', {
          error: editError instanceof Error ? editError.message : String(editError),
          executionId,
        });
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    logger.error('[CloudflareAgent][WORKFLOW] Progress handler error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response('Internal error', { status: 500 });
  }
}
