/**
 * Artifact reporter for GitHub Actions
 * Writes task results to log files and GitHub Actions job summary
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ReportContext, Reporter } from './types.js';

export interface ArtifactReporterOptions {
  /** Directory to write log files for artifact upload */
  logDir: string;
}

/**
 * Reports task results to GitHub Actions artifacts and job summary
 */
export class ArtifactReporter implements Reporter {
  constructor(private options: ArtifactReporterOptions) {}

  /**
   * Report task results to artifacts
   */
  async report(context: ReportContext): Promise<void> {
    try {
      await Promise.all([this.writeLog(context), this.writeSummary(context)]);
    } catch (error) {
      console.error('[ArtifactReporter] Failed to write artifacts:', error);
      // Don't throw - artifact failures shouldn't break the workflow
    }
  }

  /**
   * Write detailed log file for artifact upload
   */
  private async writeLog(context: ReportContext): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logPath = path.join(this.options.logDir, `${context.taskId}-${timestamp}.log`);

    const logContent = this.formatLog(context);

    await fs.promises.mkdir(this.options.logDir, { recursive: true });
    await fs.promises.writeFile(logPath, logContent, 'utf-8');
  }

  /**
   * Write GitHub Actions job summary
   * https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#adding-a-job-summary
   */
  private async writeSummary(context: ReportContext): Promise<void> {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) {
      console.warn('[ArtifactReporter] GITHUB_STEP_SUMMARY not set, skipping job summary');
      return;
    }

    const summary = this.formatSummary(context);
    await fs.promises.appendFile(summaryPath, summary, 'utf-8');
  }

  /**
   * Format detailed log content
   */
  private formatLog(context: ReportContext): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push(`Agent Task Report - ${new Date().toISOString()}`);
    lines.push('='.repeat(80));
    lines.push('');

    lines.push(`Task ID:      ${context.taskId}`);
    lines.push(`Source:       ${context.taskSource}`);
    lines.push(`Status:       ${context.success ? 'SUCCESS' : 'FAILED'}`);
    lines.push(`Duration:     ${context.duration}ms (${(context.duration / 1000).toFixed(2)}s)`);
    lines.push(`Tokens Used:  ${context.tokensUsed}`);

    if (context.issueNumber) {
      lines.push(`Issue:        #${context.issueNumber}`);
    }

    if (context.branch) {
      lines.push(`Branch:       ${context.branch}`);
    }

    if (context.prUrl) {
      lines.push(`PR URL:       ${context.prUrl}`);
    }

    lines.push('');
    lines.push('-'.repeat(80));
    lines.push('Output:');
    lines.push('-'.repeat(80));
    lines.push('');
    lines.push(context.output);
    lines.push('');

    if (context.error) {
      lines.push('-'.repeat(80));
      lines.push('Error:');
      lines.push('-'.repeat(80));
      lines.push('');
      lines.push(context.error);
      lines.push('');
    }

    lines.push('='.repeat(80));

    return lines.join('\n');
  }

  /**
   * Format GitHub Actions job summary (Markdown)
   */
  private formatSummary(context: ReportContext): string {
    const status = context.success ? '✅ Success' : '❌ Failed';
    const duration = (context.duration / 1000).toFixed(2);

    const lines: string[] = [];

    lines.push('## Agent Task Report');
    lines.push('');
    lines.push('| Property | Value |');
    lines.push('|----------|-------|');
    lines.push(`| Task ID | \`${context.taskId}\` |`);
    lines.push(`| Source | ${context.taskSource} |`);
    lines.push(`| Status | ${status} |`);
    lines.push(`| Duration | ${duration}s |`);
    lines.push(`| Tokens | ${context.tokensUsed} |`);

    if (context.issueNumber) {
      lines.push(`| Issue | #${context.issueNumber} |`);
    }

    if (context.branch) {
      lines.push(`| Branch | \`${context.branch}\` |`);
    }

    if (context.prUrl) {
      lines.push(`| PR | [View PR](${context.prUrl}) |`);
    }

    lines.push('');

    if (context.success) {
      lines.push('### Output');
      lines.push('```');
      const truncatedOutput = context.output.slice(0, 1000);
      lines.push(truncatedOutput);
      if (context.output.length > 1000) {
        lines.push('... (output truncated, see artifacts for full log)');
      }
      lines.push('```');
    } else {
      lines.push('### Error');
      lines.push('```');
      lines.push(context.error || 'Unknown error');
      lines.push('```');
    }

    lines.push('');

    return lines.join('\n');
  }
}
