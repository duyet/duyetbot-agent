/**
 * Safety Module Exports
 *
 * Provides integration with the safety kernel for:
 * - Heartbeat emission (dead man's switch)
 * - Health reporting
 * - Deployment tracking
 */

export {
  createHeartbeatEmitter,
  emitHeartbeat,
  emitHeartbeatHttp,
  HEARTBEAT_KEYS,
  HEARTBEAT_MIN_INTERVAL_MS,
  type HeartbeatData,
  type HeartbeatEnv,
  type HeartbeatMetadata,
} from './heartbeat.js';
