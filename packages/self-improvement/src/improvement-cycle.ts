/**
 * Improvement Cycle
 *
 * Executes improvement plans with safety validation and rollback.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  ImprovementCycleResult,
  ImprovementOpportunity,
  ImprovementPlan,
  ImprovementResult,
  SelfImprovementConfig,
} from './types.js';

const execAsync = promisify(exec);

/**
 * Improvement Cycle Executor
 *
 * Executes improvement plans with validation and automatic rollback.
 */
export class ImprovementCycle {
  private config: SelfImprovementConfig;
  private root: string;
  private snapshotBranch?: string;

  constructor(config: SelfImprovementConfig = {}) {
    this.config = config;
    this.root = process.cwd();
  }

  /**
   * Run complete improvement cycle
   */
  async run(plan: ImprovementPlan): Promise<ImprovementCycleResult> {
    const results: ImprovementResult[] = [];

    // Create snapshot if enabled
    if (this.config.createSnapshot !== false) {
      await this.createSnapshot();
    }

    // Execute each opportunity
    for (const opportunity of plan.opportunities) {
      const result = await this.executeOpportunity(opportunity);
      results.push(result);

      // Stop on failure if auto-rollback is enabled
      if (!result.success && this.config.autoRollback !== false) {
        console.error(`\n❌ Failed: ${opportunity.title}`);
        console.error(`   ${result.error}`);

        await this.rollback();
        return this.buildResult(plan, results, true);
      }
    }

    return this.buildResult(plan, results, false);
  }

  /**
   * Create git snapshot before changes
   */
  private async createSnapshot(): Promise<void> {
    const snapshotId = Date.now();
    this.snapshotBranch = `improvement-snapshot-${snapshotId}`;

    try {
      // Create snapshot branch
      await execAsync(`git checkout -b ${this.snapshotBranch}`, {
        cwd: this.root,
      });
    } catch (_error) {
      console.warn('⚠️  Could not create snapshot branch');
    }
  }

  /**
   * Rollback changes from snapshot
   */
  private async rollback(): Promise<void> {
    if (!this.snapshotBranch) {
      return;
    }

    try {
      // Switch back to master/main
      await execAsync('git checkout master || git checkout main', {
        cwd: this.root,
      });

      // Delete snapshot branch
      await execAsync(`git branch -D ${this.snapshotBranch}`, {
        cwd: this.root,
      });

      console.log('🔄 Changes rolled back');
    } catch (_error) {
      console.warn('⚠️  Could not rollback changes');
    }
  }

  /**
   * Execute a single improvement opportunity
   */
  private async executeOpportunity(
    opportunity: ImprovementOpportunity
  ): Promise<ImprovementResult> {
    console.log(`\n🔧 Executing: ${opportunity.title}`);

    try {
      // For now, this is a placeholder
      // In a full implementation, this would:
      // 1. Use AI to generate the fix
      // 2. Apply the changes
      // 3. Run validation tests
      // 4. Commit if successful

      const changes: string[] = [];

      // Run validation
      const validation = await this.validateChanges();

      if (!validation.passed) {
        return {
          opportunity,
          success: false,
          changes,
          error: validation.error,
        };
      }

      return {
        opportunity,
        success: true,
        changes,
      };
    } catch (error) {
      return {
        opportunity,
        success: false,
        changes: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Validate changes before committing
   */
  private async validateChanges(): Promise<{
    passed: boolean;
    error?: string;
  }> {
    try {
      // Type check
      await execAsync('bun run type-check', { cwd: this.root });

      // Lint
      await execAsync('bun run lint', { cwd: this.root });

      // Tests
      await execAsync('bun run test', { cwd: this.root });

      return { passed: true };
    } catch (error) {
      return {
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build final cycle result
   */
  private buildResult(
    plan: ImprovementPlan,
    results: ImprovementResult[],
    rolledBack: boolean
  ): ImprovementCycleResult {
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    const summary = `
Improvement Cycle Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Succeeded: ${succeeded}
❌ Failed: ${failed}
🔄 Rolled Back: ${rolledBack ? 'Yes' : 'No'}
`.trim();

    return {
      plan,
      results,
      succeeded,
      failed,
      rolledBack,
      summary,
    };
  }
}
