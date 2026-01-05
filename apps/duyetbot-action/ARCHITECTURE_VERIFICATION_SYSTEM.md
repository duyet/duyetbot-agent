# Architecture Design: Verification System

## Overview

Design of **verification system** for duyetbot-action to provide configurable, declarative quality checks before PR creation, with comprehensive error reporting and recovery.

## Goals

1. **Declarative Verification**: Define checks in `.md` skill metadata
2. **Configurable Checks**: Customizable checks per mode/project
3. **Error Reporting**: Detailed error reporting with context
4. **Recovery Integration**: Integrate with error handling and recovery
5. **Parallel Execution**: Run checks in parallel for speed
6. **Timeout Handling**: Per-check and overall timeouts
7. **Metrics Tracking**: Track verification performance

## Directory Structure

```
.claude/skills/
└── self-improvement/
    └── verification-loop.md  # Verification patterns

src/
├── verification/
│   ├── types.ts            # Verification types
│   ├── config.ts           # Verification configuration
│   ├── executor.ts         # Verification executor
│   ├── reporter.ts         # Verification reporter
│   └── metrics.ts          # Verification metrics
```

## Verification Types

### Check Configuration

```typescript
// src/verification/types.ts

export type CheckType =
  | 'command'      // Run shell command
  | 'test'         // Run test suite
  | 'lint'         // Run linter
  | 'type-check'   // Run type checker
  | 'build'        // Run build
  | 'custom'       // Custom check

export interface VerificationCheck {
  // Identification
  name: string;               // Check name
  type: CheckType;           // Check type
  description: string;        // Check description

  // Execution
  command: string;            // Command to run
  args: string[];             // Command arguments
  cwd?: string;               // Working directory
  timeout: number;            // Check timeout (ms)

  // Configuration
  critical: boolean;          // Is this check critical?
  enabled: boolean;           // Is this check enabled?
  retryOnFailure: boolean;    // Retry on failure?
  maxRetries: number;         // Max retries on failure

  // Output parsing
  parseOutput?: (stdout: string, stderr: string) => VerificationResult;

  // Dependencies
  dependsOn?: string[];       // Other checks this depends on

  // Metadata
  tags?: string[];            // Tags for filtering
  category?: string;          // Check category (quality, security, performance)
}

export interface VerificationResult {
  // Basic info
  check: string;               // Check name
  passed: boolean;            // Did check pass?
  duration: number;           // Execution duration (ms)

  // Output
  stdout: string;            // Standard output
  stderr: string;            // Standard error
  exitCode: number;           // Exit code

  // Errors
  errors: VerificationError[]; // Parsed errors

  // Metadata
  timestamp: number;          // When check was run
  retryCount: number;         // Number of retries
  skipped: boolean;           // Was check skipped?
}

export interface VerificationError {
  // Error identification
  id: string;                // Unique error ID
  category: string;           // Error category
  severity: 'error' | 'warning' | 'info';
  message: string;            // Error message

  // Location
  file?: string;              // File where error occurred
  line?: number;              // Line number
  column?: number;            // Column number

  // Additional context
  code?: string;              // Error code (e.g., TS2322)
  suggestion?: string;         // Suggested fix
  context?: string;           // Error context lines

  // Metadata
  raw?: string;              // Raw error output
}
```

### Verification Config

```typescript
// src/verification/config.ts

export interface VerificationConfig {
  // Checks
  checks: VerificationCheck[];

  // Execution
  parallel: boolean;           // Run checks in parallel
  maxParallel: number;         // Max concurrent checks
  overallTimeout: number;       // Overall timeout (ms)

  // Retry
  enableRetry: boolean;        // Enable retry on failure
  maxRetries: number;         // Max retries per check
  retryDelayMs: number;       // Delay between retries

  // Error handling
  failFast: boolean;          // Stop on first critical failure
  continueOnWarning: boolean;  // Continue on non-critical failures

  // Reporting
  reportFormat: 'json' | 'text' | 'html';
  reportPath?: string;          // Path to save report

  // Context
  workDir: string;            // Working directory
  checkpointDir?: string;      // Checkpoint directory
}
```

## Verification Executor

### Executor Implementation

```typescript
// src/verification/executor.ts

export class VerificationExecutor {
  private metrics: VerificationMetrics;
  private dependencyGraph: Map<string, string[]> = new Map();

  constructor(private config: VerificationConfig) {
    this.metrics = new VerificationMetrics();
    this.buildDependencyGraph();
  }

  async execute(): Promise<VerificationSummary> {
    const startTime = Date.now();

    // Filter enabled checks
    const enabledChecks = this.config.checks.filter(c => c.enabled);

    if (enabledChecks.length === 0) {
      return this.createSummary([], 0, Date.now() - startTime);
    }

    // Build execution plan
    const plan = this.buildExecutionPlan(enabledChecks);

    // Execute checks
    const results = this.config.parallel
      ? await this.executeParallel(plan)
      : await this.executeSequential(plan);

    const duration = Date.now() - startTime;

    return this.createSummary(results, plan.length, duration);
  }

  private buildExecutionPlan(checks: VerificationCheck[]): VerificationCheck[][] {
    // Group checks by dependency level
    const levels: VerificationCheck[][] = [];
    const remaining = new Set(checks.map(c => c.name));

    while (remaining.size > 0) {
      const level: VerificationCheck[] = [];
      const toRemove: string[] = [];

      // Find checks with no unsatisfied dependencies
      for (const checkName of remaining) {
        const check = checks.find(c => c.name === checkName)!;
        const deps = check.dependsOn || [];

        // Check if all dependencies are satisfied
        const allDepsSatisfied = deps.every(dep =>
          !remaining.has(dep) && levels.some(l => l.some(c => c.name === dep))
        );

        if (allDepsSatisfied) {
          level.push(check);
          toRemove.push(checkName);
        }
      }

      if (level.length === 0) {
        // Circular dependency detected - break with remaining
        levels.push(
          Array.from(remaining).map(name => checks.find(c => c.name === name)!)
        );
        break;
      }

      levels.push(level);
      toRemove.forEach(dep => remaining.delete(dep));
    }

    return levels;
  }

  private async executeParallel(plan: VerificationCheck[][]): Promise<VerificationResult[]> {
    const allResults: VerificationResult[] = [];
    const maxParallel = this.config.maxParallel || 3;

    for (const level of plan) {
      // Execute level in parallel batches
      const batches = this.chunk(level, maxParallel);

      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map(check => this.executeCheck(check))
        );

        allResults.push(...batchResults);

        // Check fail-fast
        if (this.config.failFast && this.hasCriticalFailure(batchResults)) {
          // Mark remaining checks as skipped
          for (const remainingLevel of plan.slice(plan.indexOf(level) + 1)) {
            for (const check of remainingLevel) {
              allResults.push(this.createSkippedResult(check, 'Stopped due to critical failure'));
            }
          }

          return allResults;
        }
      }
    }

    return allResults;
  }

  private async executeSequential(plan: VerificationCheck[][]): Promise<VerificationResult[]> {
    const allResults: VerificationResult[] = [];

    for (const level of plan) {
      for (const check of level) {
        const result = await this.executeCheck(check);
        allResults.push(result);

        // Check fail-fast
        if (this.config.failFast && this.hasCriticalFailure([result])) {
          // Mark remaining checks as skipped
          for (const remainingLevel of plan.slice(plan.indexOf(level) + 1)) {
            for (const remainingCheck of remainingLevel) {
              allResults.push(this.createSkippedResult(remainingCheck, 'Stopped due to critical failure'));
            }
          }

          return allResults;
        }
      }
    }

    return allResults;
  }

  private async executeCheck(check: VerificationCheck): Promise<VerificationResult> {
    const startTime = Date.now();
    let result: VerificationResult;

    try {
      // Execute check with retry
      if (this.config.enableRetry && check.retryOnFailure) {
        result = await this.executeWithRetry(check);
      } else {
        result = await this.executeSingle(check);
      }

      // Parse errors if custom parser
      if (check.parseOutput) {
        result.errors = check.parseOutput(result.stdout, result.stderr);
      } else {
        result.errors = this.parseDefaultErrors(result);
      }

      // Record metrics
      this.metrics.recordCheck(check, result);

      return result;
    } catch (error) {
      // Create failed result
      result = {
        check: check.name,
        passed: false,
        duration: Date.now() - startTime,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: -1,
        errors: [{
          id: this.generateErrorId(),
          category: 'execution',
          severity: 'error',
          message: error instanceof Error ? error.message : String(error),
          raw: error instanceof Error ? error.stack : undefined,
        }],
        timestamp: startTime,
        retryCount: 0,
        skipped: false,
      };

      this.metrics.recordCheck(check, result);

      return result;
    }
  }

  private async executeSingle(check: VerificationCheck): Promise<VerificationResult> {
    const { spawnCommand } = await import('child_process');

    return new Promise((resolve, reject) => {
      const child = spawnCommand(
        check.command,
        check.args,
        {
          cwd: check.cwd || this.config.workDir,
          stdio: 'pipe',
        }
      );

      let stdout = '';
      let stderr = '';
      let timeoutTimer: NodeJS.Timeout | undefined;

      // Setup timeout
      if (check.timeout > 0) {
        timeoutTimer = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error(`Check timed out after ${check.timeout}ms`));
        }, check.timeout);
      }

      // Collect output
      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8');
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      child.on('close', (exitCode) => {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
        }

        const passed = exitCode === 0;

        resolve({
          check: check.name,
          passed,
          duration: Date.now(),
          stdout,
          stderr,
          exitCode: exitCode || -1,
          errors: [],
          timestamp: Date.now(),
          retryCount: 0,
          skipped: false,
        });
      });

      child.on('error', (error) => {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
        }

        reject(error);
      });
    });
  }

  private async executeWithRetry(check: VerificationCheck): Promise<VerificationResult> {
    const maxRetries = check.maxRetries || this.config.maxRetries || 1;
    const retryDelayMs = this.config.retryDelayMs || 1000;
    let lastResult: VerificationResult;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      lastResult = await this.executeSingle(check);
      lastResult.retryCount = attempt - 1;

      if (lastResult.passed) {
        return lastResult;
      }

      // If not last attempt, wait before retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }

    return lastResult!;
  }

  private parseDefaultErrors(result: VerificationResult): VerificationError[] {
    const errors: VerificationError[] = [];

    // TypeScript errors
    const tsErrors = result.stderr.match(/^.+\((\d+):(\d+)\): error TS(\d+): .+$/gm);
    if (tsErrors) {
      for (const tsError of tsErrors) {
        const match = tsError.match(/^(.+)\((\d+):(\d+)\): error TS(\d+): (.+)$/);
        if (match) {
          errors.push({
            id: this.generateErrorId(),
            category: 'type',
            severity: 'error',
            message: match[4],
            file: match[1],
            line: parseInt(match[2], 10),
            column: parseInt(match[3], 10),
            code: `TS${match[4]}`,
            raw: tsError,
          });
        }
      }
    }

    // Lint errors
    const lintErrors = result.stderr.match(/^.+\s+\d+:\d+\s+.+$/gm);
    if (lintErrors) {
      for (const lintError of lintErrors) {
        errors.push({
          id: this.generateErrorId(),
          category: 'lint',
          severity: 'error',
          message: lintError.trim(),
          raw: lintError,
        });
      }
    }

    // Test failures
    const testFailures = result.stderr.match(/^FAIL.+\)$/gm);
    if (testFailures) {
      for (const testFailure of testFailures) {
        errors.push({
          id: this.generateErrorId(),
          category: 'test',
          severity: 'error',
          message: testFailure.trim(),
          raw: testFailure,
        });
      }
    }

    // Build errors
    if (result.exitCode !== 0 && result.stderr.length > 0) {
      errors.push({
        id: this.generateErrorId(),
        category: 'build',
        severity: 'error',
        message: result.stderr.substring(0, 200),
        raw: result.stderr,
      });
    }

    return errors;
  }

  private hasCriticalFailure(results: VerificationResult[]): boolean {
    return results.some(result => {
      const check = this.config.checks.find(c => c.name === result.check);
      return check?.critical && !result.passed;
    });
  }

  private createSkippedResult(check: VerificationCheck, reason: string): VerificationResult {
    return {
      check: check.name,
      passed: false,
      duration: 0,
      stdout: '',
      stderr: '',
      exitCode: -2,
      errors: [],
      timestamp: Date.now(),
      retryCount: 0,
      skipped: true,
    };
  }

  private createSummary(
    results: VerificationResult[],
    totalChecks: number,
    duration: number
  ): VerificationSummary {
    const passed = results.filter(r => r.passed && !r.skipped).length;
    const failed = results.filter(r => !r.passed && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;

    const hasCriticalFailure = results.some(r => {
      const check = this.config.checks.find(c => c.name === r.check);
      return check?.critical && !r.passed;
    });

    return {
      passed,
      failed,
      skipped,
      totalChecks,
      duration,
      results,
      success: passed > 0 && failed === 0 && !hasCriticalFailure,
      hasCriticalFailure,
    };
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private buildDependencyGraph(): void {
    this.dependencyGraph.clear();

    for (const check of this.config.checks) {
      this.dependencyGraph.set(check.name, check.dependsOn || []);
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  getMetrics(): VerificationMetrics {
    return this.metrics;
  }
}

export interface VerificationSummary {
  passed: number;
  failed: number;
  skipped: number;
  totalChecks: number;
  duration: number;
  results: VerificationResult[];
  success: boolean;
  hasCriticalFailure: boolean;
}
```

## Verification Reporter

### Reporter Implementation

```typescript
// src/verification/reporter.ts

export class VerificationReporter {
  report(summary: VerificationSummary, format: 'text' | 'json' | 'html' = 'text'): string {
    switch (format) {
      case 'text':
        return this.reportText(summary);
      case 'json':
        return this.reportJSON(summary);
      case 'html':
        return this.reportHTML(summary);
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  private reportText(summary: VerificationSummary): string {
    const lines: string[] = [];

    lines.push('Verification Results:');
    lines.push('='.repeat(50));
    lines.push(`Total Checks: ${summary.totalChecks}`);
    lines.push(`Passed: ${summary.passed}`);
    lines.push(`Failed: ${summary.failed}`);
    lines.push(`Skipped: ${summary.skipped}`);
    lines.push(`Duration: ${summary.duration}ms`);
    lines.push(`Success: ${summary.success ? '✓' : '✗'}`);
    lines.push('');

    // Report failed checks
    const failedResults = summary.results.filter(r => !r.passed && !r.skipped);
    if (failedResults.length > 0) {
      lines.push('Failed Checks:');
      lines.push('-'.repeat(50));

      for (const result of failedResults) {
        const check = this.config.checks.find(c => c.name === result.check);
        lines.push(`\n${result.check} (${check?.description || 'No description'})`);
        lines.push(`  Status: ${result.passed ? '✓' : '✗'}`);
        lines.push(`  Duration: ${result.duration}ms`);
        lines.push(`  Exit Code: ${result.exitCode}`);

        if (result.errors.length > 0) {
          lines.push('  Errors:');
          for (const error of result.errors) {
            lines.push(`    - [${error.severity.toUpperCase()}] ${error.message}`);
            if (error.file) {
              lines.push(`      Location: ${error.file}:${error.line || '?'}:${error.column || '?'}`);
            }
            if (error.code) {
              lines.push(`      Code: ${error.code}`);
            }
            if (error.suggestion) {
              lines.push(`      Suggestion: ${error.suggestion}`);
            }
          }
        }

        if (result.stderr.length > 0) {
          lines.push('  Output:');
          lines.push(`    ${result.stderr.split('\n').join('\n    ')}`);
        }
      }
    }

    return lines.join('\n');
  }

  private reportJSON(summary: VerificationSummary): string {
    return JSON.stringify(summary, null, 2);
  }

  private reportHTML(summary: VerificationSummary): string {
    const lines: string[] = [];

    lines.push('<!DOCTYPE html>');
    lines.push('<html>');
    lines.push('<head>');
    lines.push('  <title>Verification Results</title>');
    lines.push('  <style>');
    lines.push('    body { font-family: Arial, sans-serif; margin: 20px; }');
    lines.push('    .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }');
    lines.push('    .passed { color: green; }');
    lines.push('    .failed { color: red; }');
    lines.push('    .skipped { color: gray; }');
    lines.push('    .check { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }');
    lines.push('    .check.passed { border-left: 5px solid green; }');
    lines.push('    .check.failed { border-left: 5px solid red; }');
    lines.push('    .error { background: #fff3cd; padding: 10px; margin: 5px 0; border-radius: 3px; }');
    lines.push('  </style>');
    lines.push('</head>');
    lines.push('<body>');
    lines.push('  <h1>Verification Results</h1>');
    lines.push('');

    // Summary
    lines.push('  <div class="summary">');
    lines.push('    <h2>Summary</h2>');
    lines.push(`    <p>Total Checks: ${summary.totalChecks}</p>`);
    lines.push(`    <p class="passed">Passed: ${summary.passed}</p>`);
    lines.push(`    <p class="failed">Failed: ${summary.failed}</p>`);
    lines.push(`    <p class="skipped">Skipped: ${summary.skipped}</p>`);
    lines.push(`    <p>Duration: ${summary.duration}ms</p>`);
    lines.push(`    <p><strong>Success: ${summary.success ? '✓' : '✗'}</strong></p>`);
    lines.push('  </div>');
    lines.push('');

    // Failed checks
    const failedResults = summary.results.filter(r => !r.passed && !r.skipped);
    if (failedResults.length > 0) {
      lines.push('  <h2>Failed Checks</h2>');

      for (const result of failedResults) {
        const check = this.config.checks.find(c => c.name === result.check);
        lines.push(`  <div class="check ${result.passed ? 'passed' : 'failed'}">`);
        lines.push(`    <h3>${result.check}</h3>`);
        lines.push(`    <p>${check?.description || 'No description'}</p>`);
        lines.push(`    <p>Status: ${result.passed ? '✓' : '✗'}</p>`);
        lines.push(`    <p>Duration: ${result.duration}ms</p>`);

        if (result.errors.length > 0) {
          lines.push('    <h4>Errors</h4>');
          for (const error of result.errors) {
            lines.push(`    <div class="error">`);
            lines.push(`      <strong>Severity:</strong> ${error.severity}<br/>`);
            lines.push(`      <strong>Message:</strong> ${error.message}<br/>`);
            if (error.file) {
              lines.push(`      <strong>Location:</strong> ${error.file}:${error.line || '?'}:${error.column || '?'}<br/>`);
            }
            if (error.code) {
              lines.push(`      <strong>Code:</strong> ${error.code}<br/>`);
            }
            if (error.suggestion) {
              lines.push(`      <strong>Suggestion:</strong> ${error.suggestion}`);
            }
            lines.push(`    </div>`);
          }
        }

        lines.push('  </div>');
      }
    }

    lines.push('</body>');
    lines.push('</html>');

    return lines.join('\n');
  }
}
```

## Verification Metrics

### Metrics Tracking

```typescript
// src/verification/metrics.ts

export interface VerificationMetrics {
  totalVerifications: number;
  successfulVerifications: number;
  failedVerifications: number;

  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  skippedChecks: number;

  averageVerificationDuration: number;
  averageCheckDuration: number;
  longestCheckDuration: number;
  shortestCheckDuration: number;

  checksByName: Record<string, CheckMetrics>;
}

export interface CheckMetrics {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  skippedRuns: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  lastRun: number;
}

export class VerificationMetrics {
  private metrics: VerificationMetrics = {
    totalVerifications: 0,
    successfulVerifications: 0,
    failedVerifications: 0,

    totalChecks: 0,
    passedChecks: 0,
    failedChecks: 0,
    skippedChecks: 0,

    averageVerificationDuration: 0,
    averageCheckDuration: 0,
    longestCheckDuration: 0,
    shortestCheckDuration: 0,

    checksByName: {},
  };

  recordVerification(summary: VerificationSummary): void {
    this.metrics.totalVerifications++;
    this.metrics.totalChecks += summary.totalChecks;
    this.metrics.passedChecks += summary.passed;
    this.metrics.failedChecks += summary.failed;
    this.metrics.skippedChecks += summary.skipped;

    if (summary.success) {
      this.metrics.successfulVerifications++;
    } else {
      this.metrics.failedVerifications++;
    }

    this.updateAverages(summary);
  }

  recordCheck(check: VerificationCheck, result: VerificationResult): void {
    if (!this.metrics.checksByName[check.name]) {
      this.metrics.checksByName[check.name] = {
        totalRuns: 0,
        passedRuns: 0,
        failedRuns: 0,
        skippedRuns: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        lastRun: 0,
      };
    }

    const checkMetrics = this.metrics.checksByName[check.name];
    checkMetrics.totalRuns++;
    checkMetrics.lastRun = Date.now();

    if (result.skipped) {
      checkMetrics.skippedRuns++;
    } else if (result.passed) {
      checkMetrics.passedRuns++;
    } else {
      checkMetrics.failedRuns++;
    }

    // Update duration stats
    if (result.duration > 0) {
      if (result.duration > checkMetrics.maxDuration) {
        checkMetrics.maxDuration = result.duration;
      }
      if (result.duration < checkMetrics.minDuration) {
        checkMetrics.minDuration = result.duration;
      }

      const totalDuration =
        (checkMetrics.averageDuration * (checkMetrics.totalRuns - 1)) +
        result.duration;

      checkMetrics.averageDuration = totalDuration / checkMetrics.totalRuns;
    }
  }

  private updateAverages(summary: VerificationSummary): void {
    // Average verification duration
    const totalDuration =
      (this.metrics.averageVerificationDuration * (this.metrics.totalVerifications - 1)) +
      summary.duration;

    this.metrics.averageVerificationDuration =
      totalDuration / this.metrics.totalVerifications;

    // Average check duration
    if (summary.totalChecks > 0) {
      const avgCheckDuration = summary.duration / summary.totalChecks;
      const totalCheckAvg =
        (this.metrics.averageCheckDuration * (this.metrics.totalChecks - summary.totalChecks)) +
        avgCheckDuration;

      this.metrics.averageCheckDuration =
        totalCheckAvg / this.metrics.totalChecks;
    }
  }

  getMetrics(): VerificationMetrics {
    return { ...this.metrics };
  }

  getCheckMetrics(checkName: string): CheckMetrics | undefined {
    return this.metrics.checksByName[checkName];
  }

  getSummary(): string {
    const metrics = this.metrics;

    const successRate = metrics.totalVerifications > 0
      ? `${(metrics.successfulVerifications / metrics.totalVerifications * 100).toFixed(1)}%`
      : '0%';

    const checkPassRate = metrics.totalChecks > 0
      ? `${(metrics.passedChecks / metrics.totalChecks * 100).toFixed(1)}%`
      : '0%';

    return `
Verification Metrics:
--------------------
Total Verifications: ${metrics.totalVerifications}
Successful: ${metrics.successfulVerifications} (${successRate})
Failed: ${metrics.failedVerifications}

Total Checks: ${metrics.totalChecks}
Passed: ${metrics.passedChecks} (${checkPassRate})
Failed: ${metrics.failedChecks}
Skipped: ${metrics.skippedChecks}

Average Verification Duration: ${metrics.averageVerificationDuration.toFixed(0)}ms
Average Check Duration: ${metrics.averageCheckDuration.toFixed(0)}ms
Longest Check Duration: ${metrics.longestCheckDuration}ms
Shortest Check Duration: ${metrics.shortestCheckDuration}ms
    `.trim();
  }

  reset(): void {
    this.metrics = {
      totalVerifications: 0,
      successfulVerifications: 0,
      failedVerifications: 0,

      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      skippedChecks: 0,

      averageVerificationDuration: 0,
      averageCheckDuration: 0,
      longestCheckDuration: 0,
      shortestCheckDuration: 0,

      checksByName: {},
    };
  }
}
```

## Integration with Skill System

### Verification Skill

```markdown
---
name: verification-loop
type: self-improvement
version: 1.0.0
author: duyetbot
description: Runs verification checks before PR creation
triggers:
  - pre_pr_creation
  - verification_requested
  - quality_check
---

# Verification Loop

## Purpose

Run quality checks before creating a PR to ensure code changes are ready for review.

## Checks

```yaml
checks:
  - name: type-check
    type: type-check
    description: Run TypeScript type checker
    command: bun
    args: ['run', 'type-check']
    timeout: 120000  # 2 minutes
    critical: true
    enabled: true
    retryOnFailure: false
    category: quality

  - name: lint
    type: lint
    description: Run linter
    command: bun
    args: ['run', 'lint']
    timeout: 60000  # 1 minute
    critical: true
    enabled: true
    retryOnFailure: true
    maxRetries: 1
    category: quality

  - name: test
    type: test
    description: Run test suite
    command: bun
    args: ['run', 'test']
    timeout: 180000  # 3 minutes
    critical: true
    enabled: true
    retryOnFailure: true
    maxRetries: 2
    category: quality

  - name: build
    type: build
    description: Build project
    command: bun
    args: ['run', 'build']
    timeout: 180000  # 3 minutes
    critical: true
    enabled: true
    retryOnFailure: false
    category: quality
```

## Execution

When triggered, the verification loop will:

1. Execute all enabled checks in order
2. Retry failed checks if `retryOnFailure: true`
3. Parse errors from check output
4. Stop on first critical failure if `failFast: true`
5. Generate verification report
6. Report results to error handling system

## Error Recovery

If verification fails:

1. Parse errors from failed checks
2. Check error handler for recovery strategies
3. Apply recovery strategies if available
4. Re-run verification after recovery
5. If max retries exceeded, mark verification as failed

## Output

The verification loop will produce:

- Verification summary (text/JSON/HTML)
- List of failed checks
- Parsed errors with locations
- Recovery actions taken
- Metrics and statistics

## Context

The verification loop has access to:

- Working directory: `{{ workDir }}`
- Checkpoint directory: `{{ checkpointDir }}`
- Task context: `{{ task }}`
- GitHub context: `{{ github }}`
```

## Migration Path

### Phase 1: Foundation (P0)

1. Create `.claude/skills/self-improvement/verification-loop.md`
2. Implement `VerificationExecutor` class
3. Implement `VerificationReporter` class
4. Implement `VerificationMetrics` class
5. Add default check configurations

### Phase 2: Integration (P1)

6. Update mode system to use verification
7. Update self-improvement to use verification
8. Update error handling to use verification errors
9. Update recovery to use verification results
10. Add verification to dashboard

### Phase 3: Optimization (P2)

11. Add custom check configurations
12. Add check dependency management
13. Add check caching
14. Add check performance profiling
15. Add check history tracking

## Error Handling

### Verification Errors

| Error | Handling |
|-------|-----------|
| Check timeout | Mark as failed, log timeout |
| Check not found | Skip check, log warning |
| Parse error | Use raw output, log warning |
| Execution error | Mark as failed, include error output |

## Testing Strategy

### Unit Tests

```typescript
// tests/verification/executor.test.ts
describe('VerificationExecutor', () => {
  it('should execute single check', async () => {
    const config: VerificationConfig = {
      checks: [
        {
          name: 'test-check',
          type: 'command',
          description: 'Test check',
          command: 'echo',
          args: ['hello'],
          timeout: 5000,
          critical: false,
          enabled: true,
          retryOnFailure: false,
        },
      ],
      parallel: false,
      overallTimeout: 10000,
      workDir: process.cwd(),
    };

    const executor = new VerificationExecutor(config);
    const summary = await executor.execute();

    expect(summary.totalChecks).toBe(1);
    expect(summary.passed).toBe(1);
    expect(summary.success).toBe(true);
  });

  it('should execute checks in parallel', async () => {
    const config: VerificationConfig = {
      checks: [
        {
          name: 'check-1',
          type: 'command',
          description: 'Check 1',
          command: 'sleep',
          args: ['0.5'],
          timeout: 5000,
          critical: false,
          enabled: true,
          retryOnFailure: false,
        },
        {
          name: 'check-2',
          type: 'command',
          description: 'Check 2',
          command: 'sleep',
          args: ['0.5'],
          timeout: 5000,
          critical: false,
          enabled: true,
          retryOnFailure: false,
        },
      ],
      parallel: true,
      maxParallel: 2,
      overallTimeout: 10000,
      workDir: process.cwd(),
    };

    const executor = new VerificationExecutor(config);
    const startTime = Date.now();
    const summary = await executor.execute();
    const duration = Date.now() - startTime;

    expect(summary.totalChecks).toBe(2);
    expect(duration).toBeLessThan(2000); // Should be faster than sequential
  });

  it('should fail fast on critical failure', async () => {
    const config: VerificationConfig = {
      checks: [
        {
          name: 'failing-check',
          type: 'command',
          description: 'Failing check',
          command: 'exit',
          args: ['1'],
          timeout: 5000,
          critical: true,
          enabled: true,
          retryOnFailure: false,
        },
        {
          name: 'should-be-skipped',
          type: 'command',
          description: 'Should be skipped',
          command: 'echo',
          args: ['skipped'],
          timeout: 5000,
          critical: false,
          enabled: true,
          retryOnFailure: false,
        },
      ],
      parallel: false,
      failFast: true,
      overallTimeout: 10000,
      workDir: process.cwd(),
    };

    const executor = new VerificationExecutor(config);
    const summary = await executor.execute();

    expect(summary.totalChecks).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.success).toBe(false);
  });
});
```

## Next Steps

1. Implement `VerificationExecutor` class
2. Implement `VerificationReporter` class
3. Implement `VerificationMetrics` class
4. Create `.claude/skills/self-improvement/verification-loop.md`
5. Write comprehensive tests
6. Integrate with mode system
7. Integrate with self-improvement
8. Integrate with error handling
9. Integrate with recovery
10. Add verification to dashboard
11. Add documentation

## Conclusion

This design provides:

- ✅ **Declarative verification**: Define checks in `.md` skill metadata
- ✅ **Configurable checks**: Customizable checks per mode/project
- ✅ **Error reporting**: Detailed error reporting with context
- ✅ **Recovery integration**: Integrate with error handling and recovery
- ✅ **Parallel execution**: Run checks in parallel for speed
- ✅ **Timeout handling**: Per-check and overall timeouts
- ✅ **Metrics tracking**: Track verification performance
- ✅ **Multiple formats**: Text, JSON, HTML output
- ✅ **Dependency management**: Execute checks in correct order
- ✅ **Retry support**: Configurable retry on failure
- ✅ **Fail-fast support**: Stop on critical failures

**Estimated Implementation Time**: 2-3 hours  
**Risk**: MEDIUM  
**Dependencies**: Error handling system (arch-4)
