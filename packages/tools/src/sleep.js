/**
 * Sleep Tool
 *
 * Delays execution for a specified duration
 */
import { ToolExecutionError } from '@duyetbot/types';
import { z } from 'zod';

// Input schema for sleep tool
const sleepInputSchema = z.union([
  z
    .string()
    .transform((val) => Number.parseInt(val, 10))
    .pipe(z.number().positive('Duration must be positive'))
    .transform((duration) => ({ duration })),
  z.object({
    duration: z.number().positive('Duration must be positive'),
    unit: z.enum(['milliseconds', 'seconds', 'minutes']).optional().default('milliseconds'),
  }),
]);
// Maximum sleep duration: 5 minutes
const MAX_DURATION_MS = 5 * 60 * 1000;
/**
 * Sleep tool implementation
 */
export class SleepTool {
  name = 'sleep';
  description =
    'Sleep/pause execution for a specified duration. Useful for rate limiting, scheduling delays, or waiting between operations.';
  inputSchema = sleepInputSchema;
  /**
   * Validate input
   */
  validate(input) {
    const result = this.inputSchema.safeParse(input.content);
    if (!result.success) {
      return false;
    }
    const duration = this.getDurationInMs(result.data);
    return duration > 0 && duration <= MAX_DURATION_MS;
  }
  /**
   * Execute sleep
   */
  async execute(input) {
    const startTime = Date.now();
    try {
      // Validate and parse input
      const parsed = this.inputSchema.safeParse(input.content);
      if (!parsed.success) {
        return {
          status: 'error',
          content: 'Invalid input',
          error: {
            message: `Invalid input: ${parsed.error.message}`,
            code: 'INVALID_INPUT',
          },
        };
      }
      const durationMs = this.getDurationInMs(parsed.data);
      // Check maximum duration
      if (durationMs > MAX_DURATION_MS) {
        return {
          status: 'error',
          content: `Duration too long (max ${MAX_DURATION_MS}ms)`,
          error: {
            message: `Duration ${durationMs}ms exceeds maximum ${MAX_DURATION_MS}ms`,
            code: 'DURATION_TOO_LONG',
          },
        };
      }
      // Check for abort signal
      const signal = input.metadata?.signal;
      // Execute sleep
      await this.sleep(durationMs, signal);
      const endTime = Date.now();
      return {
        status: 'success',
        content: `Slept for ${durationMs}ms`,
        metadata: {
          duration: durationMs,
          startTime,
          endTime,
          actualDuration: endTime - startTime,
          ...(input.metadata?.reason ? { reason: input.metadata.reason } : {}),
        },
      };
    } catch (error) {
      // Handle abort/cancellation
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          status: 'cancelled',
          content: 'Sleep was cancelled',
          error: {
            message: 'Sleep operation was aborted',
            code: 'ABORTED',
          },
          metadata: {
            startTime,
            endTime: Date.now(),
          },
        };
      }
      // Handle other errors
      throw new ToolExecutionError(
        'sleep',
        error instanceof Error ? error.message : 'Unknown error',
        'EXECUTION_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }
  /**
   * Sleep for specified duration with optional cancellation
   */
  sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        const error = new Error('Sleep aborted');
        error.name = 'AbortError';
        reject(error);
        return;
      }
      const timeout = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          const error = new Error('Sleep aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }
    });
  }
  /**
   * Convert duration to milliseconds
   */
  getDurationInMs(data) {
    const { duration, unit = 'milliseconds' } = data;
    switch (unit) {
      case 'seconds':
        return duration * 1000;
      case 'minutes':
        return duration * 60 * 1000;
      default:
        return duration;
    }
  }
}
/**
 * Create and export singleton instance
 */
export const sleepTool = new SleepTool();
