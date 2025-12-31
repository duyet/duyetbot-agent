import {
  formatCompactNumber,
  formatCostUsd,
  formatDuration,
  formatToolArgs,
  formatToolResponse as formatToolResult,
  shortenModelName,
} from './formatting.js';

export interface DebugContext {
  steps?: Array<{
    iteration: number;
    type:
      | 'thinking'
      | 'tool_start'
      | 'tool_complete'
      | 'tool_error'
      | 'tool_execution'
      | 'responding'
      | 'routing'
      | 'llm_iteration'
      | 'preparing';
    toolName?: string;
    agentName?: string;
    args?: Record<string, unknown>;
    result?: string | { success?: boolean; output?: string; durationMs?: number; error?: string };
    error?: string;
    thinking?: string;
    maxIterations?: number;
  }>;
  routingFlow?: Array<{
    agent: string;
    durationMs?: number;
    status?: 'running' | 'completed' | 'error';
    tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
    toolChain?: string[];
  }>;
  routerDurationMs?: number;
  classification?: { type?: string; category?: string; complexity?: string } | string;
  totalDurationMs?: number;
  metadata?: {
    traceId?: string;
    model?: string;
    tokenUsage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cachedTokens?: number;
      actualCostUsd?: number;
      estimatedCostUsd?: number;
    };
    lastToolError?: string;
    webSearchEnabled?: boolean;
  };
  workers?: Array<{
    name: string;
    durationMs?: number;
    status?: 'running' | 'completed' | 'error';
    tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  }>;
}

export interface WorkflowResult {
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
  debugContext?: DebugContext;
}

/**
 * Format debug footer for workflow completion
 *
 * Uses Telegram's expandable blockquote (Bot API 7.0+) for collapsible debug info:
 * <blockquote expandable>...</blockquote>
 *
 * Shows execution chain with thinking text, tool calls, and tool responses:
 * ```
 * ⏺ I'll summarize the article about OpenAI skills...
 * ⏺ web_search(query: "OpenAI skills")
 *   ⎿ 🔍 Found 5 results: OpenAI announces new...
 * ⏺ Based on my research, here's the summary...
 * ⏱️ 7.6s | 📊 5,417 | 🤖 @preset/duyetbot
 * 🔗 logs: 4c4c2c90
 * ```
 */
export function formatWorkflowDebugFooter(
  result: WorkflowResult,
  workflowId?: string,
  modelName: string = '@preset/duyetbot'
): string {
  const lines: string[] = [];

  // Render sequential execution steps (no grouping by iteration)
  if (result.debugContext?.steps && result.debugContext.steps.length > 0) {
    // Add step header to show we're tracking the execution chain
    lines.push(`⏺ Step ${result.iterations || 1}`);

    for (const step of result.debugContext.steps) {
      if (step.type === 'thinking' && step.thinking) {
        // Show thinking text, truncated to ~80 chars
        const text = step.thinking.replace(/\n/g, ' ').trim();
        const truncated = text.slice(0, 80);
        const ellipsis = text.length > 80 ? '...' : '';
        lines.push(`⏺ ${truncated}${ellipsis}`);
      } else if (step.type === 'tool_execution' && step.toolName) {
        // Format tool call with key argument
        // Wrap tool name in backticks to prevent markdown __ bold conversion
        const argStr = formatToolArgs(step.args);
        lines.push(`⏺ ${step.toolName}(${argStr})`);

        // Show tool response (truncated to 3 lines max)
        if (typeof step.result === 'object' && step.result !== null) {
          if (step.result.output) {
            const responseLines = formatToolResult(step.result.output, 3);
            lines.push(`  ⎿ 🔍 ${responseLines}`);
          } else if (step.result.error) {
            lines.push(`  ⎿ ❌ ${step.result.error.slice(0, 60)}...`);
          }
        }
      }
    }
  } else if (result.toolsUsed.length > 0) {
    // Fallback: just list tools if no debug context
    // Wrap each tool name in backticks to prevent markdown __ bold conversion
    const escapedTools = result.toolsUsed.map((t) => `\`${t}\``);
    lines.push(`🔧 ${escapedTools.join(' → ')}`);
  }

  // Summary line: duration | tokens (in/out/cached) | cost | model
  const summaryParts: string[] = [];
  summaryParts.push(`⏱️ ${formatDuration(result.totalDurationMs)}`);

  // Format tokens as separated input/output/cached
  if (result.tokenUsage) {
    const { input, output, cached } = result.tokenUsage;
    let tokenStr = `📊 ${formatCompactNumber(input)}↓/${formatCompactNumber(output)}↑`;
    if (cached && cached > 0) {
      tokenStr += `/${formatCompactNumber(cached)}$`;
    }
    summaryParts.push(tokenStr);

    // Add cost if available
    if (result.tokenUsage.costUsd !== undefined && result.tokenUsage.costUsd > 0) {
      const costStr = formatCostUsd(result.tokenUsage.costUsd);
      summaryParts.push(`💵 ${costStr}`);
    }
  }

  // Model name (shortened for readability)
  summaryParts.push(`🤖 ${shortenModelName(modelName)}`);
  lines.push(summaryParts.join(' | '));

  // Workflow ID with clickable link to Cloudflare dashboard
  if (workflowId) {
    // Extract short ID (first segment of UUID) for display
    const shortId = workflowId.split('-')[0] || workflowId.slice(0, 8);
    // Link to Cloudflare Workflows dashboard
    const dashboardUrl = `https://dash.cloudflare.com/23050adb6c92e313643a29e1ba64c88a/workers/workflows/agentic-loop-workflow/instance/${workflowId}`;
    lines.push(`🔗 logs: <a href="${dashboardUrl}">${shortId}</a>`);
  }

  // Return as expandable blockquote (Telegram Bot API 7.0+, HTML mode only)
  const content = lines.join('\n');
  return `\n<blockquote expandable>${content}</blockquote>`;
}

// Imports for AgentStep definition
import type { AgentStep } from '@duyetbot/observability';

// Helper to convert debug context to agent steps for observability
export function debugContextToAgentSteps(debugContext: DebugContext): AgentStep[] {
  if (!debugContext.steps) {
    return [];
  }

  // Convert flat steps into AgentSteps
  const agentSteps: AgentStep[] = [];

  // Example: Map tool completions to agent steps
  for (const step of debugContext.steps) {
    if (step.type === 'tool_complete' || step.type === 'tool_error') {
      const durationMs = typeof step.result === 'object' ? step.result?.durationMs : undefined;
      const error = typeof step.result === 'object' ? step.result?.error : step.error;

      agentSteps.push({
        // Cast to any to avoid strict type checking against AgentStep for now
        tools: step.toolName ? [step.toolName] : undefined,
        durationMs,
        error,
      } as any);
    }
  }
  return agentSteps;
}
