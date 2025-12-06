/**
 * Safety Kernel Types
 *
 * These types define the interface between the safety kernel and the main bot.
 * The safety kernel is immutable - changes require manual approval.
 */

/**
 * Environment bindings for the safety kernel worker
 */
export interface Env {
  // KV namespace for heartbeat storage
  HEARTBEAT_KV: KVNamespace;

  // Configuration vars
  ENVIRONMENT: string;
  HEALTH_CHECK_TIMEOUT_MS: string;
  HEARTBEAT_THRESHOLD_MS: string;
  ROLLBACK_WINDOW_MS: string;

  // Secrets (set via wrangler secret put)
  ADMIN_OVERRIDE_TOKEN: string;
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ADMIN_CHAT_ID?: string;
}

/**
 * Health check result for a single target
 */
export interface HealthCheckResult {
  target: string;
  healthy: boolean;
  latencyMs: number;
  error?: string;
  timestamp: number;
}

/**
 * Aggregated health status
 */
export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  timestamp: number;
}

/**
 * Heartbeat data stored in KV
 */
export interface HeartbeatData {
  timestamp: number;
  workerName: string;
  metadata?: {
    batchId?: string;
    sessionCount?: number;
    lastError?: string;
  };
}

/**
 * Deployment metadata stored in KV
 */
export interface DeploymentData {
  deployedAt: number;
  version: string;
  workerName: string;
  previousVersion?: string;
}

/**
 * Rollback conditions - IMMUTABLE configuration
 * These conditions trigger automatic rollback
 */
export const ROLLBACK_CONDITIONS = {
  // Health check fails within 5 minutes of deployment
  healthCheckFailure: { windowMs: 5 * 60 * 1000 },
  // Error rate exceeds baseline by 3x
  errorRateSpike: { multiplier: 3 },
  // Latency P99 exceeds 10 seconds
  latencySpike: { p99Ms: 10000 },
  // No heartbeat for 10 minutes
  heartbeatMissing: { thresholdMs: 10 * 60 * 1000 },
} as const;

/**
 * KV keys used by safety kernel
 */
export const KV_KEYS = {
  // Heartbeat from main bot workers
  HEARTBEAT_TELEGRAM: 'heartbeat:telegram',
  HEARTBEAT_GITHUB: 'heartbeat:github',
  HEARTBEAT_SHARED: 'heartbeat:shared-agents',

  // Deployment tracking
  DEPLOYMENT_TELEGRAM: 'deployment:telegram',
  DEPLOYMENT_GITHUB: 'deployment:github',
  DEPLOYMENT_SHARED: 'deployment:shared-agents',

  // Health check history (for trend analysis)
  HEALTH_HISTORY: 'health:history',

  // Alert state (to avoid spam)
  ALERT_STATE: 'alert:state',
} as const;

/**
 * Targets to monitor
 */
export const MONITORED_WORKERS = [
  {
    name: 'duyetbot-telegram',
    healthEndpoint: 'https://duyetbot-telegram.duyet.workers.dev/health',
    heartbeatKey: KV_KEYS.HEARTBEAT_TELEGRAM,
    deploymentKey: KV_KEYS.DEPLOYMENT_TELEGRAM,
  },
  {
    name: 'duyetbot-agents',
    healthEndpoint: 'https://duyetbot-agents.duyet.workers.dev/health',
    heartbeatKey: KV_KEYS.HEARTBEAT_SHARED,
    deploymentKey: KV_KEYS.DEPLOYMENT_SHARED,
  },
] as const;
