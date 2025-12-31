/**
 * Heartbeat Module for Safety Kernel Integration
 *
 * This module provides heartbeat emission for the safety kernel's dead man's switch.
 * All bot workers should call emitHeartbeat() regularly to prove they're alive.
 *
 * The safety kernel reads these heartbeats from a shared KV namespace.
 * If no heartbeat is received within the threshold, recovery is triggered.
 *
 * OPTIMIZATION: Heartbeats are throttled to reduce KV write operations.
 * The free tier limit is 1000 writes/day, so we only write if the last
 * heartbeat was more than HEARTBEAT_MIN_INTERVAL_MS ago.
 */

/**
 * Minimum interval between heartbeat KV writes (in milliseconds)
 * This prevents rapid consecutive heartbeats from exhausting KV quota.
 * Default: 30 seconds
 */
export const HEARTBEAT_MIN_INTERVAL_MS = 30 * 1000;

/**
 * In-memory cache of last heartbeat timestamps per worker.
 * This is best-effort (resets on cold starts) but significantly
 * reduces redundant writes within a single worker instance.
 */
const lastHeartbeatTime: Map<string, number> = new Map();

/**
 * Heartbeat metadata type
 */
export interface HeartbeatMetadata {
  batchId?: string;
  sessionCount?: number;
  lastError?: string;
}

/**
 * Heartbeat data structure stored in KV
 */
export interface HeartbeatData {
  timestamp: number;
  workerName: string;
  metadata?: HeartbeatMetadata | undefined;
}

/**
 * KV keys for heartbeat storage
 * Must match the keys used by safety-kernel
 */
export const HEARTBEAT_KEYS = {
  TELEGRAM: 'heartbeat:telegram',
  GITHUB: 'heartbeat:github',
  SHARED_AGENTS: 'heartbeat:shared-agents',
} as const;

/**
 * KVNamespace type for Cloudflare Workers
 * Re-exported from @cloudflare/workers-types for environments that have it
 */
type KVNamespaceLike = {
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
  get: (key: string) => Promise<string | null>;
};

/**
 * Environment bindings that include heartbeat KV
 */
export interface HeartbeatEnv {
  /** KV namespace shared with safety-kernel for heartbeat */
  HEARTBEAT_KV?: KVNamespaceLike;
}

/**
 * Emit a heartbeat to the safety kernel KV
 *
 * This should be called:
 * 1. At the start of batch processing
 * 2. During the thinking rotation loop (every 5s)
 * 3. At the end of successful batch processing
 *
 * NOTE: Heartbeats are throttled to reduce KV write operations.
 * The free tier limit is 1000 writes/day, so we only write if the last
 * heartbeat was more than HEARTBEAT_MIN_INTERVAL_MS ago.
 *
 * @param env - Environment with HEARTBEAT_KV binding
 * @param workerName - Name of the worker ('duyetbot-telegram', 'duyetbot-github', 'duyetbot-shared-agents')
 * @param metadata - Optional metadata about current processing state
 * @param options - Additional options
 * @param options.force - Force write even if throttled (use sparingly)
 */
export async function emitHeartbeat(
  env: HeartbeatEnv,
  workerName: string,
  metadata?: HeartbeatMetadata,
  options?: { force?: boolean }
): Promise<void> {
  // If HEARTBEAT_KV is not configured, skip silently
  // This allows the bot to work without the safety kernel during development
  if (!env.HEARTBEAT_KV) {
    return;
  }

  const keyMap: Record<string, string> = {
    'duyetbot-telegram': HEARTBEAT_KEYS.TELEGRAM,
    'duyetbot-github': HEARTBEAT_KEYS.GITHUB,
    'duyetbot-shared-agents': HEARTBEAT_KEYS.SHARED_AGENTS,
  };

  const heartbeatKey = keyMap[workerName];
  if (!heartbeatKey) {
    console.warn(`[HEARTBEAT] Unknown worker name: ${workerName}`);
    return;
  }

  // Throttling: skip write if we've written recently (unless forced)
  const now = Date.now();
  const lastWrite = lastHeartbeatTime.get(workerName);
  if (!options?.force && lastWrite && now - lastWrite < HEARTBEAT_MIN_INTERVAL_MS) {
    // Skip this heartbeat to conserve KV quota
    return;
  }

  const heartbeat: HeartbeatData = {
    timestamp: now,
    workerName,
    metadata,
  };

  try {
    await env.HEARTBEAT_KV.put(heartbeatKey, JSON.stringify(heartbeat), {
      expirationTtl: 3600, // 1 hour - cleanup old heartbeats
    });
    // Update last write time on success
    lastHeartbeatTime.set(workerName, now);
  } catch (error) {
    // Heartbeat failure should not block main operation
    // Log but don't throw
    console.error('[HEARTBEAT] Failed to emit heartbeat:', error);
  }
}

/**
 * Emit heartbeat via HTTP POST to safety kernel (alternative method)
 *
 * Use this if KV binding is not available (e.g., from container workers)
 *
 * @param safetyKernelUrl - URL of the safety kernel (e.g., 'https://duyetbot-safety-kernel.duyet.workers.dev')
 * @param workerName - Name of the worker
 * @param metadata - Optional metadata
 */
export async function emitHeartbeatHttp(
  safetyKernelUrl: string,
  workerName: string,
  metadata?: HeartbeatMetadata
): Promise<void> {
  try {
    const response = await fetch(`${safetyKernelUrl}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ workerName, metadata }),
    });

    if (!response.ok) {
      console.warn(`[HEARTBEAT] HTTP heartbeat failed: ${response.status}`);
    }
  } catch (error) {
    // Heartbeat failure should not block main operation
    console.error('[HEARTBEAT] HTTP heartbeat failed:', error);
  }
}

/**
 * Create a heartbeat emitter function bound to specific env and worker
 *
 * This is useful for creating a reusable heartbeat function in agent classes.
 * NOTE: Heartbeats are throttled to reduce KV writes (see HEARTBEAT_MIN_INTERVAL_MS).
 *
 * @param env - Environment with HEARTBEAT_KV binding
 * @param workerName - Name of the worker
 * @returns Function that emits heartbeat with optional metadata and options
 *
 * @example
 * ```typescript
 * const heartbeat = createHeartbeatEmitter(env, 'duyetbot-telegram');
 *
 * // In processing loop (throttled automatically):
 * await heartbeat({ batchId: batch.batchId, sessionCount: 5 });
 *
 * // Force write (use sparingly):
 * await heartbeat({ batchId: batch.batchId }, { force: true });
 * ```
 */
export function createHeartbeatEmitter(
  env: HeartbeatEnv,
  workerName: string
): (metadata?: HeartbeatMetadata, options?: { force?: boolean }) => Promise<void> {
  return (metadata?: HeartbeatMetadata, options?: { force?: boolean }) =>
    emitHeartbeat(env, workerName, metadata, options);
}
