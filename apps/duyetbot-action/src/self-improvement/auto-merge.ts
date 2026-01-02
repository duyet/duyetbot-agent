/**
 * Auto-Merge
 *
 * Automatically merges PRs when all checks pass
 */

/**
 * Auto-merge configuration
 */
export interface AutoMergeConfig {
  enabled: boolean;
  requireChecks: string[]; // Required CI checks to pass
  waitForChecks: boolean; // Wait for CI before merging
  timeout: number; // Max wait time for CI (ms)
  approveFirst: boolean; // Approve PR before merging
  deleteBranch: boolean; // Delete branch after merge
}

/**
 * PR status check
 */
export interface PRStatus {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  mergeable: boolean;
  statusChecks: StatusCheck[];
}

/**
 * Status check result
 */
export interface StatusCheck {
  name: string;
  status: 'pending' | 'success' | 'failure';
  url?: string;
}

/**
 * Auto-merge result
 */
export interface AutoMergeResult {
  merged: boolean;
  reason?: string;
  prNumber: number;
  checksPassed: string[];
  checksFailed: string[];
}

/**
 * Auto-merge service
 */
export class AutoMergeService {
  private octokit: any;

  constructor(
    private githubToken: string,
    private owner: string,
    private repo: string,
    octokit?: any
  ) {
    // Allow octokit to be injected for testing
    if (octokit) {
      this.octokit = octokit;
    }
  }

  /**
   * Auto-merge a PR if all checks pass
   */
  async autoMerge(prNumber: number, config: AutoMergeConfig): Promise<AutoMergeResult> {
    console.log(`\n🔄 Auto-merge process for PR #${prNumber}...`);

    // Get Octokit dynamically if not already set
    if (!this.octokit) {
      const { Octokit } = await import('@octokit/rest');
      this.octokit = new Octokit({ auth: this.githubToken });
    }

    // Get PR status
    const prStatus = await this.getPRStatus(prNumber);

    if (!prStatus.mergeable) {
      return {
        merged: false,
        reason: 'PR has merge conflicts',
        prNumber,
        checksPassed: [],
        checksFailed: [],
      };
    }

    // Wait for checks if enabled, or just fetch current status
    let checks: StatusCheck[] = [];
    if (config.waitForChecks) {
      console.log('⏳ Waiting for CI checks...');
      checks = await this.waitForChecks(prNumber, config);

      const failed = checks.filter((c) => c.status === 'failure');
      if (failed.length > 0) {
        return {
          merged: false,
          reason: 'CI checks failed',
          prNumber,
          checksPassed: checks.filter((c) => c.status === 'success').map((c) => c.name),
          checksFailed: failed.map((c) => c.name),
        };
      }
    } else {
      // Get current check status without waiting
      const prStatus = await this.getPRStatus(prNumber);
      checks = prStatus.statusChecks;

      // Verify required checks have passed
      if (config.requireChecks.length > 0) {
        const requiredChecks = checks.filter((c) => config.requireChecks.includes(c.name));
        const failed = requiredChecks.filter((c) => c.status === 'failure');
        const pending = requiredChecks.filter((c) => c.status === 'pending');

        if (failed.length > 0) {
          return {
            merged: false,
            reason: 'CI checks failed',
            prNumber,
            checksPassed: checks.filter((c) => c.status === 'success').map((c) => c.name),
            checksFailed: failed.map((c) => c.name),
          };
        }

        if (pending.length > 0) {
          return {
            merged: false,
            reason: 'CI checks are pending',
            prNumber,
            checksPassed: checks.filter((c) => c.status === 'success').map((c) => c.name),
            checksFailed: [],
          };
        }
      }
    }

    // Approve PR if configured
    if (config.approveFirst) {
      await this.approvePR(prNumber);
    }

    // Merge PR
    console.log('🔀 Merging PR...');
    await this.mergePR(prNumber, config.deleteBranch);

    return {
      merged: true,
      prNumber,
      checksPassed: checks.filter((c) => c.status === 'success').map((c) => c.name),
      checksFailed: [],
    };
  }

  /**
   * Get PR status
   */
  private async getPRStatus(prNumber: number): Promise<PRStatus> {
    const { data: pr } = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    const { data: checks } = await this.octokit.rest.checks.listForRef({
      owner: this.owner,
      repo: this.repo,
      ref: pr.head.sha,
    });

    return {
      number: pr.number,
      title: pr.title,
      state: pr.state === 'open' ? 'open' : pr.state === 'closed' ? 'closed' : 'merged',
      mergeable: pr.mergeable ?? false,
      statusChecks: checks.check_runs.map((run: any) => ({
        name: run.name,
        status:
          run.conclusion === 'success'
            ? 'success'
            : run.conclusion === 'failure'
              ? 'failure'
              : 'pending',
        url: run.html_url,
      })),
    };
  }

  /**
   * Wait for status checks to complete
   */
  private async waitForChecks(prNumber: number, config: AutoMergeConfig): Promise<StatusCheck[]> {
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (Date.now() - startTime < config.timeout) {
      const prStatus = await this.getPRStatus(prNumber);

      // Check if all required checks have completed
      const requiredChecks = config.requireChecks;
      const completedChecks = prStatus.statusChecks.filter((c) => c.status !== 'pending');

      // If all required checks are done, return results
      if (completedChecks.length >= requiredChecks.length) {
        return prStatus.statusChecks;
      }

      console.log(
        `   Still waiting for checks... (${completedChecks.length}/${requiredChecks.length} complete)`
      );
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('Timeout waiting for CI checks');
  }

  /**
   * Approve a PR
   */
  private async approvePR(prNumber: number): Promise<void> {
    await this.octokit.rest.pulls.createReview({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      event: 'APPROVE',
      body: 'Auto-approved by duyetbot-action after successful verification',
    });
    console.log('✅ PR approved');
  }

  /**
   * Merge a PR
   */
  private async mergePR(prNumber: number, deleteBranch: boolean): Promise<void> {
    await this.octokit.rest.pulls.merge({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      commit_title: `Auto-merge by duyetbot-action`,
      commit_message: 'Automatically merged after successful verification',
      merge_method: 'merge',
      delete_branch: deleteBranch,
    });
    console.log('✅ PR merged');
  }
}

/**
 * Convenience function to auto-merge a PR
 */
export async function autoMergePR(
  githubToken: string,
  owner: string,
  repo: string,
  prNumber: number,
  config: Partial<AutoMergeConfig> = {},
  octokit?: any
): Promise<AutoMergeResult> {
  const service = new AutoMergeService(githubToken, owner, repo, octokit);

  const defaultConfig: AutoMergeConfig = {
    enabled: true,
    requireChecks: ['ci', 'test'],
    waitForChecks: true,
    timeout: 600000, // 10 minutes
    approveFirst: true,
    deleteBranch: true,
    ...config,
  };

  return service.autoMerge(prNumber, defaultConfig);
}
