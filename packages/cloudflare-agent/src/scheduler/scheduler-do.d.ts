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
import type { ScheduledTask } from './types.js';
/**
 * Environment bindings for SchedulerDO
 */
export interface SchedulerDOEnv {
  /** Telegram token for user notifications */
  TELEGRAM_BOT_TOKEN?: string;
  /** Admin chat ID for system messages */
  TELEGRAM_ADMIN_CHAT_ID?: string;
  /** Callback URL for executing ready tasks */
  TASK_EXECUTOR_URL?: string;
  /** Callback auth token */
  TASK_EXECUTOR_TOKEN?: string;
}
/**
 * Wake-up decision result
 */
export interface WakeUpDecision {
  shouldWakeUp: boolean;
  reason: string;
  readyTasksCount: number;
  energyPercent: number;
}
/**
 * Durable Object context interface
 *
 * Minimal interface for DO functionality (state persistence and alarms).
 * Allows this library to work with any DO runtime without direct dependency.
 */
export interface SchedulerDOContext {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
    setAlarm(alarmTime: number): Promise<void>;
    deleteAlarm(): Promise<void>;
    getAlarm(): Promise<number | null>;
  };
}
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
export declare class SchedulerDO {
  private ctx;
  private env;
  private state;
  private config;
  private taskExecutorUrl;
  constructor(ctx: SchedulerDOContext, env: SchedulerDOEnv);
  /**
   * Initialize the DO state (call once when DO is created)
   *
   * Loads persisted state from storage. Must be called before using the scheduler.
   */
  initialize(): Promise<void>;
  /**
   * Schedule a task for execution
   *
   * @param task - The task to schedule
   * @returns Task ID that was scheduled
   */
  scheduleTask(task: ScheduledTask): Promise<string>;
  /**
   * Cancel a scheduled task
   *
   * @param taskId - The task ID to cancel
   * @returns true if task was removed, false if not found
   */
  cancelTask(taskId: string): Promise<boolean>;
  /**
   * Get task queue status
   *
   * @returns Current queue information
   */
  getQueueStatus(): {
    queueSize: number;
    nextTaskDueAt?: number;
    energyPercent: number;
    readyCount: number;
  };
  /**
   * Main scheduler tick
   *
   * Called by alarm handler. Decides whether to wake up and execute ready tasks.
   * Handles energy budget decisions and quiet hour logic.
   */
  tick(): Promise<void>;
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
  private shouldWakeUp;
  /**
   * Process ready tasks by executing them
   *
   * Executes tasks until energy budget is exhausted or no more can be afforded.
   * Sends tasks to the task executor via callback.
   *
   * @param readyTasks - Tasks sorted by urgency (highest first)
   * @param now - Current timestamp
   */
  private processReadyTasks;
  /**
   * Execute a single task
   *
   * Sends the task to the task executor (could be a worker, MCP server, etc.)
   * Currently sends HTTP request to configured executor endpoint.
   *
   * @param task - The task to execute
   * @param now - Current timestamp
   */
  private executeTask;
  /**
   * Schedule the next alarm
   *
   * Sets alarm for the soonest task, or 1 hour from now if queue is empty.
   */
  private scheduleNextAlarm;
  /**
   * Check if current hour is a quiet hour
   *
   * Used by wake-up algorithm to decide if it's good time for background work.
   *
   * @param now - Current timestamp
   * @returns true if current hour is in quietHours
   */
  private isQuietHour;
  /**
   * Get current energy percentage
   *
   * @returns Energy 0-100
   */
  private getEnergyPercentage;
  /**
   * Persist state to DO storage
   */
  private persistState;
}
//# sourceMappingURL=scheduler-do.d.ts.map
