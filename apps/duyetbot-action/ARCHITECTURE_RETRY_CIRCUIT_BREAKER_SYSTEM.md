# Architecture Design: Retry and Circuit Breaker System

## Overview

Design of **retry and circuit breaker system** for duyetbot-action to provide robust failure handling, automatic retries with exponential backoff, and circuit breaking to prevent cascading failures.

## Goals

1. **Retry Logic**: Automatic retry with configurable policies
2. **Exponential Backoff**: Smart backoff to avoid overwhelming services
3. **Circuit Breaking**: Prevent cascading failures by stopping operations on failing services
4. **Automatic Recovery**: Re-enable operations when services recover
5. **Metrics and Monitoring**: Track retry success/failure and circuit states
6. **Integration**: Seamless integration with error handling system
7. **Configurability**: Per-service configuration for retries and circuit breaking

## Directory Structure

```
src/
├── resilience/
│   ├── retry.ts            # Retry engine with backoff
│   ├── circuit-breaker.ts  # Circuit breaker implementation
│   ├── policy.ts           # Retry and circuit breaker policies
│   ├── metrics.ts          # Retry and circuit breaker metrics
│   └── registry.ts         # Service registry with state
```

## Retry Engine

### Retry Types

```typescript
// src/resilience/types.ts

export type RetryStrategy =
  | 'exponential'      // Exponential backoff
  | 'linear'           // Linear backoff
  | 'fixed'            // Fixed delay
  | 'custom';          // Custom retry strategy

export type RetryCondition = (
  error: unknown,
  attempt: number
) => boolean;

export interface RetryConfig {
  // Retry settings
  maxAttempts: number;           // Maximum retry attempts (including initial)
  initialDelayMs: number;        // Initial delay before first retry
  maxDelayMs: number;           // Maximum delay between retries
  strategy: RetryStrategy;       // Backoff strategy
  multiplier: number;            // Backoff multiplier (for exponential/linear)

  // Retry conditions
  retryableErrors?: string[];     // Error types to retry
  retryableStatuses?: number[]; // HTTP status codes to retry
  shouldRetry?: RetryCondition;   // Custom retry condition function

  // Jitter
  jitterEnabled: boolean;         // Add random jitter to delays
  jitterFactor: number;          // Jitter factor (0-1)

  // Timeout
  timeoutMs?: number;             // Per-attempt timeout
  overallTimeoutMs?: number;      // Overall timeout for all attempts
}
```

### Retry Engine Implementation

```typescript
// src/resilience/retry.ts

export interface RetryAttempt {
  attempt: number;              // Attempt number (1-indexed)
  timestamp: number;            // Attempt timestamp
  delayMs: number;             // Delay before this attempt
  error?: unknown;              // Error if failed
  result?: any;                // Result if succeeded
  durationMs: number;         // Attempt duration
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: unknown;
  attempts: number;
  totalDurationMs: number;
  retryAttempts: number;
  attempts: RetryAttempt[];
}

export class RetryEngine {
  private metrics: RetryMetrics;

  constructor(private config: RetryConfig) {
    this.metrics = new RetryMetrics();
  }

  async execute<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const attempts: RetryAttempt[] = [];
    let lastError: unknown;
    let totalDuration = 0;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      const attemptStartTime = Date.now();
      const delay = this.calculateDelay(attempt);

      // Wait before retry (except first attempt)
      if (attempt > 1) {
        await this.wait(delay);
      }

      try {
        // Execute operation with timeout if configured
        const result = await this.executeWithTimeout(operation);

        const duration = Date.now() - attemptStartTime;
        totalDuration += duration;

        // Record successful attempt
        attempts.push({
          attempt,
          timestamp: Date.now(),
          delayMs: attempt > 1 ? delay : 0,
          result,
          durationMs: duration,
        });

        this.metrics.recordSuccess(this.config, attempts);

        return {
          success: true,
          result,
          attempts: attempt,
          totalDurationMs: totalDuration,
          retryAttempts: attempt - 1,
          attempts,
        };
      } catch (error) {
        const duration = Date.now() - attemptStartTime;
        totalDuration += duration;
        lastError = error;

        // Record failed attempt
        attempts.push({
          attempt,
          timestamp: Date.now(),
          delayMs: attempt > 1 ? delay : 0,
          error,
          durationMs: duration,
        });

        // Check if should retry
        if (!this.shouldRetry(error, attempt)) {
          this.metrics.recordFailure(this.config, attempts, false);
          break;
        }

        // Check if this is the last attempt
        if (attempt === this.config.maxAttempts) {
          this.metrics.recordFailure(this.config, attempts, true);
          break;
        }

        // Check overall timeout
        if (this.config.overallTimeoutMs) {
          const elapsed = Date.now() - startTime;
          if (elapsed >= this.config.overallTimeoutMs) {
            this.metrics.recordFailure(this.config, attempts, true);
            break;
          }
        }
      }
    }

    // All attempts failed
    return {
      success: false,
      error: lastError,
      attempts: attempts.length,
      totalDurationMs: totalDuration,
      retryAttempts: attempts.length - 1,
      attempts,
    };
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.config.timeoutMs) {
      return operation();
    }

    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${this.config.timeoutMs}ms`)), this.config.timeoutMs);
      }),
    ]);
  }

  private calculateDelay(attempt: number): number {
    let delay: number;

    switch (this.config.strategy) {
      case 'exponential':
        delay = this.config.initialDelayMs * Math.pow(this.config.multiplier, attempt - 2);
        break;

      case 'linear':
        delay = this.config.initialDelayMs * (attempt - 1);
        break;

      case 'fixed':
        delay = this.config.initialDelayMs;
        break;

      case 'custom':
        // Use custom strategy if provided
        delay = this.config.initialDelayMs;
        break;

      default:
        delay = this.config.initialDelayMs;
    }

    // Cap at max delay
    delay = Math.min(delay, this.config.maxDelayMs);

    // Add jitter if enabled
    if (this.config.jitterEnabled) {
      const jitterRange = delay * this.config.jitterFactor;
      const jitter = (Math.random() * 2 - 1) * jitterRange;
      delay = delay + jitter;
    }

    // Ensure non-negative
    return Math.max(0, Math.floor(delay));
  }

  private shouldRetry(error: unknown, attempt: number): boolean {
    // Check custom condition
    if (this.config.shouldRetry) {
      return this.config.shouldRetry(error, attempt);
    }

    // Check error type
    if (this.config.retryableErrors) {
      const errorType = this.getErrorType(error);
      if (!this.config.retryableErrors.includes(errorType)) {
        return false;
      }
    }

    // Check HTTP status code
    if (this.config.retryableStatuses) {
      const statusCode = this.getStatusCode(error);
      if (statusCode && !this.config.retryableStatuses.includes(statusCode)) {
        return false;
      }
    }

    // Default: retry all errors
    return true;
  }

  private getErrorType(error: unknown): string {
    if (error instanceof Error) {
      return error.constructor.name;
    }
    if (typeof error === 'string') {
      return error;
    }
    return String(error);
  }

  private getStatusCode(error: unknown): number | undefined {
    if (error && typeof error === 'object') {
      const err = error as any;
      return err.status || err.statusCode || err.code;
    }
    return undefined;
  }

  private async wait(delayMs: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  getMetrics(): RetryMetrics {
    return this.metrics;
  }
}
```

### Retry Metrics

```typescript
// src/resilience/metrics.ts

export interface RetryMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalAttempts: number;
  successfulOnFirstAttempt: number;
  successfulAfterRetry: number;
  totalRetryDelayMs: number;
  averageRetryDelayMs: number;
  failureRate: number;
}

export class RetryMetrics {
  private metrics: Map<string, RetryOperationMetrics> = new Map();

  recordSuccess(config: RetryConfig, attempts: RetryAttempt[]): void {
    const key = this.getOperationKey(config);

    if (!this.metrics.has(key)) {
      this.metrics.set(key, this.createOperationMetrics());
    }

    const operationMetrics = this.metrics.get(key)!;
    operationMetrics.totalOperations++;
    operationMetrics.successfulOperations++;
    operationMetrics.totalAttempts += attempts.length;

    if (attempts.length === 1) {
      operationMetrics.successfulOnFirstAttempt++;
    } else {
      operationMetrics.successfulAfterRetry++;
    }

    // Calculate total retry delay
    const totalDelay = attempts.reduce((sum, a) => sum + a.delayMs, 0);
    operationMetrics.totalRetryDelayMs += totalDelay;
  }

  recordFailure(config: RetryConfig, attempts: RetryAttempt[], exhaustedRetries: boolean): void {
    const key = this.getOperationKey(config);

    if (!this.metrics.has(key)) {
      this.metrics.set(key, this.createOperationMetrics());
    }

    const operationMetrics = this.metrics.get(key)!;
    operationMetrics.totalOperations++;
    operationMetrics.failedOperations++;
    operationMetrics.totalAttempts += attempts.length;

    if (exhaustedRetries) {
      operationMetrics.exhaustedRetries++;
    }
  }

  private createOperationMetrics(): RetryOperationMetrics {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalAttempts: 0,
      successfulOnFirstAttempt: 0,
      successfulAfterRetry: 0,
      exhaustedRetries: 0,
      totalRetryDelayMs: 0,
    };
  }

  private getOperationKey(config: RetryConfig): string {
    return `${config.strategy}_${config.maxAttempts}_${config.initialDelayMs}`;
  }

  getMetrics(): RetryMetrics {
    const allMetrics = Array.from(this.metrics.values());

    const totals = allMetrics.reduce((acc, m) => ({
      totalOperations: acc.totalOperations + m.totalOperations,
      successfulOperations: acc.successfulOperations + m.successfulOperations,
      failedOperations: acc.failedOperations + m.failedOperations,
      totalAttempts: acc.totalAttempts + m.totalAttempts,
      successfulOnFirstAttempt: acc.successfulOnFirstAttempt + m.successfulOnFirstAttempt,
      successfulAfterRetry: acc.successfulAfterRetry + m.successfulAfterRetry,
      totalRetryDelayMs: acc.totalRetryDelayMs + m.totalRetryDelayMs,
    }), this.createOperationMetrics());

    const failureRate = totals.totalOperations > 0
      ? (totals.failedOperations / totals.totalOperations) * 100
      : 0;

    const averageRetryDelay = totals.totalAttempts > 0
      ? totals.totalRetryDelayMs / totals.totalAttempts
      : 0;

    return {
      ...totals,
      failureRate,
      averageRetryDelayMs: averageRetryDelay,
    };
  }

  getSummary(): string {
    const metrics = this.getMetrics();

    return `
Retry Metrics:
--------------
Total Operations: ${metrics.totalOperations}
Successful: ${metrics.successfulOperations} (${(metrics.successfulOperations / metrics.totalOperations * 100).toFixed(1)}%)
Failed: ${metrics.failedOperations} (${metrics.failureRate.toFixed(1)}%)
Total Attempts: ${metrics.totalAttempts}
Successful on First Attempt: ${metrics.successfulOnFirstAttempt}
Successful After Retry: ${metrics.successfulAfterRetry}
Exhausted Retries: ${metrics.exhaustedRetries || 0}
Total Retry Delay: ${metrics.totalRetryDelayMs}ms
Average Retry Delay: ${metrics.averageRetryDelayMs.toFixed(0)}ms
    `.trim();
  }

  reset(): void {
    this.metrics.clear();
  }
}

interface RetryOperationMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalAttempts: number;
  successfulOnFirstAttempt: number;
  successfulAfterRetry: number;
  exhaustedRetries: number;
  totalRetryDelayMs: number;
}
```

## Circuit Breaker

### Circuit Breaker States

```typescript
// src/resilience/circuit-breaker.ts

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  // Threshold settings
  failureThreshold: number;       // Number of failures before opening
  successThreshold: number;       // Number of successes before closing
  timeoutMs: number;              // How long to stay in OPEN state
  halfOpenMaxCalls: number;       // Max calls in HALF-OPEN state

  // Window settings
  rollingWindowMs: number;        // Time window for counting failures
  rollingWindowBuckets: number;   // Number of time buckets

  // Monitoring
  monitorIntervalMs: number;      // How often to check circuit state
  enableMonitoring: boolean;        // Enable automatic state transitions

  // Callbacks
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  onOpen?: (error?: Error) => void;
  onClose?: () => void;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  lastStateChange: number;
  openSince?: number;
  halfOpenCalls: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState;
  private metrics: CircuitMetrics;
  private monitorTimer?: NodeJS.Timeout;

  constructor(private config: CircuitBreakerConfig) {
    this.state = this.createInitialState();
    this.metrics = new CircuitMetrics();

    if (this.config.enableMonitoring) {
      this.startMonitoring();
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state.state === 'open') {
      // Check if timeout has expired
      const elapsed = Date.now() - (this.state.openSince || 0);
      if (elapsed < this.config.timeoutMs) {
        throw new CircuitBreakerOpenError('Circuit breaker is OPEN', this.state);
      }

      // Timeout expired, transition to half-open
      this.transitionTo('half-open');
    }

    try {
      // Execute operation
      const result = await operation();

      // Record success
      this.recordSuccess();

      // Check if should close circuit
      if (this.state.state === 'half-open' &&
          this.state.successCount >= this.config.successThreshold) {
        this.transitionTo('closed');
      }

      return result;
    } catch (error) {
      // Record failure
      this.recordFailure(error);

      // Check if should open circuit
      if (this.shouldOpenCircuit()) {
        this.transitionTo('open', error as Error);
      }

      throw error;
    }
  }

  private createInitialState(): CircuitBreakerState {
    return {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      lastStateChange: Date.now(),
      halfOpenCalls: 0,
    };
  }

  private recordSuccess(): void {
    this.state.successCount++;
    this.state.lastSuccessTime = Date.now();
    this.metrics.recordSuccess();
  }

  private recordFailure(error: Error): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();
    this.metrics.recordFailure(error);
  }

  private shouldOpenCircuit(): boolean {
    // Only open from CLOSED or HALF-OPEN state
    if (this.state.state === 'open') {
      return false;
    }

    // Check failure threshold
    if (this.state.failureCount >= this.config.failureThreshold) {
      return true;
    }

    return false;
  }

  private transitionTo(newState: CircuitState, error?: Error): void {
    const previousState = this.state.state;
    const now = Date.now();

    // Update state
    this.state.state = newState;
    this.state.lastStateChange = now;

    // Reset counters based on new state
    switch (newState) {
      case 'closed':
        this.state.failureCount = 0;
        this.state.successCount = 0;
        this.state.halfOpenCalls = 0;
        this.config.onClose?.();
        break;

      case 'open':
        this.state.openSince = now;
        this.config.onOpen?.(error);
        break;

      case 'half-open':
        this.state.halfOpenCalls = 0;
        break;
    }

    // Notify callback
    this.config.onStateChange?.(previousState, newState);
  }

  private startMonitoring(): void {
    this.monitorTimer = setInterval(() => {
      this.checkAndTransition();
    }, this.config.monitorIntervalMs);
  }

  private stopMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = undefined;
    }
  }

  private checkAndTransition(): void {
    const now = Date.now();

    // Check if OPEN circuit should transition to HALF-OPEN
    if (this.state.state === 'open' && this.state.openSince) {
      const elapsed = now - this.state.openSince;
      if (elapsed >= this.config.timeoutMs) {
        this.transitionTo('half-open');
      }
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  getCurrentState(): CircuitState {
    return this.state.state;
  }

  isOpen(): boolean {
    return this.state.state === 'open';
  }

  isClosed(): boolean {
    return this.state.state === 'closed';
  }

  isHalfOpen(): boolean {
    return this.state.state === 'half-open';
  }

  reset(): void {
    this.state = this.createInitialState();
    this.metrics.reset();
  }

  destroy(): void {
    this.stopMonitoring();
  }

  getMetrics(): CircuitMetrics {
    return this.metrics;
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitBreakerState
  ) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}
```

### Circuit Breaker Metrics

```typescript
// src/resilience/metrics.ts

export interface CircuitMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;          // Calls rejected because circuit was OPEN
  stateChanges: number;
  currentState: CircuitState;
  timeInOpen: number;            // Time spent in OPEN state (ms)
  timeInClosed: number;          // Time spent in CLOSED state (ms)
  timeInHalfOpen: number;        // Time spent in HALF-OPEN state (ms)
  failureRate: number;            // Failure rate (%)
  successRate: number;            // Success rate (%)
  rejectionRate: number;          // Rejection rate (%)
}

export class CircuitMetrics {
  private metrics: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    rejectedCalls: number;
    stateChanges: number;
    stateHistory: Array<{ state: CircuitState; timestamp: number }>;
  } = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    rejectedCalls: 0,
    stateChanges: 0,
    stateHistory: [],
  };

  recordSuccess(): void {
    this.metrics.totalCalls++;
    this.metrics.successfulCalls++;
  }

  recordFailure(error: Error): void {
    this.metrics.totalCalls++;
    this.metrics.failedCalls++;
  }

  recordRejection(): void {
    this.metrics.totalCalls++;
    this.metrics.rejectedCalls++;
  }

  recordStateChange(from: CircuitState, to: CircuitState): void {
    this.metrics.stateChanges++;
    this.metrics.stateHistory.push({
      state: to,
      timestamp: Date.now(),
    });
  }

  getMetrics(currentState: CircuitState): CircuitMetrics {
    const { totalCalls, successfulCalls, failedCalls, rejectedCalls, stateHistory } = this.metrics;

    // Calculate time in each state
    const { timeInOpen, timeInClosed, timeInHalfOpen } = this.calculateStateTimes(stateHistory);

    const failureRate = totalCalls > 0 ? (failedCalls / totalCalls) * 100 : 0;
    const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;
    const rejectionRate = totalCalls > 0 ? (rejectedCalls / totalCalls) * 100 : 0;

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      rejectedCalls,
      stateChanges: this.metrics.stateChanges,
      currentState,
      timeInOpen,
      timeInClosed,
      timeInHalfOpen,
      failureRate,
      successRate,
      rejectionRate,
    };
  }

  private calculateStateTimes(history: Array<{ state: CircuitState; timestamp: number }>): {
    timeInOpen: number;
    timeInClosed: number;
    timeInHalfOpen: number;
  } {
    let timeInOpen = 0;
    let timeInClosed = 0;
    let timeInHalfOpen = 0;

    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i];
      const next = history[i + 1];
      const duration = next.timestamp - current.timestamp;

      switch (current.state) {
        case 'open':
          timeInOpen += duration;
          break;
        case 'closed':
          timeInClosed += duration;
          break;
        case 'half-open':
          timeInHalfOpen += duration;
          break;
      }
    }

    return { timeInOpen, timeInClosed, timeInHalfOpen };
  }

  getSummary(currentState: CircuitState): string {
    const metrics = this.getMetrics(currentState);

    return `
Circuit Breaker Metrics:
----------------------
Total Calls: ${metrics.totalCalls}
Successful: ${metrics.successfulCalls} (${metrics.successRate.toFixed(1)}%)
Failed: ${metrics.failedCalls} (${metrics.failureRate.toFixed(1)}%)
Rejected: ${metrics.rejectedCalls} (${metrics.rejectionRate.toFixed(1)}%)
State Changes: ${metrics.stateChanges}

Current State: ${metrics.currentState.toUpperCase()}
Time in OPEN: ${metrics.timeInOpen}ms
Time in CLOSED: ${metrics.timeInClosed}ms
Time in HALF-OPEN: ${metrics.timeInHalfOpen}ms
    `.trim();
  }

  reset(): void {
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      stateChanges: 0,
      stateHistory: [],
    };
  }
}
```

## Resilience Policy

### Policy Management

```typescript
// src/resilience/policy.ts

export interface ResiliencePolicy {
  name: string;
  description: string;

  // Retry configuration
  retry?: RetryConfig;

  // Circuit breaker configuration
  circuitBreaker?: CircuitBreakerConfig;

  // Fallback
  fallback?: () => any;

  // Timeout
  timeoutMs?: number;
}

export interface ServiceConfig {
  name: string;
  type: 'llm' | 'github' | 'tool' | 'verification';
  policy: ResiliencePolicy;
}

export class PolicyManager {
  private policies: Map<string, ResiliencePolicy> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    this.registerDefaultPolicies();
  }

  registerPolicy(name: string, policy: ResiliencePolicy): void {
    this.policies.set(name, policy);

    // Create circuit breaker if configured
    if (policy.circuitBreaker) {
      const cb = new CircuitBreaker(policy.circuitBreaker);
      this.circuitBreakers.set(name, cb);
    }
  }

  getPolicy(name: string): ResiliencePolicy | undefined {
    return this.policies.get(name);
  }

  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  async executeWithPolicy<T>(
    policyName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const policy = this.getPolicy(policyName);

    if (!policy) {
      throw new Error(`Policy not found: ${policyName}`);
    }

    // Get circuit breaker if configured
    const circuitBreaker = this.getCircuitBreaker(policyName);

    // Create retry engine if configured
    const retryEngine = policy.retry
      ? new RetryEngine(policy.retry)
      : null;

    try {
      // Wrap operation with circuit breaker
      const wrappedOperation = circuitBreaker
        ? () => circuitBreaker.execute(operation)
        : operation;

      // Execute with retry if configured
      if (retryEngine) {
        const result = await retryEngine.execute(wrappedOperation);
        if (result.success) {
          return result.result!;
        }
        throw result.error;
      }

      return await wrappedOperation();
    } catch (error) {
      // Use fallback if configured
      if (policy.fallback) {
        return policy.fallback();
      }

      throw error;
    }
  }

  private registerDefaultPolicies(): void {
    // LLM policy
    this.registerPolicy('llm', {
      name: 'llm',
      description: 'Retry and circuit breaker for LLM API calls',
      retry: {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        strategy: 'exponential',
        multiplier: 2,
        retryableErrors: ['RateLimitError', 'TimeoutError'],
        retryableStatuses: [429, 500, 502, 503, 504],
        jitterEnabled: true,
        jitterFactor: 0.1,
        timeoutMs: 60000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        successThreshold: 3,
        timeoutMs: 60000,
        halfOpenMaxCalls: 3,
        rollingWindowMs: 60000,
        rollingWindowBuckets: 10,
        monitorIntervalMs: 5000,
        enableMonitoring: true,
      },
      fallback: () => {
        throw new Error('LLM service unavailable');
      },
    });

    // GitHub policy
    this.registerPolicy('github', {
      name: 'github',
      description: 'Retry and circuit breaker for GitHub API calls',
      retry: {
        maxAttempts: 5,
        initialDelayMs: 1000,
        maxDelayMs: 60000,
        strategy: 'exponential',
        multiplier: 2,
        retryableStatuses: [408, 429, 500, 502, 503, 504],
        jitterEnabled: true,
        jitterFactor: 0.2,
        timeoutMs: 30000,
      },
      circuitBreaker: {
        failureThreshold: 10,
        successThreshold: 5,
        timeoutMs: 120000,
        halfOpenMaxCalls: 5,
        rollingWindowMs: 300000,
        rollingWindowBuckets: 10,
        monitorIntervalMs: 10000,
        enableMonitoring: true,
      },
    });

    // Tool execution policy
    this.registerPolicy('tool', {
      name: 'tool',
      description: 'Retry and circuit breaker for tool execution',
      retry: {
        maxAttempts: 3,
        initialDelayMs: 500,
        maxDelayMs: 10000,
        strategy: 'exponential',
        multiplier: 2,
        retryableErrors: ['TimeoutError'],
        jitterEnabled: true,
        jitterFactor: 0.15,
        timeoutMs: 30000,
      },
      circuitBreaker: {
        failureThreshold: 3,
        successThreshold: 2,
        timeoutMs: 30000,
        halfOpenMaxCalls: 2,
        rollingWindowMs: 60000,
        rollingWindowBuckets: 6,
        monitorIntervalMs: 5000,
        enableMonitoring: true,
      },
    });

    // Verification policy
    this.registerPolicy('verification', {
      name: 'verification',
      description: 'Retry and circuit breaker for verification checks',
      retry: {
        maxAttempts: 3,
        initialDelayMs: 2000,
        maxDelayMs: 30000,
        strategy: 'exponential',
        multiplier: 2,
        retryableErrors: ['TimeoutError', 'BuildError'],
        jitterEnabled: false,
        timeoutMs: 180000, // 3 minutes
      },
      circuitBreaker: undefined, // No circuit breaker for verification
    });
  }
}
```

## Integration with Error Handling

### Retry with Error Detection

```typescript
// src/resilience/integration.ts

export class ResilientExecutor {
  constructor(
    private policyManager: PolicyManager,
    private errorHandler: ErrorHandler
  ) {}

  async execute<T>(
    policyName: string,
    operation: () => Promise<T>,
    context?: Partial<ErrorSource>
  ): Promise<T> {
    try {
      // Execute with resilience policy
      return await this.policyManager.executeWithPolicy(
        policyName,
        operation
      );
    } catch (error) {
      // Detect error
      const errorContext = this.errorHandler.detector.detect(error, context);

      // Report error
      this.errorHandler.reporter.report(errorContext);

      // Throw error
      throw error;
    }
  }
}
```

## Migration Path

### Phase 1: Foundation (P0)

1. Implement `RetryEngine` class
2. Implement `RetryMetrics` class
3. Implement `CircuitBreaker` class
4. Implement `CircuitMetrics` class
5. Implement `PolicyManager` class
6. Implement `ResilientExecutor` class

### Phase 2: Integration (P1)

7. Update LLM provider to use retry/circuit breaker
8. Update GitHub tool to use retry/circuit breaker
9. Update tool executor to use retry/circuit breaker
10. Update verification loop to use retry
11. Add fallback functions for critical operations

### Phase 3: Optimization (P2)

12. Add adaptive retry policies
13. Add circuit breaker health monitoring
14. Add resilience metrics dashboard
15. Add automatic policy tuning

## Error Handling

### Retry Errors

| Error | Handling |
|-------|-----------|
| Non-retryable error | Fail immediately |
| Max retries exceeded | Throw last error |
| Overall timeout | Fail with timeout error |
| Circuit breaker OPEN | Throw CircuitBreakerOpenError |

### Circuit Breaker Errors

| Error | Handling |
|-------|-----------|
| Circuit OPEN | Reject immediately, return CircuitBreakerOpenError |
| Transition failure | Log error, continue in current state |
| Monitor failure | Log error, circuit may not auto-recover |

## Testing Strategy

### Unit Tests

```typescript
// tests/resilience/retry.test.ts
describe('RetryEngine', () => {
  it('should retry on retryable error', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary error');
      }
      return 'success';
    };

    const config: RetryConfig = {
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      strategy: 'exponential',
      multiplier: 2,
      jitterEnabled: false,
    };

    const engine = new RetryEngine(config);
    const result = await engine.execute(operation);

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(3);
  });

  it('should not retry non-retryable error', async () => {
    const operation = async () => {
      throw new Error('Not found');
    };

    const config: RetryConfig = {
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      strategy: 'exponential',
      multiplier: 2,
      retryableErrors: ['RateLimitError'],
      jitterEnabled: false,
    };

    const engine = new RetryEngine(config);
    const result = await engine.execute(operation);

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
  });
});

// tests/resilience/circuit-breaker.test.ts
describe('CircuitBreaker', () => {
  it('should open circuit after failure threshold', async () => {
    const config: CircuitBreakerConfig = {
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 5000,
      halfOpenMaxCalls: 2,
      rollingWindowMs: 60000,
      rollingWindowBuckets: 10,
      enableMonitoring: false,
    };

    const circuitBreaker = new CircuitBreaker(config);

    // Fail 3 times
    const operation = async () => {
      throw new Error('Service error');
    };

    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected
      }
    }

    // Circuit should be OPEN
    expect(circuitBreaker.isOpen()).toBe(true);

    // Next call should be rejected
    await expect(
      circuitBreaker.execute(operation)
    ).rejects.toThrow(CircuitBreakerOpenError);
  });

  it('should close circuit after success threshold', async () => {
    const config: CircuitBreakerConfig = {
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 100, // Short timeout for testing
      halfOpenMaxCalls: 2,
      rollingWindowMs: 60000,
      rollingWindowBuckets: 10,
      enableMonitoring: false,
    };

    const circuitBreaker = new CircuitBreaker(config);
    const failOperation = async () => {
      throw new Error('Service error');
    };
    const successOperation = async () => 'success';

    // Fail 3 times to open circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failOperation);
      } catch (error) {
        // Expected
      }
    }

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 150));

    // Succeed 2 times to close circuit
    for (let i = 0; i < 2; i++) {
      await circuitBreaker.execute(successOperation);
    }

    // Circuit should be CLOSED
    expect(circuitBreaker.isClosed()).toBe(true);
  });
});
```

## Next Steps

1. Implement `RetryEngine` class
2. Implement `RetryMetrics` class
3. Implement `CircuitBreaker` class
4. Implement `CircuitMetrics` class
5. Implement `PolicyManager` class
6. Implement `ResilientExecutor` class
7. Write comprehensive tests
8. Integrate with LLM provider
9. Integrate with GitHub tool
10. Integrate with tool executor
11. Integrate with verification loop
12. Add documentation

## Conclusion

This design provides:

- ✅ **Retry logic**: Automatic retry with exponential, linear, fixed, or custom strategies
- ✅ **Backoff**: Configurable backoff with jitter
- ✅ **Circuit breaking**: Automatic circuit opening/closing with configurable thresholds
- ✅ **Policy management**: Predefined policies for LLM, GitHub, tool, verification
- ✅ **Metrics**: Comprehensive metrics for retries and circuit breakers
- ✅ **Integration**: Seamless integration with error handling system
- ✅ **Fallbacks**: Configurable fallback functions
- ✅ **Monitoring**: Automatic state transitions and monitoring

**Estimated Implementation Time**: 3-4 hours  
**Risk**: MEDIUM  
**Dependencies**: Error handling system (arch-4)
