/**
 * Dead Man's Switch Module
 *
 * Monitors heartbeat from main bot workers.
 * If no heartbeat is received within threshold, triggers emergency recovery.
 *
 * This is the "biological" safety mechanism - if the bot goes silent,
 * something is seriously wrong and we need to recover.
 */

import { sendAlert } from './notifications';
import { restartWorker, triggerRollback } from './rollback';
import type { DeploymentData, Env, HeartbeatData } from './types';
import { KV_KEYS, MONITORED_WORKERS, ROLLBACK_CONDITIONS } from './types';

/**
 * Check heartbeat for a single worker
 */
async function checkWorkerHeartbeat(
  env: Env,
  heartbeatKey: string,
  thresholdMs: number
): Promise<{
  alive: boolean;
  lastHeartbeat?: HeartbeatData;
  silenceMs?: number;
}> {
  try {
    const data = await env.HEARTBEAT_KV.get(heartbeatKey, 'json');

    if (!data) {
      // No heartbeat ever recorded - might be first run
      return { alive: true }; // Assume alive if never recorded
    }

    const heartbeat = data as HeartbeatData;
    const silenceMs = Date.now() - heartbeat.timestamp;

    return {
      alive: silenceMs < thresholdMs,
      lastHeartbeat: heartbeat,
      silenceMs,
    };
  } catch {
    // Error reading KV - assume alive to avoid false positives
    return { alive: true };
  }
}

/**
 * Run dead man's switch check on all workers
 */
export async function runDeadMansSwitch(env: Env): Promise<{
  allAlive: boolean;
  results: Array<{
    workerName: string;
    alive: boolean;
    silenceMs?: number;
  }>;
}> {
  const thresholdMs =
    Number(env.HEARTBEAT_THRESHOLD_MS) || ROLLBACK_CONDITIONS.heartbeatMissing.thresholdMs;

  const results: Array<{
    workerName: string;
    alive: boolean;
    silenceMs?: number;
  }> = [];

  for (const target of MONITORED_WORKERS) {
    const { alive, lastHeartbeat, silenceMs } = await checkWorkerHeartbeat(
      env,
      target.heartbeatKey,
      thresholdMs
    );

    results.push({
      workerName: target.name,
      alive,
      silenceMs,
    });

    if (!alive && lastHeartbeat) {
      console.log(
        `[DEAD MAN'S SWITCH] Worker ${target.name} silent for ${silenceMs}ms (threshold: ${thresholdMs}ms)`
      );

      // Get deployment data to check if we should rollback or just restart
      const deploymentData = await env.HEARTBEAT_KV.get(target.deploymentKey, 'json');
      const deployment = deploymentData as DeploymentData | null;

      // If deployed within last hour, trigger rollback
      // Otherwise, just restart (might be transient issue)
      const deployedWithinHour = deployment && Date.now() - deployment.deployedAt < 3600000;

      if (deployedWithinHour && deployment) {
        await triggerRollback(env, {
          workerName: target.name,
          reason: `Dead man's switch: No heartbeat for ${Math.round(silenceMs! / 1000)}s`,
          deployment,
        });

        await sendAlert(env, {
          type: 'rollback_triggered',
          workerName: target.name,
          reason: `No heartbeat for ${Math.round(silenceMs! / 1000)} seconds after recent deployment`,
          deployment,
        });
      } else {
        // Just try to restart
        await restartWorker(env, target.name);

        await sendAlert(env, {
          type: 'worker_restarted',
          workerName: target.name,
          reason: `No heartbeat for ${Math.round(silenceMs! / 1000)} seconds`,
        });
      }
    }
  }

  return {
    allAlive: results.every((r) => r.alive),
    results,
  };
}

/**
 * Record a heartbeat from a worker (called by the worker itself)
 * This is the function the main bot workers call to prove they're alive
 */
export async function recordHeartbeat(
  env: Env,
  workerName: string,
  metadata?: HeartbeatData['metadata']
): Promise<void> {
  // Map worker name to heartbeat key
  const keyMap: Record<string, string> = {
    'duyetbot-telegram': KV_KEYS.HEARTBEAT_TELEGRAM,
    'duyetbot-github': KV_KEYS.HEARTBEAT_GITHUB,
    'duyetbot-agents': KV_KEYS.HEARTBEAT_SHARED,
  };

  const heartbeatKey = keyMap[workerName];
  if (!heartbeatKey) {
    console.error(`[HEARTBEAT] Unknown worker: ${workerName}`);
    return;
  }

  const heartbeat: HeartbeatData = {
    timestamp: Date.now(),
    workerName,
    metadata,
  };

  await env.HEARTBEAT_KV.put(heartbeatKey, JSON.stringify(heartbeat), {
    expirationTtl: 3600, // 1 hour - cleanup old heartbeats
  });
}

/**
 * Record a deployment (called when a worker is deployed)
 */
export async function recordDeployment(
  env: Env,
  workerName: string,
  version: string,
  previousVersion?: string
): Promise<void> {
  const keyMap: Record<string, string> = {
    'duyetbot-telegram': KV_KEYS.DEPLOYMENT_TELEGRAM,
    'duyetbot-github': KV_KEYS.DEPLOYMENT_GITHUB,
    'duyetbot-agents': KV_KEYS.DEPLOYMENT_SHARED,
  };

  const deploymentKey = keyMap[workerName];
  if (!deploymentKey) {
    console.error(`[DEPLOYMENT] Unknown worker: ${workerName}`);
    return;
  }

  const deployment: DeploymentData = {
    deployedAt: Date.now(),
    version,
    workerName,
    previousVersion,
  };

  await env.HEARTBEAT_KV.put(deploymentKey, JSON.stringify(deployment), {
    expirationTtl: 86400 * 7, // Keep for 7 days
  });
}

/**
 * Get heartbeat status for all workers
 */
export async function getHeartbeatStatus(env: Env): Promise<
  Array<{
    workerName: string;
    lastHeartbeat?: HeartbeatData;
    silenceMs?: number;
    status: 'alive' | 'warning' | 'dead';
  }>
> {
  const thresholdMs =
    Number(env.HEARTBEAT_THRESHOLD_MS) || ROLLBACK_CONDITIONS.heartbeatMissing.thresholdMs;

  const warningThreshold = thresholdMs / 2; // Warning at 50% of threshold

  const results = [];

  for (const target of MONITORED_WORKERS) {
    const data = await env.HEARTBEAT_KV.get(target.heartbeatKey, 'json');
    const heartbeat = data as HeartbeatData | null;

    if (!heartbeat) {
      results.push({
        workerName: target.name,
        status: 'alive' as const, // No heartbeat recorded = first run
      });
      continue;
    }

    const silenceMs = Date.now() - heartbeat.timestamp;
    let status: 'alive' | 'warning' | 'dead';

    if (silenceMs >= thresholdMs) {
      status = 'dead';
    } else if (silenceMs >= warningThreshold) {
      status = 'warning';
    } else {
      status = 'alive';
    }

    results.push({
      workerName: target.name,
      lastHeartbeat: heartbeat,
      silenceMs,
      status,
    });
  }

  return results;
}
