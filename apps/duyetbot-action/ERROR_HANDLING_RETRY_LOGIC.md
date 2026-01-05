# Error Handling and Retry Logic Analysis

## Overview

Analysis of error handling, retry logic, and self-improvement mechanisms in duyetbot-action.

## Self-Improvement Architecture

duyetbot-action implements a sophisticated self-improvement system with four main components:

```text
┌─────────────────────────────────────────────────────────────────┐
│                 Self-Improvement System                        │
└───────────────────────────────┬─────────────────────────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │   Error      │   │   Failure    │   │Verification  │
    │   Analyzer   │   │   Memory     │   │   Loop       │
    │   (284 LOC)  │   │  (387 LOC)   │   │  (296 LOC)   │
    └──────────────┘   └──────────────┘   └──────────────┘
            │                   │                   │
            └───────────────────┼───────────────────┘
                                │
                                ▼
                    ┌──────────────────────────┐
                    │ Self-Improving Loop    │
                    │   (270 LOC)            │
                    └──────────────────────────┘
```

## Component 1: Error Analyzer

**File**: `src/self-improvement/error-analyzer.ts` (284 lines)

**Purpose**: Parse and categorize error messages from various tools.

### Error Patterns

The ErrorAnalyzer matches errors against 10 known patterns:

| Pattern | Regex | Category | Severity | Example |
|---------|--------|----------|----------|---------|
| TypeScript with location | `file.ts(line:col): error TSXXX: message` | type | medium | `src/utils.ts(10:5): error TS2322: Type 'string' is not assignable` |
| TypeScript no location | `error TSXXX: message` | type | medium | `error TS2345: Argument of type 'string' is not assignable` |
| Cannot find module | `Error: Cannot find module '...'` | dependency | high | `Error: Cannot find module 'lodash'` |
| Cannot find symbol | `error: Cannot find symbol` | type_missing | high | `error: Cannot find symbol` |
| Test failure | `FAIL <test name>` | test_failure | medium | `FAIL src/utils.test.ts > utils > should work` |
| Test timeout | `Test timed out after Nms` | test_timeout | medium | `Test timed out after 5000ms` |
| Lint error | `error <file>:<line>:<col> <message>` | lint | low | `error src/file.ts:10:5 Missing semicolon` |
| Merge conflict | `<<<<<<< HEAD` | merge_conflict | high | `<<<<<<< HEAD` |
| Reference error | `ReferenceError: ... is not defined` | runtime_reference | high | `ReferenceError: foo is not defined` |
| Build failed | `Build failed with N error` | build | high | `Build failed with 3 error` |

### Error Categories

```typescript
export enum ErrorCategory {
  UNKNOWN = 'unknown',
  TYPE = 'type',
  TYPE_MISSING = 'type_missing',
  DEPENDENCY = 'dependency',
  TEST_FAILURE = 'test_failure',
  TEST_TIMEOUT = 'test_timeout',
  LINT = 'lint',
  MERGE_CONFLICT = 'merge_conflict',
  RUNTIME_REFERENCE = 'runtime_reference',
  BUILD = 'build',
}
```

### Error Severity Levels

```typescript
export enum ErrorSeverity {
  LOW = 'low',      // Lint warnings, minor issues
  MEDIUM = 'medium', // Type errors, test failures
  HIGH = 'high',     // Build failures, runtime errors
  CRITICAL = 'critical', // Fatal errors, panics
}
```

### Key Methods

#### `parseError(message: string, context?: string): ParsedError`

Parses a single error message:

```typescript
const parsed = errorAnalyzer.parseError(
  "src/utils.ts(10:5): error TS2322: Type 'string' is not assignable to type 'number'"
);

// Returns:
// {
//   category: 'type',
//   severity: 'medium',
//   file: 'src/utils.ts',
//   line: 10,
//   column: 5,
//   code: 'TS2322',
//   message: "Type 'string' is not assignable to type 'number'"
// }
```

#### `parseErrors(output: string): ParsedError[]`

Parses multiple errors from command output:

```typescript
const errors = errorAnalyzer.parseErrors(`
src/utils.ts(10:5): error TS2322: Type mismatch
src/file.ts(15:3): error TS2345: Missing property
`);

// Returns array of 2 ParsedError objects
```

#### `getErrorContext(file: string, line: number, contextLines?: number): Promise<string>`

Gets context lines around an error:

```typescript
const context = await errorAnalyzer.getErrorContext('src/utils.ts', 10, 3);

// Returns:
// >>> 10: const foo: string = bar();
//     11: return foo;
//     12: }
```

#### `groupByCategory(errors: ParsedError[]): Map<ErrorCategory, ParsedError[]>`

Groups errors by category:

```typescript
const groups = errorAnalyzer.groupByCategory(errors);
// Map: 'type' -> [error1, error2], 'lint' -> [error3]
```

#### `getSummary(errors: ParsedError[]): string`

Gets human-readable error summary:

```typescript
const summary = errorAnalyzer.getSummary(errors);
// "Total errors: 5
//   type: 2
//   lint: 2
//   test_failure: 1"
```

## Component 2: Failure Memory

**File**: `src/self-improvement/failure-memory.ts` (387 lines)

**Purpose**: Stores and retrieves learned patterns from past failures.

### Data Structures

#### FailurePattern

```typescript
interface FailurePattern {
  id: string;
  category: ErrorCategory;
  pattern: string;        // Regex pattern to match errors
  symptom: string;       // Example error message
  solution: string;      // Description of fix
  frequency: number;      // How often seen
  lastSeen: number;      // Timestamp
  successRate: number;   // 0.0 to 1.0
  exampleError: string;  // Example error message
}
```

#### LearnedFix

```typescript
interface LearnedFix {
  id: string;
  errorSignature: string;  // Hash of error pattern
  fix: {
    type: 'patch' | 'command' | 'refactor';
    description: string;
    patch?: {            // For code changes
      file: string;
      oldText: string;
      newText: string;
    };
    command?: {          // For dependency fixes
      cwd: string;
      command: string;
      args: string[];
    };
  };
  appliedAt: number;
  worked: boolean;
  timesSeen: number;
  timesSuccessful: number;
}
```

### Key Methods

#### `findSimilarErrors(error: ParsedError): FailurePattern[]`

Finds similar errors in memory:

```typescript
const patterns = memory.findSimilarErrors(error);
// Returns array of patterns, sorted by success rate (highest first)
```

#### `getFixForError(error: ParsedError): FixSuggestion | null`

Gets suggested fix for an error:

```typescript
const fix = memory.getFixForError(error);

// Returns:
// {
//   error: ParsedError,
//   description: "Install missing dependency",
//   confidence: 0.85,  // 85% success rate
//   autoAppliable: true,
//   patch: { file: '...', oldText: '...', newText: '...' },
//   command: { cwd: '...', command: 'npm', args: ['install', 'lodash'] }
// }
```

#### `recordSuccess(error: ParsedError, fix: FixSuggestion): Promise<void>`

Records a successful fix:

```typescript
await memory.recordSuccess(error, {
  description: "Install missing dependency",
  command: { cwd: '/repo', command: 'npm', args: ['install', 'lodash'] }
});
```

#### `recordFailure(error: ParsedError, fix: FixSuggestion): Promise<void>`

Records a failed fix attempt:

```typescript
await memory.recordFailure(error, fix);
// Increments timesSeen, does NOT increment timesSuccessful
```

#### `learnFromFailure(error: ParsedError, solution: string, worked: boolean): Promise<void>`

Learns from a failure event:

```typescript
await memory.learnFromFailure(error, 'Install missing dependency', true);
// Creates new pattern or updates existing one
// Updates successRate using weighted average (30% new data)
```

### Error Signature Generation

The system creates signatures for error matching:

```typescript
private getErrorSignature(error: ParsedError): string {
  const signatureData = {
    category: error.category,
    code: error.code,
    pattern: error.message
      .replace(/'[^']*'/g, "'X'")      // Normalize strings
      .replace(/"[^"]*"/g, '"X"')
      .replace(/\d+/g, 'N')              // Normalize numbers
      .replace(/[\w.-]+@\w[\w.-]+/g, 'email'), // Normalize emails
  };

  return createHash('sha256')
    .update(JSON.stringify(signatureData))
    .digest('hex')
    .substring(0, 16);  // First 16 chars
}
```

### Pattern Matching

```typescript
private matchesPattern(error: ParsedError, pattern: FailurePattern): boolean {
  try {
    const regex = new RegExp(pattern.pattern, 'i');
    return regex.test(error.message);
  } catch {
    return false;
  }
}
```

### Persistence

Memory is persisted to disk:

```
<checkpointDir>/memory/
├── patterns.json  # All learned error patterns
└── fixes.json     # All learned fixes
```

**Pattern Schema**:
```json
{
  "id": "abc123",
  "category": "dependency",
  "pattern": "Cannot find module '.*?'",
  "symptom": "Cannot find module 'lodash'",
  "solution": "Install missing dependency",
  "frequency": 5,
  "lastSeen": 1700000000000,
  "successRate": 0.85,
  "exampleError": "Cannot find module 'lodash'"
}
```

**Fix Schema**:
```json
{
  "id": "def456",
  "errorSignature": "ghi789",
  "fix": {
    "type": "command",
    "description": "Install missing dependency",
    "command": {
      "cwd": "/repo",
      "command": "npm",
      "args": ["install", "lodash"]
    }
  },
  "appliedAt": 1700000000000,
  "worked": true,
  "timesSeen": 10,
  "timesSuccessful": 8
}
```

## Component 3: Verification Loop

**File**: `src/self-improvement/verification-loop.ts` (296 lines)

**Purpose**: Runs quality checks before creating PRs.

### Default Verification Checks

```typescript
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
```

### Key Methods

#### `async verify(): Promise<VerificationResult>`

Runs all verification checks:

```typescript
const result = await verificationLoop.verify();

// Returns:
// {
//   passed: true,
//   checks: [
//     { name: 'type-check', passed: true, duration: 5000, output: '...', errors: [] },
//     { name: 'lint', passed: true, duration: 3000, output: '...', errors: [] },
//     // ...
//   ],
//   totalDuration: 15000,
//   errors: []
// }
```

#### `async verifyOrThrow(): Promise<void>`

Runs verification and throws if failed:

```typescript
try {
  await verificationLoop.verifyOrThrow();
} catch (error) {
  // Error thrown with formatted error summary
}
```

### Check Execution Flow

```typescript
for (const config of checks) {
  console.log(`Running ${config.name}...`);

  // 1. Spawn command with timeout
  const result = await spawnCommand(config.command, config.args, {
    cwd: workDir,
    timeout: config.timeout,
  });

  // 2. Check exit code
  const passed = result.exitCode === 0;

  // 3. Parse errors if failed
  if (!passed) {
    check.errors = errorAnalyzer.parseErrors(result.stdout + result.stderr);
  }

  // 4. Record result
  checks.push({
    name: config.name,
    passed,
    duration,
    output: result.stdout + result.stderr,
    errors: check.errors,
  });
}

// 5. Determine overall pass/fail
const passed = checks.every(c => c.passed || !isCritical(c.name));
```

### Timeout Handling

Commands are killed if they exceed timeout:

```typescript
const timeout = setTimeout(() => {
  killed = true;
  child.kill('SIGKILL');
  reject(new Error(`Command timed out after ${options.timeout}ms`));
}, options.timeout);
```

## Component 4: Self-Improving Agent Loop

**File**: `src/agent/self-improving-loop.ts` (270 lines)

**Purpose**: Extends AgentLoop with verification and error recovery.

### Configuration

```typescript
export interface SelfImprovingAgentLoopOptions extends AgentLoopOptions {
  enableVerification?: boolean;   // Run verification checks
  enableAutoFix?: boolean;       // Apply learned fixes automatically
  maxRecoveryAttempts?: number;   // Max attempts to fix errors (default: 3)
}
```

### Execution Flow

```
Start Self-Improving Agent Loop
        │
        ├─► Initialize verification loop (if enabled)
        ├─► Initialize failure memory (if auto-fix enabled)
        │
        ▼
   Run base AgentLoop
        │
        ├─► If success AND verification enabled
        │   └─► Run verification checks
        │       │
        │       ├─► If passed: Complete
        │       └─► If failed: Start recovery
        │           │
        │           └─► For each error:
        │               ├─► Check for learned fix in memory
        │               ├─► If fix found AND auto-fix enabled
        │               │   ├─► Apply fix
        │               │   ├─► Record success/failure
        │               │   └─► Update recovery attempts
        │               └─► If max attempts reached: Stop
        │
        │           └─► Re-run verification after fixes
        │               ├─► If passed: Complete
        │               └─► If failed: Return with error
        │
        └─► Post-mortem analysis
            ├─► Learn from new error patterns
            └─► Print statistics
```

### Key Methods

#### `override async run(): Promise<SelfImprovingAgentResult>`

Runs agent with verification and recovery:

```typescript
const result = await selfImprovingLoop.run();

// Returns:
// {
//   success: true,
//   output: '...',
//   tokensUsed: 1000,
//   stepsCompleted: 5,
//   verificationPassed: true,
//   recoveryAttempts: 1,
//   fixesApplied: ['Install missing dependency', 'Fix type error']
// }
```

#### `private async recover(initialResult, errors, maxAttempts): Promise<SelfImprovingAgentResult>`

Recovers from verification failures:

```typescript
// 1. Group errors by category
const groups = errorAnalyzer.groupByCategory(errors);

// 2. Try to fix each error
for (const error of errors) {
  if (this.recoveryAttempts >= maxAttempts) {
    break;
  }

  // 3. Check for learned fix
  const suggestedFix = memory.getFixForError(error);

  if (suggestedFix && this.selfImprovementOptions.enableAutoFix) {
    // 4. Apply fix if auto-appliable
    if (suggestedFix.autoAppliable) {
      const success = await this.applyFix(suggestedFix);
      if (success) {
        this.fixesApplied.push(suggestedFix.description);
        await memory.recordSuccess(error, suggestedFix);
      } else {
        await memory.recordFailure(error, suggestedFix);
      }
    }
  }

  this.recoveryAttempts++;
}

// 5. Re-run verification
const reVerification = await this.verificationLoop.verify();
```

#### `private async postMortem(result, verification): Promise<void>`

Post-mortem analysis:

```typescript
// Learn from errors
for (const error of verification.errors) {
  await memory.learnFromFailure(
    error,
    'TODO: Add solution',
    false // Didn't fix it yet
  );
}

console.log(`📚 Learned ${verification.errors.length} new error patterns`);
```

### Fix Application

Currently simplified (TODO in code):

```typescript
private async applyFix(fix: FixSuggestion): Promise<boolean> {
  // TODO: Implement actual fix application
  // Phase 2 would:
  // - Apply patches for code changes
  // - Run commands for dependency fixes
  // - Modify configuration files

  return true; // Simulates fix for now
}
```

## Retry Logic Analysis

### Current Implementation

**Retry Count**: `maxRecoveryAttempts` (default: 3)

**Retry Trigger**: Verification failures only

**Retry Strategy**:
1. Parse errors from failed verification
2. Check memory for learned fixes
3. Apply fix if auto-appliable
4. Re-run verification
5. Repeat until max attempts or all errors fixed

**What is NOT retried**:
- ❌ LLM API call failures (no retry)
- ❌ GitHub API failures (no retry)
- ❌ Tool execution failures (no retry)
- ❌ File operations (no retry)
- ❌ Network errors (no retry)

### Retry Scope

| Component | Has Retry? | Max Attempts | Trigger |
|-----------|-----------|--------------|----------|
| Verification failures | ✅ Yes | 3 | Verification failed |
| LLM calls | ❌ No | 1 | N/A |
| GitHub API | ❌ No | 1 | N/A |
| Tool execution | ❌ No | 1 | N/A |
| File operations | ❌ No | 1 | N/A |

## Error Handling Across Codebase

### Entry Points

All entry points have try-catch blocks:

```typescript
// execute.ts
try {
  const result = await execute(options);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  core.setFailed(`Execute step failed: ${errorMessage}`);
  core.setOutput('error', errorMessage);
}

// prepare.ts
try {
  await prepare(options);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  core.setFailed(`Prepare step failed: ${errorMessage}`);
  core.setOutput('prepare_error', errorMessage);
}

// report.ts
try {
  await report(options);
} catch (error) {
  console.error('Failed to generate report:', error);
}

// update-comment.ts
try {
  await updateComment(options);
} catch (error) {
  console.error('Failed to update comment:', error);
}
```

### Reporter Error Handling

Reporters log errors but don't throw (non-blocking):

```typescript
// GitHub reporter
try {
  await this.reportToGitHub(options);
} catch (error) {
  console.error('[GitHubReporter] Failed to report to GitHub:', error);
  throw error;  // Re-throws for caller to handle
}

// Artifact reporter
try {
  await this.writeArtifacts(options);
} catch (error) {
  console.error('[ArtifactReporter] Failed to write artifacts:', error);
  // Don't throw - artifact failures shouldn't break the workflow
}

// Combined reporter
for (const reporter of this.reporters) {
  try {
    await reporter.report(options);
  } catch (error) {
    console.error(`[CombinedReporter] Reporter ${index} failed:`, error);
    // Log but don't throw - continue with other reporters
  }
}
```

### Task Source Error Handling

Task sources handle errors differently:

```typescript
// GitHub Issues
async markFailed(taskId: string, error: string): Promise<void> {
  // Add 'agent-failed' label
  // Post error comment with error message
}

// Memory MCP
async markFailed(taskId: string, error: string): Promise<void> {
  // Update task status to 'cancelled'
  // Store error in metadata
}

// File Tasks
async markFailed(taskId: string, error: string): Promise<void> {
  // Insert error comment after task line in file
  const errorComment = `  > ❌ Failed: ${error}`;
  lines.splice(lineNumber + 1, 0, errorComment);
}
```

### Mode Error Handling

Modes handle errors with status updates:

```typescript
// Agent mode, Tag mode, Continuous mode
try {
  const result = await agent.run();
  return {
    status: 'success',
    result,
  };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    status: 'error',
    error: errorMessage,
  };
}
```

### Agent Loop Error Handling

```typescript
try {
  const result = await this.runAgentLoop();
  return result;
} catch (err) {
  const error = err instanceof Error ? err.message : String(err);
  // Store error in checkpoint
  checkpoint.lastOutput = error;
  await this.saveCheckpoint(checkpoint);
  return {
    success: false,
    error,
  };
}
```

## Key Findings

### Strengths

1. ✅ **Sophisticated Error Parsing**: 10 error patterns covering TypeScript, lint, tests, build, runtime
2. ✅ **Learning System**: Stores patterns and fixes with success rate tracking
3. ✅ **Verification Loop**: Runs 4 quality checks (type-check, lint, test, build)
4. ✅ **Error Recovery**: Up to 3 recovery attempts with learned fixes
5. ✅ **Context Extraction**: Gets code context around errors
6. ✅ **Error Grouping**: Groups errors by category for better analysis
7. ✅ **Pattern Matching**: Uses regex patterns for error matching
8. ✅ **Memory Persistence**: Saves learned patterns and fixes to disk

### Weaknesses

1. ❌ **Limited Retry Scope**: Only verification failures are retried
2. ❌ **No API Retry**: LLM and GitHub API failures not retried
3. ❌ **No Tool Retry**: Tool execution failures not retried
4. ❌ **Simplified Fix Application**: TODO comment, not implemented yet
5. ❌ **No Exponential Backoff**: Fixed retry attempts, no backoff
6. ❌ **No Circuit Breaker**: No mechanism to stop repeated failures
7. ❌ **No Error Aggregation**: Errors handled individually, not aggregated
8. ❌ **No Dead Letter Queue**: Failed tasks not queued for retry

### Issues Identified

1. **Fix Application Not Implemented**: `applyFix()` is TODO (line 213 in self-improving-loop.ts)
2. **No Rate Limit Handling**: No backoff for GitHub API rate limits
3. **No Timeout Handling**: No timeouts for LLM calls (default timeout used)
4. **No Retry on Network Errors**: Network errors cause immediate failure
5. **No Retry on Tool Failures**: Tool failures not retried
6. **Incomplete Post-Mortem**: Post-mortem marks all errors as not fixed

## Transformation Opportunities

### 1. Move Self-Improvement to Skills

**Current**: 4 hardcoded TypeScript files (1237 lines total)

**Target**: 4 `.md` skill files

Benefits:
- Easier to modify behavior without code changes
- Can add new error patterns via `.md` files
- Can customize verification checks per project

### 2. Add Comprehensive Retry Logic

**Current**: Only verification failures retried

**Target**: Retry for all transient failures

Add retry for:
- LLM API calls (with exponential backoff)
- GitHub API calls (with rate limit handling)
- Tool execution failures (with configurable retries)
- Network errors (with backoff)

### 3. Implement Fix Application

**Current**: TODO comment

**Target**: Full fix application

Implement:
- Patch application for code changes
- Command execution for dependency fixes
- Configuration file modifications
- Rollback mechanism if fix fails

### 4. Add Circuit Breaker

**Current**: No circuit breaker

**Target**: Circuit breaker for repeated failures

Implement:
- Track failure rate per operation
- Open circuit after threshold
- Half-open state for testing
- Auto-close after recovery

### 5. Add Dead Letter Queue

**Current**: Failed tasks marked but not retried

**Target**: Queue failed tasks for later retry

Implement:
- Queue failed tasks
- Exponential backoff for retries
- Max retry limit per task
- Manual retry mechanism

## Next Steps

1. ✅ **Complete**: Document error handling components
2. ✅ **Complete**: Document retry logic
3. ✅ **Complete**: Identify strengths and weaknesses
4. ✅ **Complete**: Identify transformation opportunities
5. ⏭️ **Next**: Document context building for agent execution

## Conclusion

duyetbot-action has a **sophisticated self-improvement system** with:

- **4 main components**: Error Analyzer, Failure Memory, Verification Loop, Self-Improving Agent Loop
- **1237 lines** of hardcoded self-improvement logic
- **10 error patterns** covering TypeScript, lint, tests, build, runtime
- **4 verification checks**: type-check, lint, test, build
- **Up to 3 recovery attempts** with learned fixes

**Key issues**:
- Limited retry scope (only verification failures)
- Fix application not implemented
- No API retry (LLM, GitHub)
- No circuit breaker
- No dead letter queue

**Transformation needs**:
- Move self-improvement logic to `.md` skills
- Add comprehensive retry logic
- Implement fix application
- Add circuit breaker
- Add dead letter queue
