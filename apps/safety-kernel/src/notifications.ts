/**
 * Notifications Module
 *
 * Sends alerts to admin via Telegram when safety events occur.
 * Also handles alert deduplication to avoid spam.
 */

import type { DeploymentData, Env } from './types';
import { KV_KEYS } from './types';

type AlertType =
  | 'health_check_failed'
  | 'rollback_triggered'
  | 'worker_restarted'
  | 'heartbeat_warning'
  | 'admin_action';

interface AlertContext {
  type: AlertType;
  workerName: string;
  reason: string;
  deployment?: DeploymentData;
}

interface AlertState {
  lastAlerts: Record<string, number>; // alertKey -> timestamp
}

/**
 * Generate a deduplication key for an alert
 */
function getAlertKey(context: AlertContext): string {
  return `${context.type}:${context.workerName}`;
}

/**
 * Check if we should send this alert (deduplication)
 */
async function shouldSendAlert(
  env: Env,
  context: AlertContext,
  cooldownMs: number = 300000 // 5 minutes default
): Promise<boolean> {
  try {
    const stateData = await env.HEARTBEAT_KV.get(KV_KEYS.ALERT_STATE, 'json');
    const state = (stateData as AlertState | null) || { lastAlerts: {} };

    const alertKey = getAlertKey(context);
    const lastSent = state.lastAlerts[alertKey] || 0;
    const timeSinceLast = Date.now() - lastSent;

    return timeSinceLast > cooldownMs;
  } catch {
    // Error reading state - send alert to be safe
    return true;
  }
}

/**
 * Record that we sent an alert
 */
async function recordAlertSent(env: Env, context: AlertContext): Promise<void> {
  try {
    const stateData = await env.HEARTBEAT_KV.get(KV_KEYS.ALERT_STATE, 'json');
    const state = (stateData as AlertState | null) || { lastAlerts: {} };

    const alertKey = getAlertKey(context);
    state.lastAlerts[alertKey] = Date.now();

    // Cleanup old entries (older than 1 hour)
    const oneHourAgo = Date.now() - 3600000;
    for (const [key, timestamp] of Object.entries(state.lastAlerts)) {
      if (timestamp < oneHourAgo) {
        delete state.lastAlerts[key];
      }
    }

    await env.HEARTBEAT_KV.put(KV_KEYS.ALERT_STATE, JSON.stringify(state), {
      expirationTtl: 3600, // 1 hour
    });
  } catch (error) {
    console.error('[ALERT] Failed to record alert state:', error);
  }
}

/**
 * Format alert message for Telegram
 */
function formatAlertMessage(context: AlertContext): string {
  const emoji = {
    health_check_failed: '🔴',
    rollback_triggered: '⚠️',
    worker_restarted: '🔄',
    heartbeat_warning: '⏰',
    admin_action: '👤',
  };

  const icon = emoji[context.type] || '📢';
  const timestamp = new Date().toISOString();

  let message = `${icon} *Safety Kernel Alert*\n\n`;
  message += `*Type:* ${context.type.replace(/_/g, ' ')}\n`;
  message += `*Worker:* \`${context.workerName}\`\n`;
  message += `*Reason:* ${escapeMarkdown(context.reason)}\n`;

  if (context.deployment) {
    message += `\n*Deployment Info:*\n`;
    message += `  Version: \`${context.deployment.version}\`\n`;
    message += `  Deployed: ${new Date(context.deployment.deployedAt).toISOString()}\n`;
    if (context.deployment.previousVersion) {
      message += `  Previous: \`${context.deployment.previousVersion}\`\n`;
    }
  }

  message += `\n_${timestamp}_`;

  return message;
}

/**
 * Escape special characters for Telegram MarkdownV2
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/**
 * Send alert to admin via Telegram
 */
export async function sendAlert(env: Env, context: AlertContext): Promise<void> {
  // Check deduplication
  const shouldSend = await shouldSendAlert(env, context);
  if (!shouldSend) {
    console.log(`[ALERT] Skipping duplicate alert: ${getAlertKey(context)}`);
    return;
  }

  // Check if Telegram is configured
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ADMIN_CHAT_ID) {
    console.log('[ALERT] Telegram not configured, logging alert only');
    console.log(`[ALERT] ${context.type}: ${context.workerName} - ${context.reason}`);
    await recordAlertSent(env, context);
    return;
  }

  const message = formatAlertMessage(context);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_ADMIN_CHAT_ID,
          text: message,
          parse_mode: 'MarkdownV2',
        }),
      }
    );

    if (response.ok) {
      console.log(`[ALERT] Sent alert to Telegram: ${context.type}`);
    } else {
      const error = await response.text();
      console.error('[ALERT] Failed to send Telegram alert:', error);
    }
  } catch (error) {
    console.error('[ALERT] Error sending Telegram alert:', error);
  }

  // Record that we sent this alert
  await recordAlertSent(env, context);
}

/**
 * Send a test alert (for verification)
 */
export async function sendTestAlert(env: Env): Promise<{ success: boolean; error?: string }> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ADMIN_CHAT_ID) {
    return { success: false, error: 'Telegram not configured' };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_ADMIN_CHAT_ID,
          text: '✅ *Safety Kernel Test Alert*\n\nThis is a test message from the safety kernel\\. If you see this, alerts are working correctly\\!',
          parse_mode: 'MarkdownV2',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
