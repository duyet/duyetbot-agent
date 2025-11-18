/**
 * Performance Timing Middleware
 *
 * Tracks request timing and adds Server-Timing headers
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types';

/**
 * Timing entry for Server-Timing header
 */
interface TimingEntry {
  name: string;
  duration: number;
  description?: string;
}

/**
 * Performance timer class
 */
export class PerformanceTimer {
  private timings: Map<string, { start: number; end?: number; description?: string }> = new Map();

  /**
   * Start a timer
   */
  start(name: string, description?: string) {
    this.timings.set(name, {
      start: Date.now(),
      description,
    });
  }

  /**
   * End a timer
   */
  end(name: string) {
    const timing = this.timings.get(name);
    if (timing) {
      timing.end = Date.now();
    }
  }

  /**
   * Get all timings
   */
  getTimings(): TimingEntry[] {
    const entries: TimingEntry[] = [];

    for (const [name, timing] of this.timings.entries()) {
      if (timing.end) {
        entries.push({
          name,
          duration: timing.end - timing.start,
          description: timing.description,
        });
      }
    }

    return entries;
  }

  /**
   * Get total duration
   */
  getTotalDuration(): number {
    const timings = this.getTimings();
    if (timings.length === 0) {
      return 0;
    }
    return Math.max(...timings.map((t) => t.duration));
  }

  /**
   * Format as Server-Timing header value
   * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing
   */
  toServerTimingHeader(): string {
    const entries = this.getTimings();
    return entries
      .map((entry) => {
        let str = `${entry.name};dur=${entry.duration}`;
        if (entry.description) {
          str += `;desc="${entry.description}"`;
        }
        return str;
      })
      .join(', ');
  }
}

/**
 * Performance timing middleware
 * Tracks request timing and adds Server-Timing header
 */
export async function timingMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const timer = new PerformanceTimer();

  // Store timer in context
  c.set('timer', timer);

  // Track total request time
  timer.start('total', 'Total request time');

  await next();

  timer.end('total');

  // Add Server-Timing header
  const serverTiming = timer.toServerTimingHeader();
  if (serverTiming) {
    c.header('Server-Timing', serverTiming);
  }

  // Add total duration header
  c.header('X-Response-Time', `${timer.getTotalDuration()}ms`);
}

/**
 * Get performance timer from context
 */
export function getTimer(c: Context): PerformanceTimer {
  const timer = c.get('timer');
  if (!timer) {
    // Fallback to new timer if not in context
    return new PerformanceTimer();
  }
  return timer as PerformanceTimer;
}

/**
 * Measure async operation
 */
export async function measure<T>(
  c: Context,
  name: string,
  fn: () => Promise<T>,
  description?: string
): Promise<T> {
  const timer = getTimer(c);
  timer.start(name, description);

  try {
    const result = await fn();
    timer.end(name);
    return result;
  } catch (error) {
    timer.end(name);
    throw error;
  }
}
