/**
 * Safety Kernel - Immutable Guardian for @duyetbot
 *
 * This worker is the "biological immune system" for the bot infrastructure.
 * It monitors health, detects failures, and can trigger automatic recovery.
 *
 * CRITICAL: Changes to this file should require manual approval.
 * The bot workers should NOT be able to modify this code.
 *
 * Features:
 * 1. Health Check Cron - Runs every minute, checks worker health endpoints
 * 2. Dead Man's Switch - Monitors heartbeats, triggers recovery if silent
 * 3. Automatic Rollback - Reverts bad deployments within rollback window
 * 4. Admin Escape Hatch - Manual override for emergency recovery
 */

import { Hono } from 'hono';
import {
  getHeartbeatStatus,
  recordDeployment,
  recordHeartbeat,
  runDeadMansSwitch,
} from './dead-mans-switch';
import { getHealthStats, runHealthChecks } from './health-check';
import { sendTestAlert } from './notifications';
import { adminForceRollback } from './rollback';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// =============================================================================
// HEALTH & STATUS ENDPOINTS
// =============================================================================

/**
 * Basic health check for the safety kernel itself
 */
app.get('/', (c) => {
  return c.json({
    status: 'healthy',
    service: 'duyetbot-safety-kernel',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Get detailed status of all monitored workers
 */
app.get('/status', async (c) => {
  const env = c.env;

  const [heartbeatStatus, healthStats] = await Promise.all([
    getHeartbeatStatus(env),
    getHealthStats(env),
  ]);

  return c.json({
    kernel: {
      status: 'healthy',
      uptime: 'N/A', // Workers don't have persistent uptime
    },
    workers: heartbeatStatus,
    healthChecks: healthStats,
    timestamp: new Date().toISOString(),
  });
});

// =============================================================================
// HEARTBEAT API (called by bot workers)
// =============================================================================

/**
 * Record a heartbeat from a worker
 * Bot workers call this to prove they're alive
 */
app.post('/heartbeat', async (c) => {
  try {
    const body = await c.req.json<{
      workerName: string;
      metadata?: {
        batchId?: string;
        sessionCount?: number;
        lastError?: string;
      };
    }>();

    if (!body.workerName) {
      return c.json({ error: 'workerName required' }, 400);
    }

    await recordHeartbeat(c.env, body.workerName, body.metadata);

    return c.json({ success: true, timestamp: Date.now() });
  } catch (error) {
    console.error('[HEARTBEAT] Error recording heartbeat:', error);
    return c.json({ error: 'Failed to record heartbeat' }, 500);
  }
});

/**
 * Record a deployment event
 * Called by CI/CD when a worker is deployed
 */
app.post('/deployment', async (c) => {
  try {
    const body = await c.req.json<{
      workerName: string;
      version: string;
      previousVersion?: string;
    }>();

    if (!body.workerName || !body.version) {
      return c.json({ error: 'workerName and version required' }, 400);
    }

    await recordDeployment(c.env, body.workerName, body.version, body.previousVersion);

    return c.json({ success: true, timestamp: Date.now() });
  } catch (error) {
    console.error('[DEPLOYMENT] Error recording deployment:', error);
    return c.json({ error: 'Failed to record deployment' }, 500);
  }
});

// =============================================================================
// ADMIN ENDPOINTS (require admin token)
// =============================================================================

/**
 * Force rollback a worker (escape hatch)
 */
app.post('/admin/rollback', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return c.json({ error: 'Authorization required' }, 401);
  }

  try {
    const body = await c.req.json<{ workerName: string }>();

    if (!body.workerName) {
      return c.json({ error: 'workerName required' }, 400);
    }

    const result = await adminForceRollback(c.env, body.workerName, token);

    if (!result.success) {
      return c.json({ error: result.error }, result.error === 'Invalid admin token' ? 403 : 500);
    }

    return c.json({ success: true, message: `Rollback initiated for ${body.workerName}` });
  } catch (error) {
    console.error('[ADMIN] Error during force rollback:', error);
    return c.json({ error: 'Failed to process rollback' }, 500);
  }
});

/**
 * Test alert system
 */
app.post('/admin/test-alert', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token || token !== c.env.ADMIN_OVERRIDE_TOKEN) {
    return c.json({ error: 'Invalid admin token' }, 403);
  }

  const result = await sendTestAlert(c.env);

  if (!result.success) {
    return c.json({ error: result.error }, 500);
  }

  return c.json({ success: true, message: 'Test alert sent' });
});

/**
 * Trigger manual health check
 */
app.post('/admin/health-check', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token || token !== c.env.ADMIN_OVERRIDE_TOKEN) {
    return c.json({ error: 'Invalid admin token' }, 403);
  }

  const status = await runHealthChecks(c.env);

  return c.json({
    success: true,
    status,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Trigger manual dead man's switch check
 */
app.post('/admin/dead-mans-switch', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token || token !== c.env.ADMIN_OVERRIDE_TOKEN) {
    return c.json({ error: 'Invalid admin token' }, 403);
  }

  const result = await runDeadMansSwitch(c.env);

  return c.json({
    success: true,
    result,
    timestamp: new Date().toISOString(),
  });
});

// =============================================================================
// CRON HANDLER
// =============================================================================

export default {
  fetch: app.fetch,

  /**
   * Scheduled handler - runs every minute
   * Performs health checks and dead man's switch checks
   */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('[CRON] Safety kernel cron triggered');

    // Run health checks
    ctx.waitUntil(
      runHealthChecks(env).then((status) => {
        console.log(`[CRON] Health check complete: ${status.overall}`);
      })
    );

    // Run dead man's switch check
    ctx.waitUntil(
      runDeadMansSwitch(env).then((result) => {
        console.log(`[CRON] Dead man's switch check: ${result.allAlive ? 'all alive' : 'ALERT'}`);
      })
    );
  },
};
