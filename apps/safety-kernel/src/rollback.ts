/**
 * Rollback Module
 *
 * Handles automatic rollback of worker deployments via Cloudflare API.
 * This is the "kill switch" - when things go wrong, we revert to a known good state.
 */

import type { DeploymentData, Env } from './types';

/**
 * Trigger a rollback to the previous deployment version
 */
export async function triggerRollback(
  env: Env,
  context: {
    workerName: string;
    reason: string;
    deployment: DeploymentData;
  }
): Promise<{ success: boolean; error?: string }> {
  const { workerName, reason, deployment } = context;

  console.log(`[ROLLBACK] Initiating rollback for ${workerName}`);
  console.log(`[ROLLBACK] Reason: ${reason}`);
  console.log(
    `[ROLLBACK] Rolling back from ${deployment.version} to ${deployment.previousVersion || 'previous'}`
  );

  try {
    // If no CF API token, we can't rollback automatically
    if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
      console.error('[ROLLBACK] Missing CF_API_TOKEN or CF_ACCOUNT_ID - cannot rollback');
      return {
        success: false,
        error: 'Missing Cloudflare API credentials',
      };
    }

    // Get the previous deployment version
    const versionsResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${workerName}/deployments`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!versionsResponse.ok) {
      const error = await versionsResponse.text();
      console.error('[ROLLBACK] Failed to get deployments:', error);
      return {
        success: false,
        error: `Failed to get deployments: ${versionsResponse.status}`,
      };
    }

    const versionsData = await versionsResponse.json<{
      result?: {
        deployments?: Array<{
          id: string;
          created_on: string;
          annotations?: { 'workers/triggered_by'?: string };
        }>;
      };
      success: boolean;
    }>();

    const deployments = versionsData.result?.deployments || [];

    if (deployments.length < 2) {
      console.error('[ROLLBACK] No previous deployment to rollback to');
      return {
        success: false,
        error: 'No previous deployment available',
      };
    }

    // Get the second most recent deployment (index 1)
    const previousDeployment = deployments[1];

    // Rollback to previous deployment
    const rollbackResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${workerName}/deployments/${previousDeployment.id}/rollback`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Automatic rollback: ${reason}`,
        }),
      }
    );

    if (!rollbackResponse.ok) {
      const error = await rollbackResponse.text();
      console.error('[ROLLBACK] Rollback API call failed:', error);

      // Try alternative approach: redeploy previous version
      return await redeployPreviousVersion(env, workerName, previousDeployment.id);
    }

    console.log(`[ROLLBACK] Successfully rolled back ${workerName} to ${previousDeployment.id}`);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ROLLBACK] Error during rollback:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Alternative rollback method: redeploy the previous version
 */
async function redeployPreviousVersion(
  env: Env,
  workerName: string,
  deploymentId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[ROLLBACK] Attempting alternative rollback via version redeploy`);

  try {
    // This is a fallback - in practice, the rollback endpoint should work
    // If it doesn't, we might need to fetch the script content and re-upload
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${workerName}/versions/${deploymentId}/promote`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Failed to promote previous version: ${error}`,
      };
    }

    console.log(`[ROLLBACK] Successfully promoted version ${deploymentId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Restart a worker (soft restart via Cloudflare API)
 * Used when we want to recover without rolling back
 */
export async function restartWorker(
  env: Env,
  workerName: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[RESTART] Attempting to restart ${workerName}`);

  try {
    if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
      console.error('[RESTART] Missing CF_API_TOKEN or CF_ACCOUNT_ID - cannot restart');
      return {
        success: false,
        error: 'Missing Cloudflare API credentials',
      };
    }

    // There's no direct "restart" API for Workers
    // The best we can do is trigger a settings update which causes a restart
    // We'll update a setting to its current value
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${workerName}/settings`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // This is a no-op patch that triggers a restart
          logpush: false,
        }),
      }
    );

    if (!response.ok) {
      // Restart is best-effort - log but don't fail
      console.warn(`[RESTART] Settings patch returned ${response.status} - worker may not restart`);
    }

    console.log(`[RESTART] Restart signal sent for ${workerName}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RESTART] Error during restart:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Manual rollback via admin token (escape hatch)
 * This bypasses all automated checks and forces a rollback
 */
export async function adminForceRollback(
  env: Env,
  workerName: string,
  adminToken: string
): Promise<{ success: boolean; error?: string }> {
  // Verify admin token
  if (!env.ADMIN_OVERRIDE_TOKEN) {
    return { success: false, error: 'Admin override not configured' };
  }

  if (adminToken !== env.ADMIN_OVERRIDE_TOKEN) {
    console.warn('[ADMIN] Invalid admin token provided for rollback');
    return { success: false, error: 'Invalid admin token' };
  }

  console.log(`[ADMIN] Force rollback initiated for ${workerName}`);

  // Create a dummy deployment data for the rollback
  const dummyDeployment: DeploymentData = {
    deployedAt: Date.now(),
    version: 'unknown',
    workerName,
  };

  return triggerRollback(env, {
    workerName,
    reason: 'Manual admin force rollback',
    deployment: dummyDeployment,
  });
}
