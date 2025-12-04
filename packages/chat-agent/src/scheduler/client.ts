/**
 * Scheduler Client
 *
 * Helper functions for interacting with SchedulerObject Durable Object.
 * Provides type-safe API for scheduling tasks from worker applications.
 *
 * Usage:
 * ```typescript
 * import { scheduleTask, getSchedulerStatus } from '@duyetbot/chat-agent';
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
import { logger } from '@duyetbot/hono-middleware';
import type { EnergyCost, ScheduledTask, TaskSource, TaskType } from './types.js';
import { DEFAULT_ENERGY_COSTS } from './types.js';

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
export function getSchedulerStub(namespace: DurableObjectNamespace): DurableObjectStub {
  // Use a singleton ID for the scheduler (one scheduler per deployment)
  const id = namespace.idFromName('global-scheduler');
  return namespace.get(id);
}

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
export async function scheduleTask(
  namespace: DurableObjectNamespace,
  options: ScheduleTaskOptions
): Promise<string> {
  const now = Date.now();
  const task: ScheduledTask = {
    id: crypto.randomUUID(),
    type: options.type,
    priority: Math.max(1, Math.min(100, options.priority)),
    scheduledFor: options.scheduledFor ?? now,
    createdAt: now,
    energyCost: options.energyCost ?? DEFAULT_ENERGY_COSTS[options.type],
    payload: options.payload,
    source: options.source ?? 'self',
    // Only include metadata if description is provided (exactOptionalPropertyTypes)
    ...(options.description && { metadata: { description: options.description } }),
  };

  logger.info('[SchedulerClient] Scheduling task', {
    taskId: task.id,
    type: task.type,
    priority: task.priority,
  });

  const stub = getSchedulerStub(namespace);
  const response = await stub.fetch('http://scheduler/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to schedule task: ${error}`);
  }

  const result = (await response.json()) as { taskId: string };
  return result.taskId;
}

/**
 * Cancel a scheduled task
 *
 * @param namespace - SchedulerObject namespace binding
 * @param taskId - ID of task to cancel
 * @returns true if task was found and cancelled
 */
export async function cancelTask(
  namespace: DurableObjectNamespace,
  taskId: string
): Promise<boolean> {
  logger.info('[SchedulerClient] Cancelling task', { taskId });

  const stub = getSchedulerStub(namespace);
  const response = await stub.fetch(`http://scheduler/task/${taskId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    logger.warn('[SchedulerClient] Failed to cancel task', { taskId });
    return false;
  }

  const result = (await response.json()) as { success: boolean };
  return result.success;
}

/**
 * Get scheduler status
 *
 * @param namespace - SchedulerObject namespace binding
 * @returns Current scheduler status
 */
export async function getSchedulerStatus(
  namespace: DurableObjectNamespace
): Promise<SchedulerStatus> {
  const stub = getSchedulerStub(namespace);
  const response = await stub.fetch('http://scheduler/status', {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to get scheduler status');
  }

  return (await response.json()) as SchedulerStatus;
}

/**
 * Manually trigger a scheduler tick (for testing)
 *
 * @param namespace - SchedulerObject namespace binding
 */
export async function triggerSchedulerTick(namespace: DurableObjectNamespace): Promise<void> {
  logger.info('[SchedulerClient] Manually triggering tick');

  const stub = getSchedulerStub(namespace);
  const response = await stub.fetch('http://scheduler/tick', {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to trigger tick: ${error}`);
  }
}

/**
 * Schedule a research task (convenience helper)
 *
 * @param namespace - SchedulerObject namespace binding
 * @param topic - Research topic
 * @param priority - Priority 1-100 (default: 50)
 * @param scheduledFor - When to run (default: now)
 * @returns Task ID
 */
export async function scheduleResearch(
  namespace: DurableObjectNamespace,
  topic: string,
  priority = 50,
  scheduledFor?: number
): Promise<string> {
  return scheduleTask(namespace, {
    type: 'research',
    priority,
    payload: { topic },
    ...(scheduledFor !== undefined && { scheduledFor }),
    description: `Research: ${topic}`,
  });
}

/**
 * Schedule a notification task (convenience helper)
 *
 * @param namespace - SchedulerObject namespace binding
 * @param message - Notification message
 * @param chatId - Target chat ID
 * @param priority - Priority 1-100 (default: 30)
 * @returns Task ID
 */
export async function scheduleNotification(
  namespace: DurableObjectNamespace,
  message: string,
  chatId: string,
  priority = 30
): Promise<string> {
  return scheduleTask(namespace, {
    type: 'notification',
    priority,
    payload: { message, chatId },
    description: `Notify: ${message.substring(0, 50)}...`,
  });
}

/**
 * Schedule a maintenance task (convenience helper)
 *
 * @param namespace - SchedulerObject namespace binding
 * @param taskName - Maintenance task name
 * @param payload - Task-specific data
 * @param scheduledFor - When to run (default: now)
 * @returns Task ID
 */
export async function scheduleMaintenance(
  namespace: DurableObjectNamespace,
  taskName: string,
  payload: unknown = {},
  scheduledFor?: number
): Promise<string> {
  return scheduleTask(namespace, {
    type: 'maintenance',
    priority: 40,
    payload: { taskName, ...(payload as Record<string, unknown>) },
    ...(scheduledFor !== undefined && { scheduledFor }),
    description: `Maintenance: ${taskName}`,
  });
}
