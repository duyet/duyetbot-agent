# Architecture Design: Error Handling System

## Overview

Design of **comprehensive error handling system** for duyetbot-action to provide robust error detection, categorization, recovery, retry policies, and reporting.

## Goals

1. **Error Detection**: Detect and categorize errors from all sources (LLM, GitHub API, tools, verification)
2. **Error Recovery**: Apply appropriate recovery strategies based on error type
3. **Retry Policies**: Configurable retry logic with exponential backoff for transient failures
4. **Error Reporting**: Comprehensive error metrics and logging
5. **Error Aggregation**: Group related errors for analysis
6. **Error Profiles**: Named error handling strategies for different scenarios
7. **Integration**: Seamless integration with skill/subagent system

## Directory Structure

```
.claude/skills/
├── self-improvement/
│   ├── error-analyzer.md
│   ├── error-recovery.md
│   └── error-reporting.md

src/
├── error/
│   ├── detector.ts         # Error detection and categorization
│   ├── categorizer.ts      # Error categorization engine
│   ├── recovery.ts         # Error recovery strategies
│   ├── retry.ts           # Retry policy engine
│   ├── aggregator.ts      # Error aggregation
│   ├── reporter.ts        # Error reporting and metrics
│   ├── profiles.ts        # Error handling profiles
│   └── context.ts        # Error context enrichment
```

## Error Taxonomy

### Error Categories

```typescript
// src/error/types.ts

export enum ErrorCategory {
  // LLM Errors
  LLM_RATE_LIMIT = 'llm_rate_limit',
  LLM_TIMEOUT = 'llm_timeout',
  LLM_QUOTA_EXCEEDED = 'llm_quota_exceeded',
  LLM_INVALID_REQUEST = 'llm_invalid_request',
  LLM_SERVER_ERROR = 'llm_server_error',

  // GitHub API Errors
  GITHUB_RATE_LIMIT = 'github_rate_limit',
  GITHUB_TIMEOUT = 'github_timeout',
  GITHUB_NOT_FOUND = 'github_not_found',
  GITHUB_FORBIDDEN = 'github_forbidden',
  GITHUB_SERVER_ERROR = 'github_server_error',
  GITHUB_VALIDATION = 'github_validation',

  // Tool Execution Errors
  TOOL_TIMEOUT = 'tool_timeout',
  TOOL_NOT_FOUND = 'tool_not_found',
  TOOL_EXECUTION = 'tool_execution',
  TOOL_PERMISSION = 'tool_permission',

  // Verification Errors
  VERIFICATION_FAILED = 'verification_failed',
  TYPE_ERROR = 'type_error',
  LINT_ERROR = 'lint_error',
  TEST_FAILURE = 'test_failure',
  BUILD_FAILED = 'build_failed',

  // File System Errors
  FILE_NOT_FOUND = 'file_not_found',
  FILE_PERMISSION = 'file_permission',
  FILE_SYSTEM = 'file_system',

  // Network Errors
  NETWORK_ERROR = 'network_error',
  DNS_ERROR = 'dns_error',
  CONNECTION_ERROR = 'connection_error',

  // Configuration Errors
  CONFIG_INVALID = 'config_invalid',
  CONFIG_MISSING = 'config_missing',

  // Skill/System Errors
  SKILL_NOT_FOUND = 'skill_not_found',
  SKILL_VALIDATION = 'skill_validation',
  SKILL_TIMEOUT = 'skill_timeout',
  SYSTEM_ERROR = 'system_error',
}

export enum ErrorSeverity {
  LOW = 'low',        // Non-critical, can continue
  MEDIUM = 'medium',  // Degraded functionality
  HIGH = 'high',      // Critical functionality affected
  CRITICAL = 'critical', // System cannot continue
}

export enum ErrorRecoverability {
  RETRYABLE = 'retryable',        // Can retry with backoff
  RECOVERABLE = 'recoverable',    // Can apply recovery strategy
  PERMANENT = 'permanent',        // Cannot recover
  UNKNOWN = 'unknown',            // Need to analyze
}
```

### Error Context

```typescript
// src/error/types.ts

export interface ErrorContext {
  // Error identification
  errorId: string;              // Unique error ID (UUID)
  timestamp: number;            // Error timestamp
  category: ErrorCategory;       // Error category
  severity: ErrorSeverity;      // Error severity
  recoverability: ErrorRecoverability; // Can we recover?

  // Error details
  message: string;              // Error message
  code?: string;                // Error code (HTTP status, TS code, etc.)
  stack?: string;               // Stack trace
  cause?: ErrorContext;         // Root cause (if nested)

  // Source context
  source: ErrorSource;          // Where did the error come from?

  // Execution context
  execution?: {
    mode: string;
    skill?: string;
    tool?: string;
    step?: string;
    taskId?: string;
    sessionId?: string;
  };

  // GitHub context
  github?: {
    owner: string;
    repo: string;
    entityNumber?: number;
    entityType?: 'issue' | 'pr' | 'comment';
  };

  // Recovery metadata
  recovery?: {
    attempts: number;          // Recovery attempts so far
    maxAttempts: number;       // Maximum recovery attempts
    strategy?: string;         // Recovery strategy used
    successful?: boolean;      // Was recovery successful?
  };

  // Additional metadata
  metadata?: Record<string, unknown>;
}

export interface ErrorSource {
  type: 'llm' | 'github' | 'tool' | 'verification' | 'file' | 'network' | 'system';
  component: string;           // e.g., 'openrouter', 'octokit', 'bash'
  endpoint?: string;          // For API errors
  method?: string;             // For API errors (GET, POST, etc.)
}

export interface ErrorPattern {
  category: ErrorCategory;
  pattern: RegExp;            // Regex pattern to match
  severity: ErrorSeverity;
  recoverability: ErrorRecoverability;
  recoveryStrategy?: string;   // Suggested recovery strategy
  maxRetries?: number;        // Max retries for this error
}
```

## Error Detector

### Detection Engine

```typescript
// src/error/detector.ts

export class ErrorDetector {
  private patterns: ErrorPattern[] = [];

  constructor() {
    this.registerPatterns();
  }

  detect(error: unknown, context?: Partial<ErrorSource>): ErrorContext {
    // Normalize error to ErrorContext
    const normalized = this.normalizeError(error, context);

    // Categorize error
    const category = this.categorize(normalized);

    // Determine severity
    const severity = this.determineSeverity(category, error);

    // Determine recoverability
    const recoverability = this.determineRecoverability(category, error);

    // Generate error ID
    const errorId = this.generateErrorId(category, error);

    return {
      ...normalized,
      errorId,
      category,
      severity,
      recoverability,
      timestamp: Date.now(),
    };
  }

  private normalizeError(error: unknown, context?: Partial<ErrorSource>): Partial<ErrorContext> {
    let message = 'Unknown error';
    let stack: string | undefined;
    let code: string | undefined;

    if (error instanceof Error) {
      message = error.message;
      stack = error.stack;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      message = (error as any).message || String(error);
      stack = (error as any).stack;
      code = (error as any).code || (error as any).status;
    }

    return {
      message,
      stack,
      code,
      source: context ? { ...context } as ErrorSource : this.inferSource(error, code),
    };
  }

  private inferSource(error: unknown, code?: string): ErrorSource {
    // Infer source from error properties
    if (error && typeof error === 'object') {
      const err = error as any;

      // GitHub API errors
      if (err.status && err.status >= 400 && err.status < 600) {
        return {
          type: 'github',
          component: 'octokit',
          endpoint: err.url,
          method: err.method,
        };
      }

      // LLM errors
      if (err.type === 'invalid_request_error' ||
          err.error?.type === 'rate_limit_error') {
        return {
          type: 'llm',
          component: 'openrouter',
        };
      }

      // Tool errors
      if (err.toolName || err.tool) {
        return {
          type: 'tool',
          component: err.toolName || err.tool,
        };
      }
    }

    // Default
    return {
      type: 'system',
      component: 'unknown',
    };
  }

  private categorize(context: Partial<ErrorContext>): ErrorCategory {
    const { message, code, source } = context;

    // Check against patterns
    for (const pattern of this.patterns) {
      if (pattern.pattern.test(message!)) {
        return pattern.category;
      }
    }

    // Categorize by source and code
    if (source?.type === 'github') {
      return this.categorizeGitHubError(code);
    }

    if (source?.type === 'llm') {
      return this.categorizeLLMError(message!, code);
    }

    if (source?.type === 'tool') {
      return this.categorizeToolError(message!);
    }

    // Default
    return ErrorCategory.SYSTEM_ERROR;
  }

  private categorizeGitHubError(code?: string): ErrorCategory {
    if (!code) return ErrorCategory.GITHUB_SERVER_ERROR;

    const statusCode = parseInt(code, 10);

    if (statusCode === 401 || statusCode === 403) {
      return ErrorCategory.GITHUB_FORBIDDEN;
    }

    if (statusCode === 404) {
      return ErrorCategory.GITHUB_NOT_FOUND;
    }

    if (statusCode === 422) {
      return ErrorCategory.GITHUB_VALIDATION;
    }

    if (statusCode === 429) {
      return ErrorCategory.GITHUB_RATE_LIMIT;
    }

    if (statusCode >= 500) {
      return ErrorCategory.GITHUB_SERVER_ERROR;
    }

    return ErrorCategory.GITHUB_SERVER_ERROR;
  }

  private categorizeLLMError(message: string, code?: string): ErrorCategory {
    if (message.includes('rate limit') || code === 'rate_limit_error') {
      return ErrorCategory.LLM_RATE_LIMIT;
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorCategory.LLM_TIMEOUT;
    }

    if (message.includes('quota') || message.includes('limit exceeded')) {
      return ErrorCategory.LLM_QUOTA_EXCEEDED;
    }

    if (message.includes('invalid') || code === 'invalid_request_error') {
      return ErrorCategory.LLM_INVALID_REQUEST;
    }

    return ErrorCategory.LLM_SERVER_ERROR;
  }

  private categorizeToolError(message: string): ErrorCategory {
    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorCategory.TOOL_TIMEOUT;
    }

    if (message.includes('not found') || message.includes('does not exist')) {
      return ErrorCategory.TOOL_NOT_FOUND;
    }

    if (message.includes('permission') || message.includes('denied')) {
      return ErrorCategory.TOOL_PERMISSION;
    }

    return ErrorCategory.TOOL_EXECUTION;
  }

  private determineSeverity(category: ErrorCategory, error: unknown): ErrorSeverity {
    const severityMap: Record<ErrorCategory, ErrorSeverity> = {
      // Low severity
      [ErrorCategory.LINT_ERROR]: ErrorSeverity.LOW,

      // Medium severity
      [ErrorCategory.TYPE_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorCategory.TEST_FAILURE]: ErrorSeverity.MEDIUM,
      [ErrorCategory.GITHUB_VALIDATION]: ErrorSeverity.MEDIUM,
      [ErrorCategory.TOOL_EXECUTION]: ErrorSeverity.MEDIUM,
      [ErrorCategory.NETWORK_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorCategory.CONFIG_INVALID]: ErrorSeverity.MEDIUM,

      // High severity
      [ErrorCategory.LLM_RATE_LIMIT]: ErrorSeverity.HIGH,
      [ErrorCategory.LLM_TIMEOUT]: ErrorSeverity.HIGH,
      [ErrorCategory.GITHUB_RATE_LIMIT]: ErrorSeverity.HIGH,
      [ErrorCategory.GITHUB_TIMEOUT]: ErrorSeverity.HIGH,
      [ErrorCategory.TOOL_TIMEOUT]: ErrorSeverity.HIGH,
      [ErrorCategory.VERIFICATION_FAILED]: ErrorSeverity.HIGH,
      [ErrorCategory.BUILD_FAILED]: ErrorSeverity.HIGH,
      [ErrorCategory.FILE_PERMISSION]: ErrorSeverity.HIGH,

      // Critical severity
      [ErrorCategory.LLM_QUOTA_EXCEEDED]: ErrorSeverity.CRITICAL,
      [ErrorCategory.LLM_SERVER_ERROR]: ErrorSeverity.CRITICAL,
      [ErrorCategory.GITHUB_SERVER_ERROR]: ErrorSeverity.CRITICAL,
      [ErrorCategory.SYSTEM_ERROR]: ErrorSeverity.CRITICAL,
    };

    return severityMap[category] || ErrorSeverity.MEDIUM;
  }

  private determineRecoverability(category: ErrorCategory, error: unknown): ErrorRecoverability {
    const recoverabilityMap: Record<ErrorCategory, ErrorRecoverability> = {
      // Retryable errors
      [ErrorCategory.LLM_RATE_LIMIT]: ErrorRecoverability.RETRYABLE,
      [ErrorCategory.LLM_TIMEOUT]: ErrorRecoverability.RETRYABLE,
      [ErrorCategory.GITHUB_RATE_LIMIT]: ErrorRecoverability.RETRYABLE,
      [ErrorCategory.GITHUB_TIMEOUT]: ErrorRecoverability.RETRYABLE,
      [ErrorCategory.TOOL_TIMEOUT]: ErrorRecoverability.RETRYABLE,
      [ErrorCategory.NETWORK_ERROR]: ErrorRecoverability.RETRYABLE,
      [ErrorCategory.CONNECTION_ERROR]: ErrorRecoverability.RETRYABLE,

      // Recoverable errors
      [ErrorCategory.TYPE_ERROR]: ErrorRecoverability.RECOVERABLE,
      [ErrorCategory.LINT_ERROR]: ErrorRecoverability.RECOVERABLE,
      [ErrorCategory.TEST_FAILURE]: ErrorRecoverability.RECOVERABLE,
      [ErrorCategory.BUILD_FAILED]: ErrorRecoverability.RECOVERABLE,
      [ErrorCategory.VERIFICATION_FAILED]: ErrorRecoverability.RECOVERABLE,
      [ErrorCategory.DEPENDENCY_ERROR]: ErrorRecoverability.RECOVERABLE,
      [ErrorCategory.CONFIG_MISSING]: ErrorRecoverability.RECOVERABLE,

      // Permanent errors
      [ErrorCategory.LLM_QUOTA_EXCEEDED]: ErrorRecoverability.PERMANENT,
      [ErrorCategory.LLM_INVALID_REQUEST]: ErrorRecoverability.PERMANENT,
      [ErrorCategory.GITHUB_NOT_FOUND]: ErrorRecoverability.PERMANENT,
      [ErrorCategory.GITHUB_FORBIDDEN]: ErrorRecoverability.PERMANENT,
      [ErrorCategory.GITHUB_VALIDATION]: ErrorRecoverability.PERMANENT,
      [ErrorCategory.FILE_PERMISSION]: ErrorRecoverability.PERMANENT,
      [ErrorCategory.CONFIG_INVALID]: ErrorRecoverability.PERMANENT,
      [ErrorCategory.SKILL_NOT_FOUND]: ErrorRecoverability.PERMANENT,

      // Unknown errors
      [ErrorCategory.LLM_SERVER_ERROR]: ErrorRecoverability.UNKNOWN,
      [ErrorCategory.GITHUB_SERVER_ERROR]: ErrorRecoverability.UNKNOWN,
      [ErrorCategory.TOOL_EXECUTION]: ErrorRecoverability.UNKNOWN,
      [ErrorCategory.SYSTEM_ERROR]: ErrorRecoverability.UNKNOWN,
    };

    return recoverabilityMap[category] || ErrorRecoverability.UNKNOWN;
  }

  private generateErrorId(category: ErrorCategory, error: unknown): string {
    // Generate unique error ID
    const message = error instanceof Error ? error.message : String(error);
    const hash = createHash('sha256')
      .update(`${category}:${message}:${Date.now()}`)
      .digest('hex')
      .substring(0, 16);

    return `${category}_${hash}`;
  }

  private registerPatterns(): void {
    this.patterns = [
      // TypeScript errors
      {
        category: ErrorCategory.TYPE_ERROR,
        pattern: /error TS\d+:|type.*is not assignable/i,
        severity: ErrorSeverity.MEDIUM,
        recoverability: ErrorRecoverability.RECOVERABLE,
        recoveryStrategy: 'apply_type_fix',
        maxRetries: 3,
      },

      // Lint errors
      {
        category: ErrorCategory.LINT_ERROR,
        pattern: /error.*:\d+:\d+:\s+.+/i,
        severity: ErrorSeverity.LOW,
        recoverability: ErrorRecoverability.RECOVERABLE,
        recoveryStrategy: 'apply_lint_fix',
        maxRetries: 1,
      },

      // Test failures
      {
        category: ErrorCategory.TEST_FAILURE,
        pattern: /FAIL|FAILURES|Test failed/i,
        severity: ErrorSeverity.MEDIUM,
        recoverability: ErrorRecoverability.RECOVERABLE,
        recoveryStrategy: 'fix_test',
        maxRetries: 3,
      },

      // Build failures
      {
        category: ErrorCategory.BUILD_FAILED,
        pattern: /Build failed|compilation error/i,
        severity: ErrorSeverity.HIGH,
        recoverability: ErrorRecoverability.RECOVERABLE,
        recoveryStrategy: 'fix_build',
        maxRetries: 3,
      },

      // Dependency errors
      {
        category: ErrorCategory.DEPENDENCY_ERROR,
        pattern: /Cannot find module|dependency not found/i,
        severity: ErrorSeverity.HIGH,
        recoverability: ErrorRecoverability.RECOVERABLE,
        recoveryStrategy: 'install_dependency',
        maxRetries: 1,
      },

      // Rate limit errors
      {
        category: ErrorCategory.LLM_RATE_LIMIT,
        pattern: /rate limit|too many requests/i,
        severity: ErrorSeverity.HIGH,
        recoverability: ErrorRecoverability.RETRYABLE,
        recoveryStrategy: 'wait_and_retry',
        maxRetries: 5,
      },

      // Timeout errors
      {
        category: ErrorCategory.LLM_TIMEOUT,
        pattern: /timeout|timed out/i,
        severity: ErrorSeverity.HIGH,
        recoverability: ErrorRecoverability.RETRYABLE,
        recoveryStrategy: 'retry_with_backoff',
        maxRetries: 3,
      },

      // Network errors
      {
        category: ErrorCategory.NETWORK_ERROR,
        pattern: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i,
        severity: ErrorSeverity.MEDIUM,
        recoverability: ErrorRecoverability.RETRYABLE,
        recoveryStrategy: 'retry_with_backoff',
        maxRetries: 3,
      },
    ];
  }
}
```

## Error Recovery

### Recovery Strategies

```typescript
// src/error/recovery.ts

export interface RecoveryStrategy {
  name: string;
  description: string;
  category: ErrorCategory[];
  execute: (error: ErrorContext, context: RecoveryContext) => Promise<RecoveryResult>;
}

export interface RecoveryContext {
  // Tool context
  tools: Tool[];

  // GitHub context
  github?: {
    token: string;
    owner: string;
    repo: string;
  };

  // Agent context
  agent?: {
    sessionId: string;
    mode: string;
  };

  // Workspace context
  workspace?: {
    workDir: string;
    checkpointDir: string;
  };
}

export interface RecoveryResult {
  success: boolean;
  message: string;
  action?: string;        // Action taken
  data?: Record<string, unknown>;
  nextAttempt?: boolean;   // Should retry?
  skipError?: boolean;     // Skip this error?
}

export class ErrorRecovery {
  private strategies: Map<string, RecoveryStrategy> = new Map();

  constructor() {
    this.registerStrategies();
  }

  async recover(
    error: ErrorContext,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    // Get recovery strategy for this error
    const strategy = this.getStrategy(error);

    if (!strategy) {
      return {
        success: false,
        message: `No recovery strategy found for error: ${error.category}`,
      };
    }

    // Execute recovery strategy
    try {
      const result = await strategy.execute(error, context);

      // Update recovery metadata
      error.recovery = {
        attempts: (error.recovery?.attempts || 0) + 1,
        maxAttempts: error.recovery?.maxAttempts || 3,
        strategy: strategy.name,
        successful: result.success,
      };

      return result;
    } catch (recoveryError) {
      return {
        success: false,
        message: `Recovery strategy failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
      };
    }
  }

  private getStrategy(error: ErrorContext): RecoveryStrategy | undefined {
    // Check if error has specific recovery strategy
    const pattern = this.getMatchingPattern(error);
    if (pattern?.recoveryStrategy) {
      return this.strategies.get(pattern.recoveryStrategy);
    }

    // Get default strategy for category
    const strategyNames: Record<ErrorCategory, string> = {
      [ErrorCategory.LLM_RATE_LIMIT]: 'wait_for_rate_limit',
      [ErrorCategory.LLM_TIMEOUT]: 'retry_with_backoff',
      [ErrorCategory.GITHUB_RATE_LIMIT]: 'wait_for_rate_limit',
      [ErrorCategory.GITHUB_TIMEOUT]: 'retry_with_backoff',
      [ErrorCategory.DEPENDENCY_ERROR]: 'install_dependency',
      [ErrorCategory.TYPE_ERROR]: 'apply_type_fix',
      [ErrorCategory.LINT_ERROR]: 'apply_lint_fix',
      [ErrorCategory.TEST_FAILURE]: 'fix_test',
      [ErrorCategory.BUILD_FAILED]: 'fix_build',
      [ErrorCategory.TOOL_TIMEOUT]: 'retry_with_backoff',
      [ErrorCategory.NETWORK_ERROR]: 'retry_with_backoff',
    };

    const strategyName = strategyNames[error.category];
    return strategyName ? this.strategies.get(strategyName) : undefined;
  }

  private getMatchingPattern(error: ErrorContext): ErrorPattern | undefined {
    // This would be shared with ErrorDetector
    // For now, return undefined
    return undefined;
  }

  private registerStrategies(): void {
    // Strategy: Wait for rate limit
    this.strategies.set('wait_for_rate_limit', {
      name: 'wait_for_rate_limit',
      description: 'Wait until rate limit resets',
      category: [ErrorCategory.LLM_RATE_LIMIT, ErrorCategory.GITHUB_RATE_LIMIT],
      execute: async (error, context) => {
        // Get retry-after header if available
        let waitTime = 60000; // Default 1 minute

        // Parse error for retry-after
        const match = error.message.match(/retry after (\d+)/i);
        if (match) {
          waitTime = parseInt(match[1], 10) * 1000;
        }

        // Wait
        await new Promise(resolve => setTimeout(resolve, waitTime));

        return {
          success: true,
          message: `Waited ${waitTime}ms for rate limit to reset`,
          action: 'wait',
          nextAttempt: true,
        };
      },
    });

    // Strategy: Retry with backoff
    this.strategies.set('retry_with_backoff', {
      name: 'retry_with_backoff',
      description: 'Retry operation with exponential backoff',
      category: [ErrorCategory.LLM_TIMEOUT, ErrorCategory.GITHUB_TIMEOUT,
                  ErrorCategory.TOOL_TIMEOUT, ErrorCategory.NETWORK_ERROR],
      execute: async (error, context) => {
        const attempt = error.recovery?.attempts || 1;
        const backoffTime = 1000 * Math.pow(2, attempt - 1); // Exponential backoff

        await new Promise(resolve => setTimeout(resolve, backoffTime));

        return {
          success: true,
          message: `Retrying after ${backoffTime}ms (attempt ${attempt})`,
          action: 'retry',
          nextAttempt: true,
        };
      },
    });

    // Strategy: Install dependency
    this.strategies.set('install_dependency', {
      name: 'install_dependency',
      description: 'Install missing dependency',
      category: [ErrorCategory.DEPENDENCY_ERROR],
      execute: async (error, context) => {
        // Extract package name from error
        const match = error.message.match(/Cannot find module ['"](.+?)['"]/i);
        if (!match) {
          return {
            success: false,
            message: 'Could not extract package name from error',
          };
        }

        const packageName = match[1];

        // Check if tool is available
        const bashTool = context.tools.find(t => t.name === 'bash');
        if (!bashTool) {
          return {
            success: false,
            message: 'Bash tool not available',
          };
        }

        // Install package
        const result = await bashTool.execute({
          command: 'npm',
          args: ['install', packageName],
          cwd: context.workspace?.workDir || process.cwd(),
        });

        if (result.exitCode === 0) {
          return {
            success: true,
            message: `Installed dependency: ${packageName}`,
            action: 'install',
            nextAttempt: true,
          };
        }

        return {
          success: false,
          message: `Failed to install dependency: ${result.stderr}`,
        };
      },
    });

    // Strategy: Apply type fix
    this.strategies.set('apply_type_fix', {
      name: 'apply_type_fix',
      description: 'Apply TypeScript type fix',
      category: [ErrorCategory.TYPE_ERROR],
      execute: async (error, context) => {
        // Parse error for location
        const match = error.message.match(/(.+)\((\d+):(\d+)\): error TS(\d+): (.+)/i);
        if (!match) {
          return {
            success: false,
            message: 'Could not parse TypeScript error location',
          };
        }

        const [, file, line, col, code, message] = match;

        // Try to fix using existing tool
        // This is a simplified version - would need more sophisticated logic
        return {
          success: false,
          message: `Type fix for ${code} not implemented yet: ${message}`,
        };
      },
    });

    // Strategy: Apply lint fix
    this.strategies.set('apply_lint_fix', {
      name: 'apply_lint_fix',
      description: 'Apply lint fix',
      category: [ErrorCategory.LINT_ERROR],
      execute: async (error, context) => {
        // Use linter's --fix flag
        const bashTool = context.tools.find(t => t.name === 'bash');
        if (!bashTool) {
          return {
            success: false,
            message: 'Bash tool not available',
          };
        }

        // Run linter with --fix
        const result = await bashTool.execute({
          command: 'bun',
          args: ['run', 'lint', '--fix'],
          cwd: context.workspace?.workDir || process.cwd(),
        });

        if (result.exitCode === 0) {
          return {
            success: true,
            message: 'Applied lint fixes',
            action: 'fix',
            nextAttempt: true,
          };
        }

        return {
          success: false,
          message: `Failed to apply lint fixes: ${result.stderr}`,
        };
      },
    });

    // Strategy: Fix test
    this.strategies.set('fix_test', {
      name: 'fix_test',
      description: 'Fix failing test',
      category: [ErrorCategory.TEST_FAILURE],
      execute: async (error, context) => {
        // This would involve analyzing the test failure and applying a fix
        // For now, just report that manual intervention is needed
        return {
          success: false,
          message: 'Automatic test fixing not implemented yet',
        };
      },
    });

    // Strategy: Fix build
    this.strategies.set('fix_build', {
      name: 'fix_build',
      description: 'Fix build failure',
      category: [ErrorCategory.BUILD_FAILED],
      execute: async (error, context) => {
        // This would involve analyzing the build failure and applying a fix
        // For now, just report that manual intervention is needed
        return {
          success: false,
          message: 'Automatic build fixing not implemented yet',
        };
      },
    });
  }
}
```

## Retry Policy

### Retry Engine

```typescript
// src/error/retry.ts

export interface RetryPolicy {
  maxAttempts: number;           // Maximum retry attempts
  initialDelayMs: number;        // Initial delay before first retry
  maxDelayMs: number;           // Maximum delay between retries
  backoffMultiplier: number;     // Exponential backoff multiplier
  retryableErrors: ErrorCategory[]; // Errors that should be retried
}

export interface RetryAttempt {
  attempt: number;
  timestamp: number;
  delayMs: number;
  error: ErrorContext;
  result?: any;
}

export class RetryEngine {
  private policies: Map<string, RetryPolicy> = new Map();
  private attempts: Map<string, RetryAttempt[]> = new Map();

  constructor() {
    this.registerDefaultPolicies();
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    policy: RetryPolicy,
    context?: Partial<ErrorSource>
  ): Promise<T> {
    const operationId = this.generateOperationId();
    this.attempts.set(operationId, []);

    let lastError: ErrorContext | undefined;

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        // Execute operation
        const result = await operation();

        // Success - record attempt
        this.recordAttempt(operationId, {
          attempt,
          timestamp: Date.now(),
          delayMs: attempt === 1 ? 0 : this.calculateDelay(attempt, policy),
          error: this.createSuccessContext(),
          result,
        });

        return result;
      } catch (error) {
        // Detect error
        const errorContext = this.detector.detect(error, context);

        // Check if error is retryable
        if (!this.isRetryable(errorContext, policy)) {
          throw error; // Re-throw non-retryable errors
        }

        // Record attempt
        this.recordAttempt(operationId, {
          attempt,
          timestamp: Date.now(),
          delayMs: this.calculateDelay(attempt, policy),
          error: errorContext,
        });

        lastError = errorContext;

        // If this is the last attempt, throw
        if (attempt === policy.maxAttempts) {
          throw error;
        }

        // Wait before retry
        const delay = this.calculateDelay(attempt, policy);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Should not reach here
    throw lastError || new Error('Max retry attempts exceeded');
  }

  private calculateDelay(attempt: number, policy: RetryPolicy): number {
    // Exponential backoff with jitter
    const baseDelay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
    const jitter = baseDelay * 0.1 * (Math.random() * 2 - 1); // ±10% jitter
    const delay = Math.min(baseDelay + jitter, policy.maxDelayMs);

    return Math.max(0, Math.floor(delay));
  }

  private isRetryable(error: ErrorContext, policy: RetryPolicy): boolean {
    // Check if error category is in retryable list
    return policy.retryableErrors.includes(error.category) ||
           error.recoverability === ErrorRecoverability.RETRYABLE;
  }

  private createSuccessContext(): ErrorContext {
    return {
      errorId: 'success',
      timestamp: Date.now(),
      category: ErrorCategory.SYSTEM_ERROR, // Placeholder
      severity: ErrorSeverity.LOW,
      recoverability: ErrorRecoverability.PERMANENT,
      message: 'Success',
    };
  }

  private recordAttempt(operationId: string, attempt: RetryAttempt): void {
    const attempts = this.attempts.get(operationId) || [];
    attempts.push(attempt);
    this.attempts.set(operationId, attempts);
  }

  private generateOperationId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private registerDefaultPolicies(): void {
    // LLM retry policy
    this.policies.set('llm', {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableErrors: [
        ErrorCategory.LLM_RATE_LIMIT,
        ErrorCategory.LLM_TIMEOUT,
      ],
    });

    // GitHub retry policy
    this.policies.set('github', {
      maxAttempts: 5,
      initialDelayMs: 1000,
      maxDelayMs: 60000,
      backoffMultiplier: 2,
      retryableErrors: [
        ErrorCategory.GITHUB_RATE_LIMIT,
        ErrorCategory.GITHUB_TIMEOUT,
        ErrorCategory.GITHUB_SERVER_ERROR,
      ],
    });

    // Tool retry policy
    this.policies.set('tool', {
      maxAttempts: 3,
      initialDelayMs: 500,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      retryableErrors: [
        ErrorCategory.TOOL_TIMEOUT,
        ErrorCategory.NETWORK_ERROR,
      ],
    });

    // Verification retry policy
    this.policies.set('verification', {
      maxAttempts: 3,
      initialDelayMs: 2000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableErrors: [
        ErrorCategory.VERIFICATION_FAILED,
        ErrorCategory.TYPE_ERROR,
        ErrorCategory.LINT_ERROR,
      ],
    });
  }

  getPolicy(name: string): RetryPolicy | undefined {
    return this.policies.get(name);
  }

  getAttempts(operationId: string): RetryAttempt[] {
    return this.attempts.get(operationId) || [];
  }

  clearAttempts(operationId: string): void {
    this.attempts.delete(operationId);
  }
}
```

## Error Aggregation

### Aggregation Engine

```typescript
// src/error/aggregator.ts

export interface ErrorGroup {
  groupId: string;              // Unique group ID
  category: ErrorCategory;       // Error category
  pattern: string;              // Error pattern (regex)
  severity: ErrorSeverity;      // Group severity
  count: number;                // Number of errors in group
  firstSeen: number;            // First occurrence timestamp
  lastSeen: number;             // Last occurrence timestamp
  errors: ErrorContext[];       // All errors in group
  sampleError: ErrorContext;    // Sample error from group
}

export interface AggregationConfig {
  groupByCategory: boolean;     // Group by error category
  groupByPattern: boolean;      // Group by error pattern
  groupBySeverity: boolean;     // Group by severity
  maxGroupAge: number;          // Max age of group in milliseconds
  maxGroupSize: number;         // Max errors per group
}

export class ErrorAggregator {
  private groups: Map<string, ErrorGroup> = new Map();
  private config: AggregationConfig;

  constructor(config?: Partial<AggregationConfig>) {
    this.config = {
      groupByCategory: true,
      groupByPattern: true,
      groupBySeverity: false,
      maxGroupAge: 3600000, // 1 hour
      maxGroupSize: 100,
      ...config,
    };
  }

  add(error: ErrorContext): ErrorGroup {
    // Find or create group
    let group = this.findGroup(error);

    if (!group) {
      group = this.createGroup(error);
    }

    // Add error to group
    group.errors.push(error);
    group.count++;
    group.lastSeen = Date.now();

    // Limit group size
    if (group.errors.length > this.config.maxGroupSize) {
      group.errors.shift(); // Remove oldest
    }

    return group;
  }

  private findGroup(error: ErrorContext): ErrorGroup | undefined {
    const groupId = this.generateGroupId(error);

    // Check if group exists
    const existing = this.groups.get(groupId);
    if (existing) {
      // Check if group is too old
      const age = Date.now() - existing.lastSeen;
      if (age > this.config.maxGroupAge) {
        this.groups.delete(groupId);
        return undefined;
      }

      return existing;
    }

    return undefined;
  }

  private generateGroupId(error: ErrorContext): string {
    const parts: string[] = [];

    if (this.config.groupByCategory) {
      parts.push(error.category);
    }

    if (this.config.groupByPattern) {
      // Extract pattern from error message
      const pattern = this.extractPattern(error.message);
      parts.push(pattern);
    }

    if (this.config.groupBySeverity) {
      parts.push(error.severity);
    }

    return parts.join(':') || 'default';
  }

  private extractPattern(message: string): string {
    // Simple pattern extraction - remove variable parts
    return message
      .replace(/'[^']*'/g, "'X'")      // Normalize strings
      .replace(/"[^"]*"/g, '"X"')
      .replace(/\d+/g, 'N')              // Normalize numbers
      .replace(/[a-f0-9]{8,}/g, 'HASH') // Normalize hashes
      .substring(0, 100);               // Limit length
  }

  private createGroup(error: ErrorContext): ErrorGroup {
    const groupId = this.generateGroupId(error);

    const group: ErrorGroup = {
      groupId,
      category: error.category,
      pattern: this.extractPattern(error.message),
      severity: error.severity,
      count: 1,
      firstSeen: error.timestamp,
      lastSeen: error.timestamp,
      errors: [error],
      sampleError: error,
    };

    this.groups.set(groupId, group);

    return group;
  }

  getGroups(): ErrorGroup[] {
    // Clean up old groups
    this.cleanup();

    return Array.from(this.groups.values());
  }

  getGroup(groupId: string): ErrorGroup | undefined {
    return this.groups.get(groupId);
  }

  getGroupsByCategory(category: ErrorCategory): ErrorGroup[] {
    return this.getGroups().filter(g => g.category === category);
  }

  getGroupsBySeverity(severity: ErrorSeverity): ErrorGroup[] {
    return this.getGroups().filter(g => g.severity === severity);
  }

  private cleanup(): void {
    const now = Date.now();

    for (const [groupId, group] of this.groups.entries()) {
      const age = now - group.lastSeen;

      if (age > this.config.maxGroupAge) {
        this.groups.delete(groupId);
      }
    }
  }

  clear(): void {
    this.groups.clear();
  }

  getStats(): {
    totalGroups: number;
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
  } {
    const groups = this.getGroups();

    const stats = {
      totalGroups: groups.length,
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
    };

    for (const group of groups) {
      stats.totalErrors += group.count;

      // By category
      stats.errorsByCategory[group.category] =
        (stats.errorsByCategory[group.category] || 0) + group.count;

      // By severity
      stats.errorsBySeverity[group.severity] =
        (stats.errorsBySeverity[group.severity] || 0) + group.count;
    }

    return stats;
  }
}
```

## Error Reporting

### Reporter Engine

```typescript
// src/error/reporter.ts

export interface ErrorReport {
  errorId: string;
  timestamp: number;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  source?: ErrorSource;
  execution?: {
    mode: string;
    skill?: string;
    tool?: string;
  };
  recovery?: {
    attempts: number;
    strategy?: string;
    successful?: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsBySource: Record<string, number>;
  errorsByRecoverability: Record<ErrorRecoverability, number>;
  recoveryAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  retryAttempts: number;
  successfulRetries: number;
  failedRetries: number;
}

export class ErrorReporter {
  private errors: ErrorReport[] = [];
  private metrics: ErrorMetrics = this.initializeMetrics();

  report(error: ErrorContext): ErrorReport {
    const report: ErrorReport = {
      errorId: error.errorId,
      timestamp: error.timestamp,
      category: error.category,
      severity: error.severity,
      message: error.message,
      source: error.source,
      execution: error.execution,
      recovery: error.recovery,
      metadata: error.metadata,
    };

    this.errors.push(report);
    this.updateMetrics(error);

    return report;
  }

  private initializeMetrics(): ErrorMetrics {
    return {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      errorsBySource: {} as Record<string, number>,
      errorsByRecoverability: {} as Record<ErrorRecoverability, number>,
      recoveryAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      retryAttempts: 0,
      successfulRetries: 0,
      failedRetries: 0,
    };
  }

  private updateMetrics(error: ErrorContext): void {
    this.metrics.totalErrors++;

    // By category
    this.metrics.errorsByCategory[error.category] =
      (this.metrics.errorsByCategory[error.category] || 0) + 1;

    // By severity
    this.metrics.errorsBySeverity[error.severity] =
      (this.metrics.errorsBySeverity[error.severity] || 0) + 1;

    // By source
    const sourceKey = error.source ? `${error.source.type}:${error.source.component}` : 'unknown';
    this.metrics.errorsBySource[sourceKey] =
      (this.metrics.errorsBySource[sourceKey] || 0) + 1;

    // By recoverability
    this.metrics.errorsByRecoverability[error.recoverability] =
      (this.metrics.errorsByRecoverability[error.recoverability] || 0) + 1;

    // Recovery attempts
    if (error.recovery) {
      this.metrics.recoveryAttempts++;

      if (error.recovery.successful) {
        this.metrics.successfulRecoveries++;
      } else {
        this.metrics.failedRecoveries++;
      }
    }
  }

  updateRetryMetrics(attempts: number, successful: boolean): void {
    this.metrics.retryAttempts += attempts;

    if (successful) {
      this.metrics.successfulRetries++;
    } else {
      this.metrics.failedRetries++;
    }
  }

  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  getErrors(limit?: number): ErrorReport[] {
    if (limit) {
      return this.errors.slice(-limit);
    }

    return this.errors;
  }

  getErrorsByCategory(category: ErrorCategory): ErrorReport[] {
    return this.errors.filter(e => e.category === category);
  }

  getErrorsBySeverity(severity: ErrorSeverity): ErrorReport[] {
    return this.errors.filter(e => e.severity === severity);
  }

  getErrorsByTimeRange(start: number, end: number): ErrorReport[] {
    return this.errors.filter(e =>
      e.timestamp >= start && e.timestamp <= end
    );
  }

  clear(): void {
    this.errors = [];
    this.metrics = this.initializeMetrics();
  }

  getSummary(): string {
    const recoveryRate = this.metrics.recoveryAttempts > 0
      ? `${(this.metrics.successfulRecoveries / this.metrics.recoveryAttempts * 100).toFixed(1)}%`
      : '0%';

    const retryRate = this.metrics.retryAttempts > 0
      ? `${(this.metrics.successfulRetries / this.metrics.retryAttempts * 100).toFixed(1)}%`
      : '0%';

    return `
Error Summary:
-------------
Total Errors: ${this.metrics.totalErrors}
Recovery Rate: ${recoveryRate} (${this.metrics.successfulRecoveries}/${this.metrics.recoveryAttempts})
Retry Rate: ${retryRate} (${this.metrics.successfulRetries}/${this.metrics.retryAttempts})

By Severity:
- Low: ${this.metrics.errorsBySeverity[ErrorSeverity.LOW] || 0}
- Medium: ${this.metrics.errorsBySeverity[ErrorSeverity.MEDIUM] || 0}
- High: ${this.metrics.errorsBySeverity[ErrorSeverity.HIGH] || 0}
- Critical: ${this.metrics.errorsBySeverity[ErrorSeverity.CRITICAL] || 0}

By Recoverability:
- Retryable: ${this.metrics.errorsByRecoverability[ErrorRecoverability.RETRYABLE] || 0}
- Recoverable: ${this.metrics.errorsByRecoverability[ErrorRecoverability.RECOVERABLE] || 0}
- Permanent: ${this.metrics.errorsByRecoverability[ErrorRecoverability.PERMANENT] || 0}
- Unknown: ${this.metrics.errorsByRecoverability[ErrorRecoverability.UNKNOWN] || 0}
    `.trim();
  }

  exportToJSON(): string {
    return JSON.stringify({
      metrics: this.metrics,
      errors: this.errors,
    }, null, 2);
  }

  exportToCSV(): string {
    const headers = [
      'errorId',
      'timestamp',
      'category',
      'severity',
      'message',
      'sourceType',
      'sourceComponent',
      'recoveryAttempts',
      'recoverySuccessful',
    ];

    const rows = this.errors.map(e => [
      e.errorId,
      e.timestamp,
      e.category,
      e.severity,
      e.message.replace(/,/g, '\\,'), // Escape commas
      e.source?.type,
      e.source?.component,
      e.recovery?.attempts,
      e.recovery?.successful,
    ]);

    return [
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n');
  }
}
```

## Error Profiles

### Profile System

```typescript
// src/error/profiles.ts

export type ErrorProfileName =
  | 'default'
  | 'strict'
  | 'lenient'
  | 'fast'
  | 'thorough';

export interface ErrorProfile {
  name: ErrorProfileName;
  description: string;

  // Detection
  detection: {
    enablePatternMatching: boolean;
    enableSeverityInference: boolean;
    enableRecoverabilityInference: boolean;
  };

  // Recovery
  recovery: {
    enableAutomaticRecovery: boolean;
    maxRecoveryAttempts: number;
    allowedStrategies: string[];
  };

  // Retry
  retry: {
    enabled: boolean;
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };

  // Reporting
  reporting: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    includeStackTrace: boolean;
    includeContext: boolean;
  };
}

export const PROFILES: Record<ErrorProfileName, ErrorProfile> = {
  default: {
    name: 'default',
    description: 'Balanced error handling with reasonable defaults',
    detection: {
      enablePatternMatching: true,
      enableSeverityInference: true,
      enableRecoverabilityInference: true,
    },
    recovery: {
      enableAutomaticRecovery: true,
      maxRecoveryAttempts: 3,
      allowedStrategies: [
        'wait_for_rate_limit',
        'retry_with_backoff',
        'install_dependency',
        'apply_lint_fix',
      ],
    },
    retry: {
      enabled: true,
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    },
    reporting: {
      logLevel: 'info',
      includeStackTrace: true,
      includeContext: true,
    },
  },

  strict: {
    name: 'strict',
    description: 'Fail fast on errors, minimal recovery',
    detection: {
      enablePatternMatching: true,
      enableSeverityInference: true,
      enableRecoverabilityInference: true,
    },
    recovery: {
      enableAutomaticRecovery: false,
      maxRecoveryAttempts: 0,
      allowedStrategies: [],
    },
    retry: {
      enabled: false,
      maxAttempts: 1,
      initialDelayMs: 0,
      maxDelayMs: 0,
      backoffMultiplier: 1,
    },
    reporting: {
      logLevel: 'error',
      includeStackTrace: true,
      includeContext: true,
    },
  },

  lenient: {
    name: 'lenient',
    description: 'Maximum recovery and retry attempts',
    detection: {
      enablePatternMatching: true,
      enableSeverityInference: true,
      enableRecoverabilityInference: true,
    },
    recovery: {
      enableAutomaticRecovery: true,
      maxRecoveryAttempts: 5,
      allowedStrategies: [
        'wait_for_rate_limit',
        'retry_with_backoff',
        'install_dependency',
        'apply_type_fix',
        'apply_lint_fix',
        'fix_test',
        'fix_build',
      ],
    },
    retry: {
      enabled: true,
      maxAttempts: 5,
      initialDelayMs: 500,
      maxDelayMs: 60000,
      backoffMultiplier: 2,
    },
    reporting: {
      logLevel: 'debug',
      includeStackTrace: true,
      includeContext: true,
    },
  },

  fast: {
    name: 'fast',
    description: 'Quick execution, minimal error handling',
    detection: {
      enablePatternMatching: false,
      enableSeverityInference: true,
      enableRecoverabilityInference: false,
    },
    recovery: {
      enableAutomaticRecovery: false,
      maxRecoveryAttempts: 1,
      allowedStrategies: ['retry_with_backoff'],
    },
    retry: {
      enabled: true,
      maxAttempts: 2,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 1.5,
    },
    reporting: {
      logLevel: 'warn',
      includeStackTrace: false,
      includeContext: false,
    },
  },

  thorough: {
    name: 'thorough',
    description: 'Maximum error detection and analysis',
    detection: {
      enablePatternMatching: true,
      enableSeverityInference: true,
      enableRecoverabilityInference: true,
    },
    recovery: {
      enableAutomaticRecovery: true,
      maxRecoveryAttempts: 10,
      allowedStrategies: [
        'wait_for_rate_limit',
        'retry_with_backoff',
        'install_dependency',
        'apply_type_fix',
        'apply_lint_fix',
        'fix_test',
        'fix_build',
      ],
    },
    retry: {
      enabled: true,
      maxAttempts: 10,
      initialDelayMs: 1000,
      maxDelayMs: 120000, // 2 minutes
      backoffMultiplier: 2,
    },
    reporting: {
      logLevel: 'debug',
      includeStackTrace: true,
      includeContext: true,
    },
  },
};

export class ProfileManager {
  private currentProfile: ErrorProfile = PROFILES.default;

  getProfile(name?: ErrorProfileName): ErrorProfile {
    if (!name) {
      return this.currentProfile;
    }

    return PROFILES[name] || PROFILES.default;
  }

  setProfile(name: ErrorProfileName): void {
    if (!PROFILES[name]) {
      throw new Error(`Profile not found: ${name}`);
    }

    this.currentProfile = PROFILES[name];
  }

  getCurrentProfile(): ErrorProfileName {
    return this.currentProfile.name;
  }

  getAllProfiles(): ErrorProfileName[] {
    return Object.keys(PROFILES) as ErrorProfileName[];
  }
}
```

## Integration with Skill System

### Error Handling in Skills

```typescript
// In skill metadata, add error handling configuration

error-handling:
  profile: default  # default, strict, lenient, fast, thorough

  detection:
    enable_pattern_matching: true
    enable_severity_inference: true
    enable_recoverability_inference: true

  recovery:
    enable_automatic_recovery: true
    max_recovery_attempts: 3
    allowed_strategies:
      - wait_for_rate_limit
      - retry_with_backoff

  retry:
    enabled: true
    max_attempts: 3
    initial_delay_ms: 1000
    max_delay_ms: 30000
    backoff_multiplier: 2

  reporting:
    log_level: info
    include_stack_trace: true
    include_context: true
```

### Skill Execution with Error Handling

```typescript
// In skill execute() method, wrap with error handling

async execute(context: SkillContext): Promise<SkillResult> {
  const errorHandler = new ErrorHandler({
    profile: skill.metadata.errorHandling?.profile || 'default',
  });

  try {
    // Execute skill logic
    const result = await this.executeLogic(context);

    return {
      success: true,
      output: result,
    };
  } catch (error) {
    // Detect error
    const errorContext = errorHandler.detector.detect(error, {
      type: 'tool',
      component: skill.metadata.name,
    });

    // Add execution context
    errorContext.execution = {
      mode: context.execution?.mode || 'unknown',
      skill: skill.metadata.name,
      taskId: context.task.id,
    };

    // Report error
    errorHandler.reporter.report(errorContext);

    // Attempt recovery
    if (skill.metadata.errorHandling?.recovery?.enable_automatic_recovery) {
      const recoveryResult = await errorHandler.recovery.recover(errorContext, {
        tools: context.tools || [],
        github: {
          token: process.env.GITHUB_TOKEN!,
          owner: context.github?.owner!,
          repo: context.github?.repo!,
        },
        workspace: {
          workDir: context.execution?.workDir || process.cwd(),
          checkpointDir: context.execution?.checkpointDir,
        },
      });

      if (recoveryResult.success && recoveryResult.nextAttempt) {
        // Retry the operation
        return await this.execute(context);
      }
    }

    // Error not recovered
    return {
      success: false,
      error: errorContext.message,
      metadata: {
        errorId: errorContext.errorId,
        category: errorContext.category,
        severity: errorContext.severity,
      },
    };
  }
}
```

## Error Context Enrichment

### Context Enrichment

```typescript
// src/error/context.ts

export class ErrorContextEnricher {
  enrich(error: ErrorContext, context: EnrichmentContext): ErrorContext {
    const enriched = { ...error };

    // Add GitHub context if available
    if (context.github) {
      enriched.github = {
        owner: context.github.owner,
        repo: context.github.repo,
        entityNumber: context.github.entityNumber,
        entityType: context.github.entityType,
      };
    }

    // Add execution context if available
    if (context.execution) {
      enriched.execution = {
        ...enriched.execution,
        ...context.execution,
      };
    }

    // Add error code if not present
    if (!enriched.code && error.source?.type === 'github') {
      enriched.code = this.extractGitHubErrorCode(error.message);
    }

    // Add metadata
    enriched.metadata = {
      ...enriched.metadata,
      enrichedAt: Date.now(),
      enrichmentSource: 'error-context-enricher',
    };

    return enriched;
  }

  private extractGitHubErrorCode(message: string): string | undefined {
    // Try to extract HTTP status code from error message
    const match = message.match(/\b(\d{3})\b/);
    return match ? match[1] : undefined;
  }
}

export interface EnrichmentContext {
  github?: {
    owner: string;
    repo: string;
    entityNumber?: number;
    entityType?: 'issue' | 'pr' | 'comment';
  };

  execution?: {
    mode: string;
    skill?: string;
    tool?: string;
    step?: string;
    taskId?: string;
    sessionId?: string;
  };
}
```

## Migration Path

### Phase 1: Foundation (P0)

1. Create `.claude/skills/self-improvement/error-analyzer.md`
2. Create `.claude/skills/self-improvement/error-recovery.md`
3. Create `.claude/skills/self-improvement/error-reporting.md`
4. Implement `ErrorDetector` class
5. Implement `ErrorCategorizer` class
6. Implement `ErrorRecovery` class
7. Implement `RetryEngine` class

### Phase 2: Integration (P1)

8. Implement `ErrorAggregator` class
9. Implement `ErrorReporter` class
10. Implement `ProfileManager` class
11. Implement `ErrorContextEnricher` class
12. Update skill system to use error handling
13. Update mode system to use error handling
14. Update agent loop to use error handling

### Phase 3: Optimization (P2)

15. Add error pattern learning
16. Add adaptive retry policies
17. Add error prediction
18. Add error prevention strategies
19. Optimize error aggregation performance

## Error Handling

### Detection Errors

| Error | Handling |
|-------|-----------|
| Unknown error | Default to SYSTEM_ERROR with MEDIUM severity |
| Missing context | Log warning, use default context |
| Invalid pattern | Log error, skip pattern |

### Recovery Errors

| Error | Handling |
|-------|-----------|
| Strategy not found | Log error, no recovery |
| Strategy execution failed | Log error, no recovery |
| Recovery failed | Log error, increment attempt count |
| Max attempts exceeded | Log error, give up |

### Retry Errors

| Error | Handling |
|-------|-----------|
| Non-retryable error | Throw immediately |
| Max retries exceeded | Throw last error |
| Retry failed | Increment attempt, continue retry |

## Testing Strategy

### Unit Tests

```typescript
// tests/error/detector.test.ts
describe('ErrorDetector', () => {
  it('should detect LLM rate limit error', () => {
    const error = new Error('Rate limit exceeded');
    const context = detector.detect(error, { type: 'llm', component: 'openrouter' });

    expect(context.category).toBe(ErrorCategory.LLM_RATE_LIMIT);
    expect(context.severity).toBe(ErrorSeverity.HIGH);
    expect(context.recoverability).toBe(ErrorRecoverability.RETRYABLE);
  });

  it('should detect GitHub not found error', () => {
    const error = new Error('404 Not Found');
    const context = detector.detect(error, { type: 'github', component: 'octokit' });

    expect(context.category).toBe(ErrorCategory.GITHUB_NOT_FOUND);
    expect(context.severity).toBe(ErrorSeverity.HIGH);
    expect(context.recoverability).toBe(ErrorRecoverability.PERMANENT);
  });
});

// tests/error/retry.test.ts
describe('RetryEngine', () => {
  it('should retry operation on retryable error', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Rate limit exceeded');
      }
      return 'success';
    };

    const policy = retryEngine.getPolicy('llm')!;
    const result = await retryEngine.executeWithRetry(operation, policy);

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should not retry non-retryable error', async () => {
    const operation = async () => {
      throw new Error('Not found');
    };

    const policy = retryEngine.getPolicy('llm')!;

    await expect(
      retryEngine.executeWithRetry(operation, policy)
    ).rejects.toThrow('Not found');
  });
});
```

### Integration Tests

```typescript
// tests/error/integration.test.ts
describe('Error Handling Integration', () => {
  it('should detect, recover, and retry error', async () => {
    const handler = new ErrorHandler({ profile: 'default' });

    // Create error
    const error = new Error('Rate limit exceeded');

    // Detect
    const errorContext = handler.detector.detect(error, {
      type: 'llm',
      component: 'openrouter',
    });

    // Report
    handler.reporter.report(errorContext);

    // Recover
    const recoveryResult = await handler.recovery.recover(errorContext, {
      tools: [],
    });

    // Verify
    expect(errorContext.category).toBe(ErrorCategory.LLM_RATE_LIMIT);
    expect(recoveryResult.success).toBe(true);
    expect(recoveryResult.action).toBe('wait');
  });
});
```

## Next Steps

1. Implement `ErrorDetector` class
2. Implement `ErrorCategorizer` class
3. Implement `ErrorRecovery` class
4. Implement `RetryEngine` class
5. Implement `ErrorAggregator` class
6. Implement `ErrorReporter` class
7. Implement `ProfileManager` class
8. Implement `ErrorContextEnricher` class
9. Create `.claude/skills/self-improvement/error-analyzer.md`
10. Create `.claude/skills/self-improvement/error-recovery.md`
11. Create `.claude/skills/self-improvement/error-reporting.md`
12. Write comprehensive tests
13. Integrate with skill system
14. Integrate with mode system
15. Integrate with agent loop
16. Add documentation

## Conclusion

This design provides:

- ✅ **Error detection**: 20+ error categories with pattern matching
- ✅ **Error categorization**: Automatic category, severity, recoverability detection
- ✅ **Error recovery**: 7+ recovery strategies
- ✅ **Retry policies**: Configurable retry with exponential backoff
- ✅ **Error aggregation**: Group related errors for analysis
- ✅ **Error reporting**: Comprehensive metrics and reporting
- ✅ **Error profiles**: 5 predefined profiles (default, strict, lenient, fast, thorough)
- ✅ **Context enrichment**: Rich error context
- ✅ **Integration**: Seamless integration with skill/subagent system

**Estimated Implementation Time**: 2-3 hours  
**Risk**: MEDIUM  
**Dependencies**: None
