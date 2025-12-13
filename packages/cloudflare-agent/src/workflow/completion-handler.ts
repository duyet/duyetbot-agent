import { logger } from '@duyetbot/hono-middleware';
import { isAdminUser } from '../auth/admin-checker.js';
import { sanitizeLLMResponseForTelegram } from '../sanitization/telegram-sanitizer.js';
import type { Transport } from '../transport.js';
import type { Message } from '../types.js';
import type { TransportContextDeps } from './context-reconstruction.js';
import { reconstructTransportContext } from './context-reconstruction.js';
import { formatWorkflowDebugFooter, type WorkflowResult } from './debug-footer.js';
import type { ActiveWorkflowExecution } from './types.js';

export interface WorkflowCompleteDeps<TContext> extends TransportContextDeps {
  state: {
    activeWorkflows?: Record<string, ActiveWorkflowExecution>;
    messages: Message[];
  };
  setState: (state: {
    activeWorkflows?: Record<string, ActiveWorkflowExecution>;
    messages: Message[];
    updatedAt: number;
  }) => void;
  transport?: Transport<TContext>;
  adminConfig: {
    adminUserIds?: Set<string | number>;
    adminUsernames?: Set<string>;
  };
}

/**
 * Handle workflow completion notification
 */
export async function handleWorkflowComplete<TContext>(
  request: Request,
  deps: WorkflowCompleteDeps<TContext>
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      executionId: string;
      result: {
        success: boolean;
        response: string;
        iterations: number;
        toolsUsed: string[];
        totalDurationMs: number;
        tokenUsage?: {
          input: number;
          output: number;
          total: number;
          cached?: number;
          reasoning?: number;
          costUsd?: number;
        };
        error?: string;
        debugContext?: {
          steps: Array<{
            iteration: number;
            type: string;
            toolName?: string;
            args?: Record<string, unknown>;
            result?: {
              success?: boolean;
              output?: string;
              durationMs?: number;
              error?: string;
            };
            thinking?: string;
          }>;
        };
      };
    };

    const { executionId, result } = body;

    // Find workflow execution
    const workflow = deps.state.activeWorkflows?.[executionId];
    if (!workflow) {
      logger.warn('[CloudflareAgent][WORKFLOW] Completion for unknown execution', {
        executionId,
      });
      return new Response('Workflow not found', { status: 404 });
    }

    logger.info('[CloudflareAgent][WORKFLOW] Workflow completed', {
      executionId,
      success: result.success,
      iterations: result.iterations,
      toolsUsed: result.toolsUsed,
      durationMs: result.totalDurationMs,
    });

    // Format final response with debug info
    // Sanitize LLM response for Telegram HTML mode:
    // 1. Strip ALL HTML tags (LLM produces inconsistent HTML that breaks Telegram's strict parser)
    // 2. Escape HTML entities to prevent parsing issues
    // The debug footer (which we control) is added AFTER sanitization
    let finalResponse = sanitizeLLMResponseForTelegram(result.response);

    // Check if admin for debug footer
    const isAdmin = isAdminUser(workflow.chatId, undefined, deps.adminConfig);
    if (isAdmin && result.success) {
      // Add debug footer for admin with workflow ID for debugging
      // Footer uses valid Telegram HTML tags (blockquote, a) that we control
      // Cast the result to WorkflowResult to match the interface
      const footer = formatWorkflowDebugFooter(result as WorkflowResult, workflow.workflowId);
      finalResponse = `${finalResponse}\n\n${footer}`;
    }

    // Edit message with final response
    if (deps.transport?.edit) {
      try {
        const ctx = reconstructTransportContext<TContext>(workflow, deps.env);
        if (ctx) {
          await deps.transport.edit(ctx, workflow.messageId, finalResponse);
        }
      } catch (editError) {
        logger.error('[CloudflareAgent][WORKFLOW] Failed to edit final response', {
          error: editError instanceof Error ? editError.message : String(editError),
          executionId,
        });
      }
    }

    // Remove from active workflows
    const { [executionId]: _removed, ...remainingWorkflows } = deps.state.activeWorkflows || {};

    // Build new state - only include activeWorkflows if non-empty
    const hasRemainingWorkflows = Object.keys(remainingWorkflows).length > 0;

    // Add assistant response to message history if successful
    const newMessages = result.success
      ? [
          ...deps.state.messages,
          {
            role: 'assistant' as const,
            content: result.response,
          },
        ]
      : deps.state.messages;

    deps.setState({
      ...deps.state,
      messages: newMessages,
      ...(hasRemainingWorkflows ? { activeWorkflows: remainingWorkflows } : {}),
      updatedAt: Date.now(),
    });

    return new Response('OK', { status: 200 });
  } catch (error) {
    logger.error('[CloudflareAgent][WORKFLOW] Completion handler error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response('Internal error', { status: 500 });
  }
}
