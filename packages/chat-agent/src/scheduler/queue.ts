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
export const QUEUE_CONSTANTS = {
  // How much urgency increases per minute as deadline approaches
  URGENCY_ACCELERATION_PER_MINUTE: 0.5,
  // How much urgency increases per minute as task ages
  AGE_URGENCY_PER_MINUTE: 0.1,
  // Task is considered "overdue" if scheduled time has passed
  OVERDUE_URGENCY_MULTIPLIER: 5.0,
  // Maximum task age before auto-removal (24 hours)
  MAX_TASK_AGE_MS: 24 * 60 * 60 * 1000,
} as const;

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
export function calculateUrgency(task: ScheduledTask, now: number): number {
  // Start with base priority
  let urgency = task.priority;

  // Add deadline proximity component
  const msUntilScheduled = task.scheduledFor - now;
  const minutesUntilScheduled = msUntilScheduled / (60 * 1000);

  if (msUntilScheduled < 0) {
    // Task is overdue - apply huge multiplier
    urgency *= QUEUE_CONSTANTS.OVERDUE_URGENCY_MULTIPLIER;
  } else {
    // Task not yet due - urgency increases as we approach deadline
    // Close deadlines have higher urgency than distant ones
    urgency +=
      Math.max(0, 100 - minutesUntilScheduled) * QUEUE_CONSTANTS.URGENCY_ACCELERATION_PER_MINUTE;
  }

  // Add age component (prevent starvation)
  const msInQueue = now - task.createdAt;
  const minutesInQueue = msInQueue / (60 * 1000);
  urgency += minutesInQueue * QUEUE_CONSTANTS.AGE_URGENCY_PER_MINUTE;

  return urgency;
}

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
export function addTask(
  queue: ScheduledTask[],
  task: ScheduledTask,
  now: number = Date.now()
): ScheduledTask[] {
  const newUrgency = calculateUrgency(task, now);

  // Find insertion point via binary search
  let left = 0;
  let right = queue.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const midUrgency = calculateUrgency(queue[mid]!, now);

    if (midUrgency > newUrgency) {
      left = mid + 1; // Existing task is more urgent, insert after
    } else {
      right = mid; // New task is more urgent, insert before
    }
  }

  // Insert at the correct position
  queue.splice(left, 0, task);
  return queue;
}

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
export function getReadyTasks(queue: ScheduledTask[], now: number = Date.now()): ScheduledTask[] {
  return queue
    .filter((task) => task.scheduledFor <= now)
    .sort((a, b) => calculateUrgency(b, now) - calculateUrgency(a, now));
}

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
export function removeTask(queue: ScheduledTask[], taskId: string): boolean {
  const index = queue.findIndex((t) => t.id === taskId);
  if (index === -1) {
    return false;
  }

  queue.splice(index, 1);
  return true;
}

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
export function cleanupStaleTasks(
  queue: ScheduledTask[],
  maxAgeMs: number = QUEUE_CONSTANTS.MAX_TASK_AGE_MS,
  now: number = Date.now()
): {
  removedCount: number;
  removedTasks: ScheduledTask[];
} {
  const initialLength = queue.length;
  const removed: ScheduledTask[] = [];

  // Filter in place (more efficient than splice)
  let writeIndex = 0;
  for (const task of queue) {
    const age = now - task.createdAt;

    if (age > maxAgeMs) {
      removed.push(task);
    } else {
      queue[writeIndex] = task;
      writeIndex++;
    }
  }

  // Trim the array
  queue.length = writeIndex;

  return {
    removedCount: initialLength - writeIndex,
    removedTasks: removed,
  };
}

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
export function getQueueStats(
  queue: ScheduledTask[],
  now: number = Date.now()
): {
  totalTasks: number;
  readyTasks: number;
  pendingTasks: number;
  oldestTaskAgeMs: number;
  newestTaskAgeMs: number;
  avgAgeMs: number;
} {
  const readyCount = queue.filter((t) => t.scheduledFor <= now).length;

  if (queue.length === 0) {
    return {
      totalTasks: 0,
      readyTasks: 0,
      pendingTasks: 0,
      oldestTaskAgeMs: 0,
      newestTaskAgeMs: 0,
      avgAgeMs: 0,
    };
  }

  const ages = queue.map((t) => now - t.createdAt);
  const totalAge = ages.reduce((a, b) => a + b, 0);

  return {
    totalTasks: queue.length,
    readyTasks: readyCount,
    pendingTasks: queue.length - readyCount,
    oldestTaskAgeMs: Math.max(...ages),
    newestTaskAgeMs: Math.min(...ages),
    avgAgeMs: Math.floor(totalAge / queue.length),
  };
}

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
export function findTasksByType(queue: ScheduledTask[], type: string): ScheduledTask[] {
  return queue.filter((t) => t.type === type);
}
