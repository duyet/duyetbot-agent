/**
 * Priority Queue Management
 *
 * Implements a priority queue for scheduling tasks based on:
 * - Base priority (1-100)
 * - Deadline proximity (urgency multiplier)
 * - Task age (older tasks increase in urgency)
 *
 * Tasks are kept sorted by calculated urgency for efficient processing.
 */
import type { ScheduledTask } from './types.js';
/**
 * Queue constants for urgency calculation
 */
export declare const QUEUE_CONSTANTS: {
  readonly URGENCY_ACCELERATION_PER_MINUTE: 0.5;
  readonly AGE_URGENCY_PER_MINUTE: 0.1;
  readonly OVERDUE_URGENCY_MULTIPLIER: 5;
  readonly MAX_TASK_AGE_MS: number;
};
/**
 * Calculate urgency score for a task
 *
 * Urgency increases as:
 * 1. Base priority (1-100)
 * 2. Task approaches scheduled time (deadline proximity)
 * 3. Task ages in queue (prevents starvation)
 * 4. Task is overdue (huge multiplier)
 *
 * Formula:
 * ```
 * basePriority +
 * (urgencyAcceleration * minutesUntilScheduled) +
 * (ageUrgency * minutesInQueue) +
 * (overdueMultiplier if scheduledFor < now)
 * ```
 *
 * @param task - The task to calculate urgency for
 * @param now - Current timestamp in ms
 * @returns Urgency score (higher = more urgent)
 *
 * @example
 * ```typescript
 * const urgency = calculateUrgency(task, Date.now());
 * // Returns a number that increases as deadline approaches
 * ```
 */
export declare function calculateUrgency(task: ScheduledTask, now: number): number;
/**
 * Add a task to the priority queue, maintaining sorted order
 *
 * Inserts the task at the correct position to keep the queue sorted by urgency.
 * Uses binary search for efficiency O(log n) insertion point, then O(n) splice.
 *
 * @param queue - The task queue (mutated)
 * @param task - The task to add
 * @param now - Current timestamp for urgency calculation
 * @returns The updated queue (same object)
 *
 * @example
 * ```typescript
 * const queue: ScheduledTask[] = [];
 * addTask(queue, newTask, Date.now());
 * // queue is now sorted by urgency
 * ```
 */
export declare function addTask(
  queue: ScheduledTask[],
  task: ScheduledTask,
  now?: number
): ScheduledTask[];
/**
 * Get all tasks that are ready to run
 *
 * Returns tasks where scheduledFor <= now, sorted by urgency (most urgent first).
 * Does not modify the queue.
 *
 * @param queue - The task queue
 * @param now - Current timestamp
 * @returns Array of ready tasks, sorted by urgency (highest first)
 *
 * @example
 * ```typescript
 * const readyTasks = getReadyTasks(queue, Date.now());
 * for (const task of readyTasks) {
 *   await executeTask(task);
 * }
 * ```
 */
export declare function getReadyTasks(queue: ScheduledTask[], now?: number): ScheduledTask[];
/**
 * Remove a task from the queue by ID
 *
 * @param queue - The task queue (mutated)
 * @param taskId - The task ID to remove
 * @returns true if task was removed, false if not found
 *
 * @example
 * ```typescript
 * const removed = removeTask(queue, 'task-123');
 * if (!removed) {
 *   console.warn('Task not found');
 * }
 * ```
 */
export declare function removeTask(queue: ScheduledTask[], taskId: string): boolean;
/**
 * Clean up stale tasks from the queue
 *
 * Removes tasks older than maxAge and returns information about what was removed.
 * Useful for preventing the queue from growing unboundedly.
 *
 * @param queue - The task queue (mutated)
 * @param maxAgeMs - Maximum task age in milliseconds (default: 24 hours)
 * @param now - Current timestamp for age calculation
 * @returns Object with cleanup results
 *
 * @example
 * ```typescript
 * const result = cleanupStaleTask(queue, 24 * 60 * 60 * 1000, Date.now());
 * console.log(`Removed ${result.removedCount} stale tasks`);
 * if (result.removedTasks.length > 0) {
 *   logger.info('Cleaned up stale tasks', { tasks: result.removedTasks });
 * }
 * ```
 */
export declare function cleanupStaleTasks(
  queue: ScheduledTask[],
  maxAgeMs?: number,
  now?: number
): {
  removedCount: number;
  removedTasks: ScheduledTask[];
};
/**
 * Get queue statistics for monitoring
 *
 * Provides insight into queue health and composition.
 *
 * @param queue - The task queue
 * @param now - Current timestamp
 * @returns Queue statistics
 *
 * @example
 * ```typescript
 * const stats = getQueueStats(queue, Date.now());
 * logger.info('Queue stats', {
 *   total: stats.totalTasks,
 *   ready: stats.readyTasks,
 *   avgAge: stats.avgAgeMs,
 * });
 * ```
 */
export declare function getQueueStats(
  queue: ScheduledTask[],
  now?: number
): {
  totalTasks: number;
  readyTasks: number;
  pendingTasks: number;
  oldestTaskAgeMs: number;
  newestTaskAgeMs: number;
  avgAgeMs: number;
};
/**
 * Find tasks by type
 *
 * Useful for debugging or implementing type-specific policies.
 *
 * @param queue - The task queue
 * @param type - The task type to find
 * @returns Array of matching tasks
 *
 * @example
 * ```typescript
 * const criticalTasks = findTasksByType(queue, 'critical');
 * ```
 */
export declare function findTasksByType(queue: ScheduledTask[], type: string): ScheduledTask[];
//# sourceMappingURL=queue.d.ts.map
