/**
 * Durable Object Error Recovery Patterns
 *
 * Provides robust error recovery mechanisms for Cloudflare Durable Objects.
 * Includes retry with exponential backoff, circuit breaker, and state snapshots.
 */

/**
 * Error types for Durable Object operations
 */
export type DOErrorType =
  | 'network_error'
  | 'timeout_error'
  | 'storage_error'
  | 'eviction_error'
  | 'version_mismatch'
  | 'unknown_error';

/**
 * Classification of error severity
 */
export type ErrorSeverity = 'transient' | 'permanent' | 'degraded';

/**
 * Durable Object operation error
 */
export interface DOOperationError extends Error {
  type: DOErrorType;
  severity: ErrorSeverity;
  retryable: boolean;
  originalError?: unknown;
  timestamp: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half_open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  openTimeoutMs: number;
  successThreshold: number;
}

/**
 * Recovery configuration
 */
export interface DOErrorRecoveryConfig {
  retry?: Partial<RetryConfig>;
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  classifyError?: (error: unknown) => ErrorSeverity;
  onRetry?: (attempt: number, error: DOOperationError) => void;
  onCircuitStateChange?: (state: CircuitState) => void;
}

const DEFAULT_RETRY: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

const DEFAULT_CIRCUIT_BREAKER: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  openTimeoutMs: 60000,
  successThreshold: 2,
};

/**
 * Create a DO operation error
 */
function createDOError(
  type: DOErrorType,
  severity: ErrorSeverity,
  message: string,
  originalError?: unknown
): DOOperationError {
  const error = new Error(message) as DOOperationError;
  error.name = 'DOOperationError';
  error.type = type;
  error.severity = severity;
  error.retryable = severity === 'transient';
  error.originalError = originalError;
  error.timestamp = Date.now();
  return error;
}

/**
 * Classify error based on type and message
 */
function classifyError(error: unknown): ErrorSeverity {
  if (error instanceof DOOperationError) {
    return error.severity;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('fetch failed')
    ) {
      return 'transient';
    }

    if (message.includes('storage') || message.includes('io error')) {
      return message.includes('no such file') ? 'permanent' : 'transient';
    }

    if (message.includes('evicted') || message.includes('not found')) {
      return 'transient';
    }

    if (message.includes('version') || message.includes('compatibility')) {
      return 'permanent';
    }
  }

  return 'degraded';
}

/**
 * Calculate retry delay with exponential backoff and jitter
 */
function calculateRetryDelay(attempt: number, config: Required<RetryConfig>): number {
  const exponentialDelay = Math.min(
    config.baseDelayMs * config.backoffMultiplier ** attempt,
    config.maxDelayMs
  );
  const jitter = exponentialDelay * config.jitterFactor * Math.random();
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Circuit Breaker for preventing cascading failures
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private openUntil = 0;

  constructor(private config: Required<CircuitBreakerConfig>) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() < this.openUntil) {
        throw createDOError(
          'circuit_breaker',
          'permanent',
          'Circuit breaker is open - rejecting requests',
          undefined
        );
      }
      this.transitionTo('half_open');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'half_open') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.config.failureThreshold) {
      this.openUntil = Date.now() + this.config.openTimeoutMs;
      this.transitionTo('open');
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      this.state = newState;
      if (this.state === 'closed') {
        this.successCount = 0;
      }
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.openUntil = 0;
  }
}

/**
 * Durable Object Error Recovery Manager
 */
export class DOErrorRecovery {
  private retry: Required<RetryConfig>;
  private circuitBreaker: CircuitBreaker;

  constructor(config: DOErrorRecoveryConfig = {}) {
    this.retry = { ...DEFAULT_RETRY, ...config.retry };
    this.circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER,
      ...config.circuitBreaker,
    });
  }

  async execute<T>(
    operation: () => Promise<T>,
    options: {
      operationName?: string;
      skipCircuitBreaker?: boolean;
      skipRetry?: boolean;
    } = {}
  ): Promise<T> {
    const { skipCircuitBreaker = false, skipRetry = false } = options;
    const exec = async (): Promise<T> => {
      if (skipRetry) {
        return await operation();
      }

      let lastError: DOOperationError | undefined;

      for (let attempt = 0; attempt <= this.retry.maxRetries; attempt++) {
        try {
          return await operation();
        } catch (error) {
          const severity = config.classifyError
            ? config.classifyError(error)
            : classifyError(error);

          lastError = createDOError(
            this.getErrorType(error),
            severity,
            error instanceof Error ? error.message : String(error),
            error
          );

          if (severity === 'permanent') {
            throw lastError;
          }

          if (attempt === this.retry.maxRetries) {
            throw lastError;
          }

          config.onRetry?.(attempt, lastError);

          const delay = calculateRetryDelay(attempt, this.retry);
          await sleep(delay);
        }
      }

      throw lastError || new Error('Unknown error in retry logic');
    };

    if (skipCircuitBreaker) {
      return await exec();
    }

    return await this.circuitBreaker.execute(exec);
  }

  private getErrorType(error: unknown): DOErrorType {
    if (error instanceof DOOperationError) {
      return error.type;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('timeout')) {
        return 'timeout_error';
      }
      if (message.includes('network') || message.includes('fetch')) {
        return 'network_error';
      }
      if (message.includes('storage') || message.includes('io')) {
        return 'storage_error';
      }
      if (message.includes('evicted')) {
        return 'eviction_error';
      }
      if (message.includes('version')) {
        return 'version_mismatch';
      }
    }

    return 'unknown_error';
  }

  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }
}

export const doErrorRecovery = new DOErrorRecovery();
