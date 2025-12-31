/**
 * Autonomous Improvement Cycle
 *
 * Implements the full self-improvement loop:
 * 1. Analyze codebase for opportunities
 * 2. Create improvement plan
 * 3. Execute improvements sequentially
 * 4. Validate after each step
 * 5. Rollback on failure
 * 6. Report results
 */

import { exec } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type {
  ImprovementCycleResult,
  ImprovementOpportunity,
  ImprovementPlan,
  ImprovementResult,
  RollbackResult,
  SelfImprovementConfig,
  ValidationResult,
} from './types.js';

const execAsync = promisify(exec);

// Default configuration
const DEFAULT_CONFIG: Required<
  Omit<SelfImprovementConfig, 'autoRollback' | 'skipTests' | 'skipDeploy'>
> = {
  maxComplexity: 20,
  maxOpportunities: 5,
  allowedTypes: ['bug_fix', 'performance', 'code_quality', 'security', 'test_coverage'],
  blockedFiles: ['node_modules', '.next', 'dist', 'build', '.git', 'coverage', 'results'],
  requiredTypes: [],
  dryRun: false,
};

/**
 * Autonomous Improvement Cycle
 *
 * Orchestrates the full self-improvement process with safety guarantees.
 */
export class ImprovementCycle {
  private config: SelfImprovementConfig;
  private root: string;
  private snapshot: Map<string, string> = new Map();
  private results: ImprovementResult[] = [];

  constructor(config: SelfImprovementConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.root = process.cwd();
  }

  /**
   * Run a complete improvement cycle
   */
  async run(plan: ImprovementPlan): Promise<ImprovementCycleResult> {
    const cycleId = randomUUID();
    const startTime = Date.now();

    console.log(`🔄 Starting improvement cycle ${cycleId}`);
    console.log(`📋 Opportunities: ${plan.opportunities.length}`);

    try {
      // Create snapshot before making changes
      await this.createSnapshot();

      let successful = 0;
      let failed = 0;

      // Execute improvements in order
      for (const opportunityId of plan.executionOrder) {
        const opportunity = plan.opportunities.find((o) => o.id === opportunityId);
        if (!opportunity) {
          console.warn(`⚠️  Opportunity ${opportunityId} not found`);
          continue;
        }

        console.log(`\n🔧 Processing: ${opportunity.title}`);

        const result = await this.executeImprovement(opportunity);
        this.results.push(result);

        if (result.success) {
          successful++;
          console.log(`✅ Success: ${opportunity.title}`);

          // Validate after each improvement
          const validation = await this.validateChanges();
          if (!validation.passed) {
            console.error(`❌ Validation failed: ${validation.errors.join(', ')}`);

            if (this.config.autoRollback !== false) {
              console.log('🔄 Rolling back changes...');
              await this.rollback();
              failed++;
              break;
            }
          }
        } else {
          failed++;
          console.error(`❌ Failed: ${opportunity.title} - ${result.error}`);

          if (this.config.autoRollback !== false) {
            console.log('🔄 Rolling back changes...');
            await this.rollback();
            break;
          }
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Deploy if all successful and deployment enabled
      if (failed === 0 && !this.config.skipDeploy && !this.config.dryRun) {
        console.log('\n🚀 Deploying changes...');
        await this.deploy();
      }

      const summary = this.buildSummary(successful, failed);

      return {
        cycleId,
        startTime,
        endTime,
        duration,
        opportunitiesProcessed: plan.opportunities.length,
        successful,
        failed,
        results: this.results,
        rolledBack: failed > 0 && this.config.autoRollback !== false,
        summary,
      };
    } catch (error) {
      const endTime = Date.now();

      // Rollback on error
      if (this.config.autoRollback !== false) {
        await this.rollback();
      }

      return {
        cycleId,
        startTime,
        endTime,
        duration: endTime - startTime,
        opportunitiesProcessed: plan.opportunities.length,
        successful: 0,
        failed: plan.opportunities.length,
        results: this.results,
        rolledBack: true,
        summary: `Cycle failed with error: ${error}`,
      };
    }
  }

  /**
   * Create snapshot of current state
   */
  private async createSnapshot(): Promise<void> {
    console.log('📸 Creating snapshot...');

    const { stdout } = await execAsync('git status --short', {
      cwd: this.root,
    });

    const modifiedFiles = stdout
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.substring(3).trim());

    for (const file of modifiedFiles) {
      try {
        const content = await readFile(join(this.root, file), 'utf-8');
        this.snapshot.set(file, content);
      } catch {
        // File might have been deleted
      }
    }

    console.log(`✅ Snapshot created with ${this.snapshot.size} files`);
  }

  /**
   * Execute a single improvement
   */
  private async executeImprovement(
    opportunity: ImprovementOpportunity
  ): Promise<ImprovementResult> {
    const startTime = Date.now();

    if (this.config.dryRun) {
      return {
        opportunityId: opportunity.id,
        success: true,
        changes: [],
        output: `[DRY RUN] Would implement: ${opportunity.title}`,
        duration: Date.now() - startTime,
      };
    }

    try {
      // Use LLM to generate and implement the improvement
      const implementation = await this.generateImplementation(opportunity);

      // Apply changes
      const changes = await this.applyChanges(implementation.changes);

      return {
        opportunityId: opportunity.id,
        success: true,
        changes,
        output: implementation.summary,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        opportunityId: opportunity.id,
        success: false,
        changes: [],
        output: '',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate implementation using LLM
   */
  private async generateImplementation(opportunity: ImprovementOpportunity): Promise<{
    changes: Array<{ file: string; content: string }>;
    summary: string;
  }> {
    // This would use the LLM to generate the actual implementation
    // For now, return a placeholder
    return {
      changes: [],
      summary: `Improvement implementation for: ${opportunity.title}`,
    };
  }

  /**
   * Apply changes to files
   */
  private async applyChanges(changes: Array<{ file: string; content: string }>) {
    const appliedChanges: Array<{
      file: string;
      type: 'created' | 'modified' | 'deleted';
      description: string;
    }> = [];

    for (const change of changes) {
      const filePath = join(this.root, change.file);

      try {
        // Check if file exists
        await stat(filePath);
        // File exists, so it's a modification
        await writeFile(filePath, change.content, 'utf-8');
        appliedChanges.push({
          file: change.file,
          type: 'modified',
          description: 'Updated file',
        });
      } catch {
        // File doesn't exist, create it
        await writeFile(filePath, change.content, 'utf-8');
        appliedChanges.push({
          file: change.file,
          type: 'created',
          description: 'Created new file',
        });
      }
    }

    return appliedChanges;
  }

  /**
   * Validate changes
   */
  private async validateChanges(): Promise<ValidationResult> {
    const errors: string[] = [];

    if (this.config.skipTests) {
      return {
        passed: true,
        typeCheck: { success: true },
        lint: { success: true },
        tests: { success: true },
        build: { success: true },
        errors: [],
      };
    }

    try {
      // Type check
      const { stderr: typeCheckErrors } = await execAsync('bun run type-check', {
        cwd: this.root,
        timeout: 60000,
      });
      const typeCheckSuccess = !typeCheckErrors?.toLowerCase().includes('error');
      if (!typeCheckSuccess) {
        errors.push(`Type check failed: ${typeCheckErrors}`);
      }

      // Lint
      const { stderr: lintErrors } = await execAsync('bun run lint', {
        cwd: this.root,
        timeout: 60000,
      });
      const lintSuccess = !lintErrors?.toLowerCase().includes('error');
      if (!lintSuccess) {
        errors.push(`Lint failed: ${lintErrors}`);
      }

      // Tests
      const { stderr: testErrors } = await execAsync('bun run test', {
        cwd: this.root,
        timeout: 120000,
      });
      const testSuccess = !testErrors?.toLowerCase().includes('fail');
      if (!testSuccess) {
        errors.push(`Tests failed: ${testErrors}`);
      }

      // Build
      const { stderr: buildErrors } = await execAsync('bun run build', {
        cwd: this.root,
        timeout: 120000,
      });
      const buildSuccess = !buildErrors?.toLowerCase().includes('error');
      if (!buildSuccess) {
        errors.push(`Build failed: ${buildErrors}`);
      }

      return {
        passed: typeCheckSuccess && lintSuccess && testSuccess && buildSuccess,
        typeCheck: { success: typeCheckSuccess, errors: typeCheckErrors },
        lint: { success: lintSuccess, errors: lintErrors },
        tests: { success: testSuccess, errors: testErrors },
        build: { success: buildSuccess, errors: buildErrors },
        errors,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        passed: false,
        typeCheck: { success: false },
        lint: { success: false },
        tests: { success: false },
        build: { success: false },
        errors,
      };
    }
  }

  /**
   * Rollback changes
   */
  private async rollback(): Promise<RollbackResult> {
    console.log('🔄 Rolling back changes...');

    const revertedFiles: string[] = [];

    for (const [file, content] of this.snapshot) {
      try {
        await writeFile(join(this.root, file), content, 'utf-8');
        revertedFiles.push(file);
      } catch (error) {
        console.error(`Failed to rollback ${file}:`, error);
      }
    }

    // Git reset to clean state
    try {
      await execAsync('git reset --hard', { cwd: this.root });
      await execAsync('git clean -fd', { cwd: this.root });
    } catch {
      // Ignore git errors
    }

    console.log(`✅ Rolled back ${revertedFiles.length} files`);

    return {
      success: true,
      files: revertedFiles,
    };
  }

  /**
   * Deploy changes
   */
  private async deploy(): Promise<void> {
    try {
      await execAsync('bun run deploy', {
        cwd: this.root,
        timeout: 300000,
      });
      console.log('✅ Deployment successful');
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      throw error;
    }
  }

  /**
   * Build summary
   */
  private buildSummary(successful: number, failed: number): string {
    const total = successful + failed;
    const successRate = total > 0 ? ((successful / total) * 100).toFixed(1) : '0';

    let summary = `Improvement cycle completed:\n`;
    summary += `- Total opportunities: ${total}\n`;
    summary += `- Successful: ${successful} (${successRate}%)\n`;
    summary += `- Failed: ${failed}\n`;

    if (this.results.length > 0) {
      summary += `\nDetails:\n`;
      for (const result of this.results) {
        const status = result.success ? '✅' : '❌';
        summary += `${status} ${result.opportunityId}: ${result.output}\n`;
      }
    }

    return summary;
  }
}
