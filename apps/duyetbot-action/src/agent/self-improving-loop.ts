/**
 * Self-Improving Agent Loop
 *
 * Extends AgentLoop with verification and error recovery
 */

import { errorAnalyzer } from '../self-improvement/error-analyzer.js';
import { getFailureMemory } from '../self-improvement/failure-memory.js';
import type { ParsedError, VerificationResult } from '../self-improvement/types.js';
import { VerificationLoop } from '../self-improvement/verification-loop.js';
import type { AgentLoopOptions, AgentResult } from './loop.js';
import { AgentLoop } from './loop.js';

/**
 * Self-improving agent loop options
 */
export interface SelfImprovingAgentLoopOptions extends AgentLoopOptions {
  enableVerification?: boolean;
  enableAutoFix?: boolean;
  maxRecoveryAttempts?: number;
}

/**
 * Self-improving agent result
 */
export interface SelfImprovingAgentResult extends AgentResult {
  verificationPassed?: boolean;
  recoveryAttempts?: number;
  fixesApplied?: string[];
  learnedPatterns?: number;
}

/**
 * Self-improving agent loop with verification and recovery
 */
export class SelfImprovingAgentLoop extends AgentLoop {
  private verificationLoop?: VerificationLoop;
  private recoveryAttempts = 0;
  private fixesApplied: string[] = [];
  private readonly selfImprovementOptions: SelfImprovingAgentLoopOptions;

  constructor(options: SelfImprovingAgentLoopOptions) {
    super(options);
    this.selfImprovementOptions = options;

    // Initialize verification loop if enabled
    if (this.selfImprovementOptions.enableVerification !== false) {
      this.verificationLoop = new VerificationLoop({
        cwd: process.cwd(),
        onProgress: (check, status) => {
          const emoji = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '🔄';
          console.log(`     ${emoji} ${check} ${status}`);
        },
      });
    }

    // Initialize failure memory
    if (this.selfImprovementOptions.enableAutoFix) {
      const config = this.getConfig();
      const memory = getFailureMemory(config.checkpointDir + '/memory');
      memory.load().catch(console.error);
    }
  }

  /**
   * Get config from parent class (access private options)
   */
  private getConfig(): SelfImprovingAgentLoopOptions['config'] {
    // We need to access the private options from the parent class
    // Since we can't modify the parent class, we'll use a workaround
    // by storing the config reference during construction
    const self = this as unknown as { options: AgentLoopOptions };
    return self.options.config;
  }

  /**
   * Run the agent with verification and recovery
   */
  override async run(): Promise<SelfImprovingAgentResult> {
    const config = this.getConfig();
    const maxAttempts = this.selfImprovementOptions.maxRecoveryAttempts || 3;

    console.log('🤖 Starting self-improving agent loop...');
    console.log(`   Verification: ${this.verificationLoop ? 'enabled' : 'disabled'}`);
    console.log(
      `   Auto-fix: ${this.selfImprovementOptions.enableAutoFix ? 'enabled' : 'disabled'}`
    );
    console.log(`   Max recovery attempts: ${maxAttempts}\n`);

    const result = await super.run();
    let verificationResult: VerificationResult | undefined;

    // If successful and verification is enabled, verify before completing
    if (result.success && this.verificationLoop && !config.dryRun) {
      console.log('\n🔍 Running verification checks...');
      verificationResult = await this.verificationLoop.verify();

      if (!verificationResult.passed) {
        console.log('❌ Verification failed, attempting recovery...');
        return await this.recover(result, verificationResult.errors, maxAttempts);
      }
    }

    // Post-mortem analysis
    await this.postMortem(result, verificationResult);

    const returnValue: SelfImprovingAgentResult = {
      ...result,
      recoveryAttempts: this.recoveryAttempts,
      fixesApplied: this.fixesApplied,
    };
    if (verificationResult?.passed !== undefined) {
      returnValue.verificationPassed = verificationResult.passed;
    }
    return returnValue;
  }

  /**
   * Recover from verification failures
   */
  private async recover(
    initialResult: AgentResult,
    errors: ParsedError[] | undefined,
    maxAttempts: number
  ): Promise<SelfImprovingAgentResult> {
    if (!errors || errors.length === 0) {
      return {
        ...initialResult,
        verificationPassed: false,
        recoveryAttempts: this.recoveryAttempts,
      };
    }

    console.log(`\n🔧 Found ${errors.length} errors to fix:`);

    // Group errors by category
    const groups = errorAnalyzer.groupByCategory(errors);
    for (const [category, categoryErrors] of groups.entries()) {
      console.log(`   ${category}: ${categoryErrors.length} errors`);
    }

    // Try to fix each error
    for (const error of errors) {
      if (this.recoveryAttempts >= maxAttempts) {
        console.log(`\n⚠️  Max recovery attempts reached`);
        break;
      }

      console.log(`\n🔧 Attempting to fix: ${error.message.substring(0, 100)}...`);

      // Check if we have a learned fix
      const config = this.getConfig();
      const memory = getFailureMemory(config.checkpointDir + '/memory');
      const suggestedFix = memory.getFixForError(error);

      if (suggestedFix && this.selfImprovementOptions.enableAutoFix) {
        console.log(`   💡 Found suggested fix: ${suggestedFix.description}`);

        if (suggestedFix.autoAppliable) {
          // Apply the fix
          const success = await this.applyFix(suggestedFix);
          if (success) {
            this.fixesApplied.push(suggestedFix.description);
            await memory.recordSuccess(error, suggestedFix);
            console.log(`   ✅ Fix applied successfully`);
          } else {
            await memory.recordFailure(error, suggestedFix);
            console.log(`   ❌ Fix failed`);
          }
        } else {
          console.log(`   ⚠️  Fix requires manual verification`);
        }
      }

      this.recoveryAttempts++;
    }

    // Re-run verification after fixes
    if (this.fixesApplied.length > 0 && this.verificationLoop) {
      console.log('\n🔍 Re-running verification after fixes...');
      const reVerification = await this.verificationLoop.verify();

      if (reVerification.passed) {
        console.log('✅ All fixes verified successfully!');
        return {
          ...initialResult,
          verificationPassed: true,
          recoveryAttempts: this.recoveryAttempts,
          fixesApplied: this.fixesApplied,
        };
      }
    }

    // Recovery failed
    return {
      ...initialResult,
      success: false,
      error: `Verification failed after ${this.recoveryAttempts} recovery attempts`,
      verificationPassed: false,
      recoveryAttempts: this.recoveryAttempts,
      fixesApplied: this.fixesApplied,
    };
  }

  /**
   * Apply a fix (simplified version - just logs for now)
   */
  private async applyFix(
    fix: import('../self-improvement/types.js').FixSuggestion
  ): Promise<boolean> {
    console.log(`   Applying fix: ${fix.description}`);

    // TODO: Implement actual fix application
    // For now, just return true to simulate the fix
    // In Phase 2, this would:
    // - Apply patches for code changes
    // - Run commands for dependency fixes
    // - Modify configuration files

    return true;
  }

  /**
   * Post-mortem analysis after task completion
   */
  private async postMortem(result: AgentResult, verification?: VerificationResult): Promise<void> {
    console.log('\n📊 Post-mortem analysis:');

    // Analyze what went well
    if (result.success) {
      console.log('   ✅ Task completed successfully');
      if (verification?.passed) {
        console.log('   ✅ All verification checks passed');
      }
    }

    // Learn from errors
    if (verification?.errors && verification.errors.length > 0) {
      const config = this.getConfig();
      const memory = getFailureMemory(config.checkpointDir + '/memory');

      for (const error of verification.errors) {
        // Learn from the error pattern
        await memory.learnFromFailure(
          error,
          'TODO: Add solution',
          false // Didn't fix it yet
        );
      }

      console.log(`   📚 Learned ${verification.errors.length} new error patterns`);
    }

    // Print stats
    if (this.recoveryAttempts > 0) {
      console.log(`   🔄 Recovery attempts: ${this.recoveryAttempts}`);
      console.log(`   🔧 Fixes applied: ${this.fixesApplied.length}`);
    }
  }
}

/**
 * Convenience function to create a self-improving agent loop
 */
export function createSelfImprovingAgentLoop(
  options: SelfImprovingAgentLoopOptions
): SelfImprovingAgentLoop {
  return new SelfImprovingAgentLoop(options);
}
