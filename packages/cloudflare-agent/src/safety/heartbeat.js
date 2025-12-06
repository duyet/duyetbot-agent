/**
 * Heartbeat Module for Safety Kernel Integration
 *
 * This module provides heartbeat emission for the safety kernel's dead man's switch.
 * All bot workers should call emitHeartbeat() regularly to prove they're alive.
 *
 * The safety kernel reads these heartbeats from a shared KV namespace.
 * If no heartbeat is received within the threshold, recovery is triggered.
 */
/**
 * KV keys for heartbeat storage
 * Must match the keys used by safety-kernel
 */
export const HEARTBEAT_KEYS = {
  TELEGRAM: 'heartbeat:telegram',
  GITHUB: 'heartbeat:github',
  SHARED_AGENTS: 'heartbeat:shared-agents',
};
/**
 * Emit a heartbeat to the safety kernel KV
 *
 * This should be called:
 * 1. At the start of batch processing
 * 2. During the thinking rotation loop (every 5s)
 * 3. At the end of successful batch processing
 *
 * @param env - Environment with HEARTBEAT_KV binding
 * @param workerName - Name of the worker ('duyetbot-telegram', 'duyetbot-github', 'duyetbot-shared-agents')
 * @param metadata - Optional metadata about current processing state
 */
export async function emitHeartbeat(env, workerName, metadata) {
  // If HEARTBEAT_KV is not configured, skip silently
  // This allows the bot to work without the safety kernel during development
  if (!env.HEARTBEAT_KV) {
    return;
  }
  const keyMap = {
    'duyetbot-telegram': HEARTBEAT_KEYS.TELEGRAM,
    'duyetbot-github': HEARTBEAT_KEYS.GITHUB,
    'duyetbot-shared-agents': HEARTBEAT_KEYS.SHARED_AGENTS,
  };
  const heartbeatKey = keyMap[workerName];
  if (!heartbeatKey) {
    console.warn(`[HEARTBEAT] Unknown worker name: ${workerName}`);
    return;
  }
  const heartbeat = {
    timestamp: Date.now(),
    workerName,
    metadata,
  };
  try {
    await env.HEARTBEAT_KV.put(heartbeatKey, JSON.stringify(heartbeat), {
      expirationTtl: 3600, // 1 hour - cleanup old heartbeats
    });
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
export async function emitHeartbeatHttp(safetyKernelUrl, workerName, metadata) {
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
 * This is useful for creating a reusable heartbeat function in agent classes
 *
 * @param env - Environment with HEARTBEAT_KV binding
 * @param workerName - Name of the worker
 * @returns Function that emits heartbeat with optional metadata
 *
 * @example
 * ```typescript
 * const heartbeat = createHeartbeatEmitter(env, 'duyetbot-telegram');
 *
 * // In processing loop:
 * await heartbeat({ batchId: batch.batchId, sessionCount: 5 });
 * ```
 */
export function createHeartbeatEmitter(env, workerName) {
  return (metadata) => emitHeartbeat(env, workerName, metadata);
}
