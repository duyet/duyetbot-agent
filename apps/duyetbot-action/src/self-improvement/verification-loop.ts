/**
 * Verification Loop
 *
 * Runs quality checks before creating PRs
 */

import { spawn } from 'node:child_process';
import { errorAnalyzer } from './error-analyzer.js';
import type { ParsedError, VerificationCheck, VerificationResult } from './types.js';
import { ErrorCategory, ErrorSeverity } from './types.js';

/**
 * Verification check configuration
 */
interface VerificationCheckConfig {
  name: string;
  command: string;
  args: string[];
  critical: boolean; // If true, block PR on failure
  timeout: number; // Milliseconds
}

/**
 * Default verification checks
 */
const DEFAULT_CHECKS: VerificationCheckConfig[] = [
  {
    name: 'type-check',
    command: 'bun',
    args: ['run', 'type-check'],
    critical: true,
    timeout: 120000, // 2 minutes
  },
  {
    name: 'lint',
    command: 'bun',
    args: ['run', 'lint'],
    critical: true,
    timeout: 60000, // 1 minute
  },
  {
    name: 'test',
    command: 'bun',
    args: ['run', 'test'],
    critical: true,
    timeout: 180000, // 3 minutes
  },
  {
    name: 'build',
    command: 'bun',
    args: ['run', 'build'],
    critical: true,
    timeout: 180000, // 3 minutes
  },
];

/**
 * Verification loop options
 */
export interface VerificationLoopOptions {
  cwd: string;
  checks?: VerificationCheckConfig[];
  onProgress?: (check: string, status: 'running' | 'passed' | 'failed') => void;
}

/**
 * Run a single verification check
 */
async function runCheck(
  config: VerificationCheckConfig,
  cwd: string,
  onProgress?: (check: string, status: 'running' | 'passed' | 'failed') => void
): Promise<VerificationCheck> {
  const startTime = Date.now();
  onProgress?.(config.name, 'running');

  try {
    const output = await spawnCommand(config.command, config.args, {
      cwd,
      timeout: config.timeout,
    });

    const duration = Date.now() - startTime;
    const passed = output.exitCode === 0;

    const check: VerificationCheck = {
      name: config.name,
      passed,
      duration,
      output: output.stdout + output.stderr,
    };

    // Parse errors from output if failed
    if (!passed) {
      check.errors = errorAnalyzer.parseErrors(check.output);
    }

    onProgress?.(config.name, passed ? 'passed' : 'failed');

    return check;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      name: config.name,
      passed: false,
      duration,
      output: errorMessage,
      errors: [
        {
          category: ErrorCategory.BUILD,
          severity: ErrorSeverity.HIGH,
          message: errorMessage,
        },
      ],
    };
  }
}

/**
 * Spawn a command and return output
 */
function spawnCommand(
  command: string,
  args: string[],
  options: { cwd: string; timeout: number }
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: 'pipe',
    });

    // Timeout handling
    const timeout = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
      reject(new Error(`Command timed out after ${options.timeout}ms`));
    }, options.timeout);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (!killed) {
        resolve({ stdout, stderr, exitCode: code });
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Verification loop class
 */
export class VerificationLoop {
  private checks: VerificationCheckConfig[];

  constructor(private options: VerificationLoopOptions) {
    this.checks = options.checks || DEFAULT_CHECKS;
  }

  /**
   * Run all verification checks
   */
  async verify(): Promise<VerificationResult> {
    const startTime = Date.now();
    const checks: VerificationCheck[] = [];
    const errors: ParsedError[] = [];

    console.log('🔍 Starting verification checks...\n');

    for (const config of this.checks) {
      console.log(`  Running ${config.name}...`);
      const result = await runCheck(config, this.options.cwd, this.options.onProgress);

      checks.push(result);

      if (result.passed) {
        console.log(`  ✅ ${config.name} passed (${result.duration}ms)`);
      } else {
        console.log(`  ❌ ${config.name} failed (${result.duration}ms)`);
        if (result.errors && result.errors.length > 0) {
          console.log(`     Found ${result.errors.length} errors`);
        }
      }

      // Collect errors
      if (result.errors) {
        errors.push(...result.errors);
      }

      // If critical check failed, we could stop early
      // But let's run all checks to give full picture
    }

    const totalDuration = Date.now() - startTime;
    const passed = checks.every((c) => c.passed || !this.isCritical(c.name));

    console.log(
      `\n${passed ? '✅' : '❌'} Verification ${passed ? 'passed' : 'failed'} (${totalDuration}ms)`
    );

    if (errors.length > 0) {
      console.log(`\n📋 Error Summary:`);
      console.log(errorAnalyzer.getSummary(errors));
    }

    return {
      passed,
      checks,
      totalDuration,
      errors,
    };
  }

  /**
   * Check if a check is critical
   */
  private isCritical(name: string): boolean {
    const config = this.checks.find((c) => c.name === name);
    return config?.critical ?? false;
  }

  /**
   * Run verification and throw if failed
   */
  async verifyOrThrow(): Promise<void> {
    const result = await this.verify();

    if (!result.passed) {
      const errorSummary = this.formatErrors(result);
      throw new Error(`Verification failed:\n${errorSummary}`);
    }
  }

  /**
   * Format errors for display
   */
  private formatErrors(result: VerificationResult): string {
    const parts: string[] = [];

    for (const check of result.checks) {
      if (!check.passed) {
        parts.push(`\n${check.name}:`);
        if (check.errors && check.errors.length > 0) {
          for (const error of check.errors.slice(0, 5)) {
            parts.push(`  - ${error.message}`);
            if (error.file) {
              parts.push(`    at ${error.file}:${error.line || 0}`);
            }
          }
          if (check.errors.length > 5) {
            parts.push(`  ... and ${check.errors.length - 5} more errors`);
          }
        } else {
          parts.push(`  ${check.output.split('\n').slice(0, 5).join('\n  ')}`);
        }
      }
    }

    return parts.join('\n');
  }
}

/**
 * Convenience function to run verification
 */
export async function verifyWorkDir(
  workDir: string,
  options?: Partial<VerificationLoopOptions>
): Promise<VerificationResult> {
  const loop = new VerificationLoop({
    cwd: workDir,
    ...options,
  });

  return loop.verify();
}
