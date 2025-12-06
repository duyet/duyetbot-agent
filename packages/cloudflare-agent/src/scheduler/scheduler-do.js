/**
 * Scheduler Durable Object
 *
 * Implements agentic task scheduling with hybrid energy budget.
 * The scheduler decides WHEN to work based on:
 * - Task priority and deadlines
 * - Available energy budget (tokens + compute)
 * - Activity patterns (quiet hours for background work)
 *
 * Acts as a pure scheduler without LLM capabilities (unlike Agent classes).
 * Task execution is delegated to workers via HTTP callbacks.
 *
 * Uses Cloudflare Durable Objects alarm API for scheduling.
 *
 * This is a library module - actual DO instance and HTTP handler
 * are provided by consuming worker applications.
 */
import { logger } from '@duyetbot/hono-middleware';
import { canAffordTask, deductEnergy, regenerateEnergy } from './energy.js';
import { addTask, cleanupStaleTasks, getReadyTasks, removeTask } from './queue.js';
import {
  createInitialSchedulerState,
  DEFAULT_SCHEDULER_CONFIG as DEFAULT_CONFIG,
} from './types.js';
/**
 * Scheduler Durable Object
 *
 * Uses ctx for state persistence and alarm scheduling.
 * Designed to be instantiated in worker DO classes.
 *
 * @example
 * ```typescript
 * export class SchedulerObject extends DurableObject {
 *   async fetch(request: Request): Promise<Response> {
 *     const scheduler = new SchedulerDO(this, this.env);
 *     return scheduler.handleRequest(request);
 *   }
 *
 *   async alarm(): Promise<void> {
 *     const scheduler = new SchedulerDO(this, this.env);
 *     await scheduler.tick();
 *   }
 * }
 * ```
 */
export class SchedulerDO {
  ctx;
  env;
  state;
  config = DEFAULT_CONFIG;
  taskExecutorUrl;
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.state = createInitialSchedulerState();
    this.taskExecutorUrl = env.TASK_EXECUTOR_URL;
  }
  /**
   * Initialize the DO state (call once when DO is created)
   *
   * Loads persisted state from storage. Must be called before using the scheduler.
   */
  async initialize() {
    logger.info('[SchedulerDO] Initializing');
    try {
      const stored = await this.ctx.storage.get('state');
      this.state = stored ?? createInitialSchedulerState();
    } catch (error) {
      logger.error('[SchedulerDO] Failed to load state', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.state = createInitialSchedulerState();
    }
    // Schedule initial alarm
    await this.scheduleNextAlarm();
  }
  // ==========================================================================
  // Task Management API
  // ==========================================================================
  /**
   * Schedule a task for execution
   *
   * @param task - The task to schedule
   * @returns Task ID that was scheduled
   */
  async scheduleTask(task) {
    logger.info('[SchedulerDO] Scheduling task', {
      taskId: task.id,
      type: task.type,
      priority: task.priority,
      scheduledFor: new Date(task.scheduledFor).toISOString(),
    });
    // Check queue size limit
    if (this.state.taskQueue.length >= this.config.maxQueueSize) {
      logger.warn('[SchedulerDO] Queue at capacity', {
        size: this.state.taskQueue.length,
      });
      throw new Error('Task queue full');
    }
    // Add to queue (maintains sorted order by urgency)
    addTask(this.state.taskQueue, task, Date.now());
    // Update state
    this.state.updatedAt = Date.now();
    await this.persistState();
    // Schedule next alarm
    await this.scheduleNextAlarm();
    logger.info('[SchedulerDO] Task scheduled', {
      taskId: task.id,
      queueSize: this.state.taskQueue.length,
    });
    return task.id;
  }
  /**
   * Cancel a scheduled task
   *
   * @param taskId - The task ID to cancel
   * @returns true if task was removed, false if not found
   */
  async cancelTask(taskId) {
    const removed = removeTask(this.state.taskQueue, taskId);
    if (removed) {
      this.state.updatedAt = Date.now();
      await this.persistState();
      logger.info('[SchedulerDO] Task cancelled', {
        taskId,
        queueSize: this.state.taskQueue.length,
      });
      await this.scheduleNextAlarm();
    }
    return removed;
  }
  /**
   * Get task queue status
   *
   * @returns Current queue information
   */
  getQueueStatus() {
    const readyTasks = getReadyTasks(this.state.taskQueue, Date.now());
    const nextTaskDueAt = this.state.taskQueue[0]?.scheduledFor;
    return {
      queueSize: this.state.taskQueue.length,
      ...(nextTaskDueAt !== undefined && { nextTaskDueAt }),
      energyPercent: this.getEnergyPercentage(),
      readyCount: readyTasks.length,
    };
  }
  // ==========================================================================
  // Core Scheduling Logic
  // ==========================================================================
  /**
   * Main scheduler tick
   *
   * Called by alarm handler. Decides whether to wake up and execute ready tasks.
   * Handles energy budget decisions and quiet hour logic.
   */
  async tick() {
    const now = Date.now();
    logger.info('[SchedulerDO][TICK] Starting', {
      queueSize: this.state.taskQueue.length,
      energyPercent: this.getEnergyPercentage(),
    });
    try {
      // 1. Regenerate energy based on elapsed time
      regenerateEnergy(this.state.energy, now);
      // 2. Clean up stale tasks (older than 24 hours)
      const cleanupResult = cleanupStaleTasks(this.state.taskQueue, this.config.maxTaskAge, now);
      if (cleanupResult.removedCount > 0) {
        logger.info('[SchedulerDO] Cleaned up stale tasks', {
          removedCount: cleanupResult.removedCount,
        });
      }
      // 3. Get ready tasks
      const readyTasks = getReadyTasks(this.state.taskQueue, now);
      // 4. Decide whether to wake up and execute
      const decision = this.shouldWakeUp(now, readyTasks);
      logger.info('[SchedulerDO][TICK] Wake-up decision', {
        shouldWakeUp: decision.shouldWakeUp,
        reason: decision.reason,
        readyCount: decision.readyTasksCount,
      });
      if (decision.shouldWakeUp && readyTasks.length > 0) {
        await this.processReadyTasks(readyTasks, now);
      }
      // 5. Update state and schedule next alarm
      this.state.updatedAt = now;
      await this.persistState();
      await this.scheduleNextAlarm();
    } catch (error) {
      logger.error('[SchedulerDO][TICK] Error during tick', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Reschedule even on error
      await this.scheduleNextAlarm();
    }
  }
  /**
   * Decide whether to wake up and execute tasks
   *
   * Implements the wake-up algorithm considering:
   * - Critical tasks (always execute)
   * - Energy budget (must have minimum energy)
   * - Activity patterns (quiet hours good for background work)
   * - Priority levels (high priority + enough energy = execute)
   *
   * Algorithm (from design spec):
   * 1. If any critical task (priority >= 90): always wake up
   * 2. If energy < MIN_THRESHOLD: stay asleep
   * 3. If quiet hour + energy > 80%: good time for background work
   * 4. If top task priority > 70 + can afford: execute
   * 5. If top task priority > 40 + quiet hour + can afford: execute
   * 6. Otherwise: stay asleep
   *
   * @param now - Current timestamp
   * @param readyTasks - Tasks ready to execute (sorted by urgency)
   * @returns Wake-up decision and reasoning
   */
  shouldWakeUp(now, readyTasks) {
    const energyPercent = this.getEnergyPercentage();
    const isQuietHour = this.isQuietHour(now);
    // Check for critical tasks
    const criticalTask = readyTasks.find(
      (t) => t.priority >= this.config.criticalPriorityThreshold
    );
    if (criticalTask) {
      return {
        shouldWakeUp: true,
        reason: `Critical task (priority ${criticalTask.priority})`,
        readyTasksCount: readyTasks.length,
        energyPercent,
      };
    }
    // Check energy threshold
    if (energyPercent < this.config.minEnergyThreshold) {
      return {
        shouldWakeUp: false,
        reason: `Energy too low (${energyPercent.toFixed(1)}% < ${this.config.minEnergyThreshold}%)`,
        readyTasksCount: readyTasks.length,
        energyPercent,
      };
    }
    // No tasks ready - nothing to do
    if (readyTasks.length === 0) {
      return {
        shouldWakeUp: false,
        reason: 'No ready tasks',
        readyTasksCount: 0,
        energyPercent,
      };
    }
    const topTask = readyTasks[0];
    // Quiet hours: good for background work if energy is high
    if (isQuietHour && energyPercent > 80) {
      if (canAffordTask(this.state.energy, topTask, this.config.minEnergyThreshold)) {
        return {
          shouldWakeUp: true,
          reason: `Quiet hour + high energy (${energyPercent.toFixed(1)}%)`,
          readyTasksCount: readyTasks.length,
          energyPercent,
        };
      }
    }
    // High priority + can afford
    if (topTask.priority > 70) {
      if (canAffordTask(this.state.energy, topTask, this.config.minEnergyThreshold)) {
        return {
          shouldWakeUp: true,
          reason: `High priority (${topTask.priority}) + energy available`,
          readyTasksCount: readyTasks.length,
          energyPercent,
        };
      }
    }
    // Medium priority in quiet hours + can afford
    if (topTask.priority > 40 && isQuietHour) {
      if (canAffordTask(this.state.energy, topTask, this.config.minEnergyThreshold)) {
        return {
          shouldWakeUp: true,
          reason: `Medium priority (${topTask.priority}) in quiet hour`,
          readyTasksCount: readyTasks.length,
          energyPercent,
        };
      }
    }
    return {
      shouldWakeUp: false,
      reason: `Task priority (${topTask.priority}) too low and/or insufficient energy`,
      readyTasksCount: readyTasks.length,
      energyPercent,
    };
  }
  /**
   * Process ready tasks by executing them
   *
   * Executes tasks until energy budget is exhausted or no more can be afforded.
   * Sends tasks to the task executor via callback.
   *
   * @param readyTasks - Tasks sorted by urgency (highest first)
   * @param now - Current timestamp
   */
  async processReadyTasks(readyTasks, now) {
    let executedCount = 0;
    for (const task of readyTasks) {
      // Check if we can still afford this task
      if (!canAffordTask(this.state.energy, task, this.config.minEnergyThreshold)) {
        logger.info('[SchedulerDO] Out of energy, stopping execution', {
          executedCount,
          skipped: readyTasks.length - executedCount,
        });
        break;
      }
      try {
        // Execute task
        await this.executeTask(task, now);
        // Deduct energy (use estimated cost)
        deductEnergy(this.state.energy, task);
        // Remove from queue
        removeTask(this.state.taskQueue, task.id);
        executedCount++;
        // Add execution record for learning
        this.state.executionHistory.push({
          taskId: task.id,
          taskType: task.type,
          executedAt: now,
          success: true,
        });
        logger.info('[SchedulerDO] Task executed', {
          taskId: task.id,
          type: task.type,
          executedCount,
        });
      } catch (error) {
        logger.error('[SchedulerDO] Task execution failed', {
          taskId: task.id,
          error: error instanceof Error ? error.message : String(error),
        });
        // Record failure
        this.state.executionHistory.push({
          taskId: task.id,
          taskType: task.type,
          executedAt: now,
          success: false,
        });
        // Don't remove on error - will be retried next cycle
        // Could implement exponential backoff here
      }
    }
    logger.info('[SchedulerDO] Execution batch complete', {
      executedCount,
      remainingInQueue: this.state.taskQueue.length,
    });
  }
  /**
   * Execute a single task
   *
   * Sends the task to the task executor (could be a worker, MCP server, etc.)
   * Currently sends HTTP request to configured executor endpoint.
   *
   * @param task - The task to execute
   * @param now - Current timestamp
   */
  async executeTask(task, now) {
    // For now, just log execution
    // In production, would send to task executor service
    logger.info('[SchedulerDO] Executing task', {
      taskId: task.id,
      type: task.type,
      priority: task.priority,
    });
    // If executor URL configured, send callback
    if (this.taskExecutorUrl) {
      try {
        const response = await fetch(this.taskExecutorUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.env.TASK_EXECUTOR_TOKEN && {
              Authorization: `Bearer ${this.env.TASK_EXECUTOR_TOKEN}`,
            }),
          },
          body: JSON.stringify({
            taskId: task.id,
            type: task.type,
            payload: task.payload,
            executedAt: now,
          }),
        });
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Executor returned ${response.status}: ${error}`);
        }
      } catch (error) {
        logger.error('[SchedulerDO] Failed to send task to executor', {
          taskId: task.id,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
  }
  // ==========================================================================
  // Helper Methods
  // ==========================================================================
  /**
   * Schedule the next alarm
   *
   * Sets alarm for the soonest task, or 1 hour from now if queue is empty.
   */
  async scheduleNextAlarm() {
    const now = Date.now();
    const nextTask = this.state.taskQueue[0];
    // Determine alarm time
    let alarmTime;
    if (nextTask) {
      // Schedule for when next task is due, but check sooner
      // Check every 5 minutes if we have ready tasks
      const readyTasks = getReadyTasks(this.state.taskQueue, now);
      if (readyTasks.length > 0) {
        alarmTime = Math.min(nextTask.scheduledFor, now + 5 * 60 * 1000);
      } else {
        alarmTime = nextTask.scheduledFor;
      }
    } else {
      // No tasks - check again in 1 hour
      alarmTime = now + 60 * 60 * 1000;
    }
    // Don't schedule in the past
    alarmTime = Math.max(alarmTime, now + 1000);
    // Max 1 hour out (DO alarm limitation)
    const maxAlarmTime = now + 60 * 60 * 1000;
    alarmTime = Math.min(alarmTime, maxAlarmTime);
    try {
      await this.ctx.storage.setAlarm(alarmTime);
      logger.info('[SchedulerDO] Alarm scheduled', {
        alarmTime: new Date(alarmTime).toISOString(),
        delayMs: alarmTime - now,
        queueSize: this.state.taskQueue.length,
      });
    } catch (error) {
      logger.error('[SchedulerDO] Failed to schedule alarm', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  /**
   * Check if current hour is a quiet hour
   *
   * Used by wake-up algorithm to decide if it's good time for background work.
   *
   * @param now - Current timestamp
   * @returns true if current hour is in quietHours
   */
  isQuietHour(now) {
    const hour = new Date(now).getHours();
    return this.state.activityPatterns.quietHours.includes(hour);
  }
  /**
   * Get current energy percentage
   *
   * @returns Energy 0-100
   */
  getEnergyPercentage() {
    // Regenerate first for accurate reading
    regenerateEnergy(this.state.energy, Date.now());
    const tokenPercent =
      (this.state.energy.tokens.current / this.state.energy.tokens.maxPerHour) * 100;
    const computePercent =
      (this.state.energy.compute.currentMs / this.state.energy.compute.maxMsPerHour) * 100;
    // Return bottleneck (whichever is lower)
    return Math.min(tokenPercent, computePercent);
  }
  /**
   * Persist state to DO storage
   */
  async persistState() {
    try {
      await this.ctx.storage.put('state', this.state);
    } catch (error) {
      logger.error('[SchedulerDO] Failed to persist state', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
