/**
 * Health Check Module
 *
 * Performs health checks on monitored workers.
 * This runs every minute via cron trigger.
 */

import { sendAlert } from './notifications';
import { triggerRollback } from './rollback';
import type { DeploymentData, Env, HealthCheckResult, HealthStatus } from './types';
import { KV_KEYS, MONITORED_WORKERS } from './types';

/**
 * Check health of a single worker endpoint
 */
async function checkWorkerHealth(
  target: (typeof MONITORED_WORKERS)[number],
  timeoutMs: number
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(target.healthEndpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'duyetbot-safety-kernel/1.0',
      },
    });

    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        target: target.name,
        healthy: false,
        latencyMs,
        error: `HTTP ${response.status}: ${response.statusText}`,
        timestamp: Date.now(),
      };
    }

    // Parse response to verify it's actually healthy
    const body = await response.json<{ status?: string; healthy?: boolean }>();
    const isHealthy = body.status === 'healthy' || body.healthy === true;

    return {
      target: target.name,
      healthy: isHealthy,
      latencyMs,
      error: isHealthy ? undefined : 'Health endpoint returned unhealthy status',
      timestamp: Date.now(),
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      target: target.name,
      healthy: false,
      latencyMs,
      error: errorMessage,
      timestamp: Date.now(),
    };
  }
}

/**
 * Check if worker was recently deployed (within rollback window)
 */
async function wasRecentlyDeployed(
  env: Env,
  deploymentKey: string,
  windowMs: number
): Promise<{ recent: boolean; deployment?: DeploymentData }> {
  try {
    const data = await env.HEARTBEAT_KV.get(deploymentKey, 'json');
    if (!data) {
      return { recent: false };
    }

    const deployment = data as DeploymentData;
    const timeSinceDeploy = Date.now() - deployment.deployedAt;

    return {
      recent: timeSinceDeploy < windowMs,
      deployment,
    };
  } catch {
    return { recent: false };
  }
}

/**
 * Run health checks on all monitored workers
 */
export async function runHealthChecks(env: Env): Promise<HealthStatus> {
  const timeoutMs = Number(env.HEALTH_CHECK_TIMEOUT_MS) || 5000;
  const rollbackWindowMs = Number(env.ROLLBACK_WINDOW_MS) || 5 * 60 * 1000;

  // Check all workers in parallel
  const checkPromises = MONITORED_WORKERS.map((target) => checkWorkerHealth(target, timeoutMs));

  const results = await Promise.all(checkPromises);

  // Determine overall health
  const unhealthyCount = results.filter((r) => !r.healthy).length;
  const overall: HealthStatus['overall'] =
    unhealthyCount === 0 ? 'healthy' : unhealthyCount === results.length ? 'unhealthy' : 'degraded';

  const status: HealthStatus = {
    overall,
    checks: results,
    timestamp: Date.now(),
  };

  // Handle unhealthy workers
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const target = MONITORED_WORKERS[i];

    if (!result.healthy) {
      // Check if this worker was recently deployed
      const { recent, deployment } = await wasRecentlyDeployed(
        env,
        target.deploymentKey,
        rollbackWindowMs
      );

      if (recent && deployment) {
        // Recently deployed + unhealthy = trigger rollback
        console.log(
          `[SAFETY] Worker ${target.name} unhealthy after recent deployment, triggering rollback`
        );

        await triggerRollback(env, {
          workerName: target.name,
          reason: `Health check failed: ${result.error}`,
          deployment,
        });

        await sendAlert(env, {
          type: 'rollback_triggered',
          workerName: target.name,
          reason: result.error || 'Health check failed',
          deployment,
        });
      } else {
        // Not recent deployment, just send alert
        await sendAlert(env, {
          type: 'health_check_failed',
          workerName: target.name,
          reason: result.error || 'Health check failed',
        });
      }
    }
  }

  // Store health history for trend analysis
  await storeHealthHistory(env, status);

  return status;
}

/**
 * Store health check history (rolling window of last 12 checks = 1 hour at 5-min intervals)
 *
 * OPTIMIZATION: To reduce KV write operations (free tier limit: 1000/day),
 * we only store history every 5 minutes instead of every minute.
 * This reduces writes from ~1,440/day to ~288/day.
 */
async function storeHealthHistory(env: Env, status: HealthStatus): Promise<void> {
  try {
    const existing = await env.HEARTBEAT_KV.get(KV_KEYS.HEALTH_HISTORY, 'json');
    const history = (existing as HealthStatus[] | null) || [];

    // Only store if unhealthy OR every 5 minutes to reduce KV writes
    // (cron runs every minute, but we only persist every 5th check or on issues)
    const lastEntry = history[history.length - 1];
    const timeSinceLastStore = lastEntry ? status.timestamp - lastEntry.timestamp : Infinity;
    const STORE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

    const shouldStore = status.overall !== 'healthy' || timeSinceLastStore >= STORE_INTERVAL_MS;

    if (!shouldStore) {
      return; // Skip KV write to conserve quota
    }

    // Add current status
    history.push(status);

    // Keep only last 12 entries (1 hour at 5-minute intervals)
    while (history.length > 12) {
      history.shift();
    }

    await env.HEARTBEAT_KV.put(KV_KEYS.HEALTH_HISTORY, JSON.stringify(history), {
      expirationTtl: 3600, // 1 hour
    });
  } catch (error) {
    console.error('[SAFETY] Failed to store health history:', error);
  }
}

/**
 * Get health check statistics from history
 */
export async function getHealthStats(env: Env): Promise<{
  successRate: number;
  avgLatencyMs: number;
  checksInLastHour: number;
}> {
  try {
    const existing = await env.HEARTBEAT_KV.get(KV_KEYS.HEALTH_HISTORY, 'json');
    const history = (existing as HealthStatus[] | null) || [];

    if (history.length === 0) {
      return { successRate: 100, avgLatencyMs: 0, checksInLastHour: 0 };
    }

    let totalChecks = 0;
    let successfulChecks = 0;
    let totalLatency = 0;

    for (const status of history) {
      for (const check of status.checks) {
        totalChecks++;
        if (check.healthy) {
          successfulChecks++;
        }
        totalLatency += check.latencyMs;
      }
    }

    return {
      successRate: totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 100,
      avgLatencyMs: totalChecks > 0 ? totalLatency / totalChecks : 0,
      checksInLastHour: totalChecks,
    };
  } catch {
    return { successRate: 100, avgLatencyMs: 0, checksInLastHour: 0 };
  }
}
