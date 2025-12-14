import { createRotator, type ThinkingRotator } from '../messages/thinking-messages.js';
import type { StepCollection } from '../types.js';
import {
  formatCompactNumber,
  formatDuration,
  formatToolArgs,
  formatToolResult,
  truncate,
} from '../utils/format.js';

export interface ProgressRendererConfig {
  /** Interval in ms for rotating thinking verbs (default: 3000) */
  rotationInterval?: number;
  /** Max chars for result preview (default: 60) */
  maxResultPreview?: number;
}

/**
 * Renders live progress during agent execution.
 *
 * This class manages the rendering of step collections into formatted text
 * with rotating thinking messages. It tracks completed and running steps,
 * providing visual feedback during tool execution.
 *
 * Key rendering rules:
 * - Completed steps use ⏺ prefix
 * - Running/current steps use * prefix
 * - Tool results show under tool with "  ⎿ " prefix
 * - Tool errors show with "  ⎿ ❌ " prefix
 * - Thinking shows current rotator message with "* message..." format
 */
export class ProgressRenderer {
  private rotator: ThinkingRotator;
  private config: Required<ProgressRendererConfig>;
  private destroyed = false;

  constructor(config?: ProgressRendererConfig) {
    this.config = {
      rotationInterval: config?.rotationInterval ?? 3000,
      maxResultPreview: config?.maxResultPreview ?? 60,
    };

    this.rotator = createRotator({
      interval: this.config.rotationInterval,
      random: true,
    });
  }

  /**
   * Render the current progress state from a step collection.
   *
   * Format:
   * * Ruminating...  (current thinking - uses * prefix)
   * ⏺ Router → AgentName  (completed routing)
   * * tool_name(args)
   *   ⎿ Running…  (current tool - uses * prefix)
   * ⏺ tool_name(args)
   *   ⎿ result preview  (completed tool)
   */
  render(collection: StepCollection): string {
    if (this.destroyed) {
      return '';
    }

    const lines: string[] = [];
    const steps = collection.steps;

    if (steps.length === 0) {
      // No steps yet - show default thinking
      return `* ${this.rotator.getCurrentMessage()}`;
    }

    // Track completed steps vs current/running step
    // Only tool_start, thinking, and running subagent are considered "running"
    const lastStep = steps[steps.length - 1];
    const isRunning =
      lastStep &&
      (lastStep.type === 'tool_start' ||
        lastStep.type === 'thinking' ||
        (lastStep.type === 'subagent' && lastStep.status === 'running'));

    // Process all steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      const isLast = i === steps.length - 1;
      const prefix = isLast && isRunning ? '*' : '⏺';

      switch (step.type) {
        case 'thinking': {
          if (isLast && isRunning) {
            // Current thinking with rotation
            lines.push(`* ${this.rotator.getCurrentMessage()}`);
          } else {
            // Completed thinking
            lines.push(`⏺ ${step.thinking || 'Thinking'}`);
          }
          break;
        }

        case 'routing': {
          lines.push(`⏺ Router → ${step.agentName}`);
          break;
        }

        case 'tool_start': {
          const argsStr = formatToolArgs(step.args);
          lines.push(`${prefix} ${step.toolName}(${argsStr})`);
          if (isLast && isRunning) {
            lines.push('  ⎿ Running…');
          }
          break;
        }

        case 'tool_complete': {
          const argsStr = formatToolArgs(step.args);
          lines.push(`⏺ ${step.toolName}(${argsStr})`);

          // Format and truncate result
          const resultPreview = truncate(
            formatToolResult(step.result, 1, this.config.maxResultPreview),
            this.config.maxResultPreview
          );
          if (resultPreview) {
            lines.push(`  ⎿ ${resultPreview}`);
          }
          break;
        }

        case 'tool_error': {
          const argsStr = formatToolArgs(step.args);
          lines.push(`⏺ ${step.toolName}(${argsStr})`);

          // Show error
          const errorPreview = truncate(step.error, this.config.maxResultPreview);
          lines.push(`  ⎿ ❌ ${errorPreview}`);
          break;
        }

        case 'preparing': {
          // Always completed, never "running"
          lines.push(`⏺ Preparing response`);
          break;
        }

        case 'llm_iteration': {
          // Always completed, never "running"
          if (step.iteration > 1) {
            lines.push(`⏺ LLM iteration ${step.iteration}/${step.maxIterations}`);
          }
          break;
        }

        case 'parallel_tools': {
          // Render parallel tools with tree structure
          lines.push(`⏺ Running ${step.tools.length} tools in parallel...`);

          step.tools.forEach((tool, i) => {
            const isLast = i === step.tools.length - 1;
            const prefix = isLast ? '└─' : '├─';
            const connector = isLast ? '   ' : '│  ';

            // Tool name with args
            const argsStr = formatToolArgs(tool.args);
            let toolLine = `   ${prefix} ${tool.toolName}(${argsStr})`;

            // Add stats if available
            if (tool.status === 'completed' && tool.durationMs) {
              toolLine += ` · ${formatDuration(tool.durationMs)}`;
            }

            lines.push(toolLine);

            // Result or running status
            if (tool.status === 'running') {
              lines.push(`   ${connector}⎿ Running…`);
            } else if (tool.status === 'completed' && tool.result) {
              const resultPreview = truncate(
                formatToolResult(tool.result, 1, this.config.maxResultPreview),
                this.config.maxResultPreview
              );
              lines.push(`   ${connector}⎿ 🔍 ${resultPreview}`);
            } else if (tool.status === 'error' && tool.error) {
              const errorPreview = truncate(tool.error, this.config.maxResultPreview);
              lines.push(`   ${connector}⎿ ❌ ${errorPreview}`);
            }
          });
          break;
        }

        case 'subagent': {
          const desc = step.description ? `(${truncate(step.description, 40)})` : '';

          if (step.status === 'running') {
            // Running sub-agent uses * prefix
            lines.push(`* ${step.agentName}${desc}`);
            lines.push('  ⎿ Running…');
          } else {
            // Completed/error sub-agent uses ⏺ prefix
            lines.push(`⏺ ${step.agentName}${desc}`);

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
              lines.push(`  ⎿ ❌ ${errorPreview}`);
            }
          }
          break;
        }
      }
    }

    // Fallback if no lines generated
    if (lines.length === 0) {
      return `* ${this.rotator.getCurrentMessage()}`;
    }

    return lines.join('\n');
  }

  /**
   * Start thinking message rotation.
   * Calls onUpdate with rendered progress on each rotation.
   */
  startRotation(_onUpdate: (message: string) => Promise<void>): void {
    if (this.destroyed) {
      return;
    }

    this.rotator.start(async () => {
      // Rotation callback - we don't need to do anything here
      // since render() will call rotator.getCurrentMessage()
      // The consumer will call render() themselves
    });
  }

  /**
   * Stop rotation and clear timers.
   */
  stopRotation(): void {
    this.rotator.stop();
  }

  /**
   * Wait for pending rotation callbacks to complete.
   */
  async waitForPending(): Promise<void> {
    await this.rotator.waitForPending();
  }

  /**
   * Destroy renderer and clean up resources.
   */
  destroy(): void {
    this.destroyed = true;
    this.stopRotation();
  }
}
