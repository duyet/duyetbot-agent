/**
 * Scheduler Client
 *
 * Helper functions for interacting with SchedulerObject Durable Object.
 * Provides type-safe API for scheduling tasks from worker applications.
 *
 * Usage:
 * ```typescript
 * import { scheduleTask, getSchedulerStatus } from '@duyetbot/cloudflare-agent';
 *
 * // Schedule a research task
 * await scheduleTask(env.SchedulerObject, {
 *   type: 'research',
 *   priority: 60,
 *   payload: { topic: 'HackerNews top stories' }
 * });
 *
 * // Get scheduler status
 * const status = await getSchedulerStatus(env.SchedulerObject);
 * ```
 */
import type { DurableObjectNamespace, DurableObjectStub } from '@cloudflare/workers-types';
import type { EnergyCost, TaskSource, TaskType } from './types.js';
/**
 * Options for scheduling a task
 */
export interface ScheduleTaskOptions {
  /** Task type determines default energy costs and priority weights */
  type: TaskType;
  /** Priority 1-100, higher = more urgent */
  priority: number;
  /** Task-specific data */
  payload: unknown;
  /** When to run (default: now) */
  scheduledFor?: number | undefined;
  /** Task source (default: 'self') */
  source?: TaskSource | undefined;
  /** Custom energy cost (default: from type) */
  energyCost?: EnergyCost | undefined;
  /** Optional description */
  description?: string | undefined;
}
/**
 * Scheduler status response
 */
export interface SchedulerStatus {
  queueSize: number;
  nextTaskDueAt?: number;
  energyPercent: number;
  readyCount: number;
}
/**
 * Get a SchedulerObject stub from a namespace
 *
 * Uses a singleton pattern - all tasks go to the same scheduler instance.
 *
 * @param namespace - SchedulerObject namespace binding
 * @returns DurableObject stub
 */
export declare function getSchedulerStub(namespace: DurableObjectNamespace): DurableObjectStub;
/**
 * Schedule a task for execution
 *
 * @param namespace - SchedulerObject namespace binding
 * @param options - Task options
 * @returns Scheduled task ID
 *
 * @example
 * ```typescript
 * const taskId = await scheduleTask(env.SchedulerObject, {
 *   type: 'research',
 *   priority: 60,
 *   payload: { sources: ['hackernews', 'arxiv'] }
 * });
 * ```
 */
export declare function scheduleTask(
  namespace: DurableObjectNamespace,
  options: ScheduleTaskOptions
): Promise<string>;
/**
 * Cancel a scheduled task
 *
 * @param namespace - SchedulerObject namespace binding
 * @param taskId - ID of task to cancel
 * @returns true if task was found and cancelled
 */
export declare function cancelTask(
  namespace: DurableObjectNamespace,
  taskId: string
): Promise<boolean>;
/**
 * Get scheduler status
 *
 * @param namespace - SchedulerObject namespace binding
 * @returns Current scheduler status
 */
export declare function getSchedulerStatus(
  namespace: DurableObjectNamespace
): Promise<SchedulerStatus>;
/**
 * Manually trigger a scheduler tick (for testing)
 *
 * @param namespace - SchedulerObject namespace binding
 */
export declare function triggerSchedulerTick(namespace: DurableObjectNamespace): Promise<void>;
/**
 * Schedule a research task (convenience helper)
 *
 * @param namespace - SchedulerObject namespace binding
 * @param topic - Research topic
 * @param priority - Priority 1-100 (default: 50)
 * @param scheduledFor - When to run (default: now)
 * @returns Task ID
 */
export declare function scheduleResearch(
  namespace: DurableObjectNamespace,
  topic: string,
  priority?: number,
  scheduledFor?: number
): Promise<string>;
/**
 * Schedule a notification task (convenience helper)
 *
 * @param namespace - SchedulerObject namespace binding
 * @param message - Notification message
 * @param chatId - Target chat ID
 * @param priority - Priority 1-100 (default: 30)
 * @returns Task ID
 */
export declare function scheduleNotification(
  namespace: DurableObjectNamespace,
  message: string,
  chatId: string,
  priority?: number
): Promise<string>;
/**
 * Schedule a maintenance task (convenience helper)
 *
 * @param namespace - SchedulerObject namespace binding
 * @param taskName - Maintenance task name
 * @param payload - Task-specific data
 * @param scheduledFor - When to run (default: now)
 * @returns Task ID
 */
export declare function scheduleMaintenance(
  namespace: DurableObjectNamespace,
  taskName: string,
  payload?: unknown,
  scheduledFor?: number
): Promise<string>;
//# sourceMappingURL=client.d.ts.map
