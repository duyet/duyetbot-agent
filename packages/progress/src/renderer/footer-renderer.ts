/**
 * Footer Renderer for debug execution footers.
 *
 * Renders complete debug footers with execution chains, summaries, and wrappers
 * for different output formats (HTML, MarkdownV2, Markdown, Plain).
 */

import type { RenderFormat, Step, StepCollection } from '../types.js';
import { formatCompactNumber, formatDuration, formatToolArgs, truncate } from '../utils/format.js';
import { shortenModelName } from '../utils/model.js';
import { escapeHtml, escapeMarkdownV2, escapePlain } from './escape.js';

export interface FooterRendererConfig {
  /**
   * Output format for rendering.
   * @default 'html'
   */
  format?: RenderFormat;

  /**
   * Whether to include token usage in the summary.
   * @default true
   */
  showTokens?: boolean;

  /**
   * Whether to include model name in the summary.
   * @default true
   */
  showModel?: boolean;

  /**
   * Whether to include duration in the summary.
   * @default true
   */
  showDuration?: boolean;

  /**
   * Maximum length for tool result preview.
   * @default 60
   */
  maxResultPreview?: number;
}

/**
 * Footer renderer for debug execution footers.
 *
 * Renders complete debug footers with execution chains, summaries, and wrappers
 * for different output formats.
 */
export class FooterRenderer {
  private config: Required<FooterRendererConfig>;

  constructor(config?: FooterRendererConfig) {
    this.config = {
      format: config?.format ?? 'html',
      showTokens: config?.showTokens ?? true,
      showModel: config?.showModel ?? true,
      showDuration: config?.showDuration ?? true,
      maxResultPreview: config?.maxResultPreview ?? 60,
    };
  }

  /**
   * Render complete debug footer with wrapper.
   * Returns null if no steps to render.
   */
  render(collection: StepCollection): string | null {
    if (!collection.steps || collection.steps.length === 0) {
      return null;
    }

    const chain = this.renderChain(collection.steps);
    const summary = this.renderSummary(collection);

    const content = chain + (summary ? `\n\n${summary}` : '');

    return this.wrapContent(content);
  }

  /**
   * Render just the execution chain (no wrapper).
   */
  renderChain(steps: Step[]): string {
    const lines: string[] = [];
    const escapeFn = this.getEscapeFunction();

    for (const step of steps) {
      switch (step.type) {
        case 'thinking':
          if (step.thinking) {
            const text = step.thinking.replace(/\n/g, ' ').trim();
            const truncated = text.slice(0, 80);
            const ellipsis = text.length > 80 ? '...' : '';
            lines.push(`⏺ ${escapeFn(truncated + ellipsis)}`);
          } else {
            lines.push(`⏺ Thinking about the request...`);
          }
          break;

        case 'tool_start':
          lines.push(this.formatToolStart(step.toolName, step.args, escapeFn));
          break;

        case 'tool_complete':
          lines.push(this.formatToolStart(step.toolName, step.args, escapeFn));
          lines.push(this.formatToolResult(step.result, escapeFn));
          break;

        case 'tool_error':
          lines.push(this.formatToolStart(step.toolName, step.args, escapeFn));
          lines.push(this.formatToolError(step.error, escapeFn));
          break;

        case 'routing':
          lines.push(`⏺ Routing to ${escapeFn(step.agentName)}`);
          break;

        case 'llm_iteration':
          lines.push(`⏺ LLM iteration ${step.iteration}/${step.maxIterations}`);
          break;

        case 'preparing':
          lines.push(`⏺ Preparing...`);
          break;

        case 'parallel_tools':
          lines.push(`⏺ Running ${step.tools.length} tools in parallel...`);

          step.tools.forEach((tool, i) => {
            const isLast = i === step.tools.length - 1;
            const prefix = isLast ? '└─' : '├─';
            const connector = isLast ? '   ' : '│  ';

            // Tool name with args
            const argsStr = formatToolArgs(tool.args);
            let toolLine = `   ${prefix} ${escapeFn(tool.toolName)}(${escapeFn(argsStr)})`;

            // Add duration if completed
            if (tool.status === 'completed' && tool.durationMs) {
              toolLine += ` · ${formatDuration(tool.durationMs)}`;
            }

            lines.push(toolLine);

            // Result or error
            if (tool.result) {
              const resultPreview = this.truncateResult(tool.result);
              lines.push(`   ${connector}⎿ 🔍 ${escapeFn(resultPreview)}`);
            } else if (tool.error) {
              const errorPreview = truncate(tool.error, this.config.maxResultPreview);
              lines.push(`   ${connector}⎿ ❌ ${escapeFn(errorPreview)}`);
            }
          });
          break;

        case 'subagent': {
          const desc = step.description ? `(${escapeFn(truncate(step.description, 40))})` : '';

          lines.push(`⏺ ${escapeFn(step.agentName)}${desc}`);

          // Build stats summary
          const stats: string[] = [];
          if (step.toolUses) {
            stats.push(`${step.toolUses} tool uses`);
          }
          if (step.tokenCount) {
            stats.push(`${formatCompactNumber(step.tokenCount)} tokens`);
          }
          if (step.durationMs) {
            stats.push(formatDuration(step.durationMs));
          }

          if (step.status === 'completed') {
            const statsStr = stats.length > 0 ? ` (${stats.join(' · ')})` : '';
            lines.push(`  ⎿ Done${statsStr}`);
          } else if (step.status === 'error') {
            const errorPreview = step.error ? truncate(step.error, 50) : 'Error';
            lines.push(`  ⎿ ❌ ${escapeFn(errorPreview)}`);
          }
          break;
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Render just the summary line.
   * Format: ⏱️ 7.6s | 📊 5.4k tokens | 🤖 sonnet-3.5
   */
  renderSummary(collection: StepCollection): string {
    const parts: string[] = [];

    // Duration
    if (this.config.showDuration && collection.durationMs !== undefined) {
      parts.push(`⏱️ ${formatDuration(collection.durationMs)}`);
    }

    // Token usage
    if (this.config.showTokens && collection.tokenUsage) {
      const total = formatCompactNumber(collection.tokenUsage.total);
      parts.push(`📊 ${total} tokens`);
    }

    // Model
    if (this.config.showModel && collection.model) {
      const shortModel = shortenModelName(collection.model);
      parts.push(`🤖 ${shortModel}`);
    }

    return parts.join(' | ');
  }

  // Private helper methods

  private formatToolStart(
    toolName: string,
    args: Record<string, unknown>,
    escapeFn: (text: string) => string
  ): string {
    const argStr = formatToolArgs(args);
    return `⏺ ${escapeFn(toolName)}(${escapeFn(argStr)})`;
  }

  private formatToolResult(result: string, escapeFn: (text: string) => string): string {
    const truncated = this.truncateResult(result);
    return `  ⎿ ${escapeFn(truncated)}`;
  }

  private formatToolError(error: string, escapeFn: (text: string) => string): string {
    const truncated = error.slice(0, this.config.maxResultPreview);
    const ellipsis = error.length > this.config.maxResultPreview ? '...' : '';
    return `  ⎿ ❌ ${escapeFn(truncated + ellipsis)}`;
  }

  private truncateResult(result: string): string {
    const lines = result.split('\n');
    let truncated = lines[0] || '';

    if (truncated.length > this.config.maxResultPreview) {
      truncated = `${truncated.slice(0, this.config.maxResultPreview - 3)}...`;
    }

    if (lines.length > 1) {
      return `${truncated}...`;
    }

    return truncated;
  }

  private getEscapeFunction(): (text: string) => string {
    switch (this.config.format) {
      case 'html':
        return escapeHtml;
      case 'markdownV2':
        return escapeMarkdownV2;
      default:
        return escapePlain;
    }
  }

  private wrapContent(content: string): string {
    switch (this.config.format) {
      case 'html':
        return `<blockquote expandable>\n${content}\n</blockquote>`;

      case 'markdownV2':
        return `**>${content}||`;

      case 'markdown':
        return `<details>\n<summary>Debug Info</summary>\n\n\`\`\`\n${content}\n\`\`\`\n\n</details>`;
      default:
        return content;
    }
  }
}
