/**
 * Reporter system for GitHub Actions agent
 * Combines GitHub and artifact reporters
 */

import { ArtifactReporter } from './artifacts.js';
import { GitHubReporter } from './github.js';
import type { ReportContext, Reporter } from './types.js';

export * from './artifacts.js';
export * from './github.js';
export * from './types.js';

export interface CombinedReporterOptions {
  /** GitHub personal access token */
  githubToken: string;
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Directory for log artifacts */
  logDir: string;
  /** If true, skip GitHub API calls */
  dryRun?: boolean | undefined;
  /** Auto-merge configuration */
  autoMerge?: {
    enabled: boolean;
    requireChecks: string[];
    waitForChecks: boolean;
    timeout: number;
    approveFirst: boolean;
    deleteBranch: boolean;
    closeIssueAfterMerge?: boolean;
  } | undefined;
}

/**
 * Combined reporter that writes to both GitHub and artifacts
 */
export class CombinedReporter implements Reporter {
  private reporters: Reporter[] = [];

  constructor(options: CombinedReporterOptions) {
    this.reporters.push(
      new GitHubReporter({
        token: options.githubToken,
        owner: options.owner,
        repo: options.repo,
        dryRun: options.dryRun,
        autoMerge: options.autoMerge,
      })
    );
    this.reporters.push(
      new ArtifactReporter({
        logDir: options.logDir,
      })
    );
  }

  /**
   * Report to all configured reporters in parallel
   */
  async report(context: ReportContext): Promise<void> {
    const results = await Promise.allSettled(
      this.reporters.map((reporter) => reporter.report(context))
    );

    // Log any reporter failures but don't throw
    for (const [index, result] of results.entries()) {
      if (result.status === 'rejected') {
        console.error(`[CombinedReporter] Reporter ${index} failed:`, result.reason);
      }
    }
  }
}
