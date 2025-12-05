/**
 * SchedulerObject - Durable Object wrapper for SchedulerDO
 *
 * This is the actual Cloudflare Durable Object that hosts the scheduler logic.
 * It delegates to the library SchedulerDO class and handles:
 * - HTTP API for scheduling tasks
 * - Alarm handling for wake-up cycles
 * - State persistence via DO storage
 *
 * Endpoints:
 * - POST /schedule - Schedule a new task
 * - DELETE /task/:id - Cancel a scheduled task
 * - GET /status - Get queue status
 * - POST /tick - Manually trigger a tick (for testing)
 */

import { DurableObject } from 'cloudflare:workers';
import type { ScheduledTask } from '@duyetbot/chat-agent';
import { SchedulerDO, type SchedulerDOEnv } from '@duyetbot/chat-agent';

/**
 * Environment bindings for SchedulerObject
 */
export interface SchedulerObjectEnv extends SchedulerDOEnv {
  /** AI binding for potential LLM-based task generation */
  AI?: Ai;
}

/**
 * SchedulerObject Durable Object
 *
 * Cloudflare DO wrapper that exposes the SchedulerDO functionality
 * via HTTP API and alarm-based scheduling.
 */
export class SchedulerObject extends DurableObject<SchedulerObjectEnv> {
  private scheduler: SchedulerDO | null = null;
  private initialized = false;

  /**
   * Get or create the scheduler instance
   */
  private async getScheduler(): Promise<SchedulerDO> {
    if (!this.scheduler) {
      // Create scheduler with DO context adapter
      this.scheduler = new SchedulerDO(
        {
          storage: {
            get: async <T>(key: string): Promise<T | undefined> => {
              return this.ctx.storage.get<T>(key);
            },
            put: async (key: string, value: unknown): Promise<void> => {
              await this.ctx.storage.put(key, value);
            },
            delete: async (key: string): Promise<void> => {
              await this.ctx.storage.delete(key);
            },
            setAlarm: async (alarmTime: number): Promise<void> => {
              await this.ctx.storage.setAlarm(alarmTime);
            },
            deleteAlarm: async (): Promise<void> => {
              await this.ctx.storage.deleteAlarm();
            },
            getAlarm: async (): Promise<number | null> => {
              return this.ctx.storage.getAlarm();
            },
          },
        },
        this.env
      );
    }

    // Initialize on first access
    if (!this.initialized) {
      await this.scheduler.initialize();
      this.initialized = true;
    }

    return this.scheduler;
  }

  /**
   * Handle HTTP requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      const scheduler = await this.getScheduler();

      // POST /schedule - Schedule a new task
      if (request.method === 'POST' && path === '/schedule') {
        const task = (await request.json()) as ScheduledTask;
        const taskId = await scheduler.scheduleTask(task);
        return Response.json({ success: true, taskId });
      }

      // DELETE /task/:id - Cancel a scheduled task
      if (request.method === 'DELETE' && path.startsWith('/task/')) {
        const taskId = path.slice('/task/'.length);
        const removed = await scheduler.cancelTask(taskId);
        return Response.json({ success: removed, taskId });
      }

      // GET /status - Get queue status
      if (request.method === 'GET' && path === '/status') {
        const status = scheduler.getQueueStatus();
        return Response.json(status);
      }

      // POST /tick - Manually trigger a tick (for testing)
      if (request.method === 'POST' && path === '/tick') {
        await scheduler.tick();
        return Response.json({ success: true, message: 'Tick executed' });
      }

      return Response.json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
      console.error('[SchedulerObject] Error handling request:', error);
      return Response.json(
        {
          error: error instanceof Error ? error.message : 'Internal error',
        },
        { status: 500 }
      );
    }
  }

  /**
   * Handle alarm - this is where the scheduler wakes up
   */
  async alarm(): Promise<void> {
    console.log('[SchedulerObject] Alarm triggered');
    try {
      const scheduler = await this.getScheduler();
      await scheduler.tick();
    } catch (error) {
      console.error('[SchedulerObject] Error in alarm handler:', error);
      // Re-schedule alarm even on error (resilience)
      await this.ctx.storage.setAlarm(Date.now() + 60 * 1000); // 1 minute
    }
  }
}
