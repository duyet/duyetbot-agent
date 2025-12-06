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
} from './heartbeat.js';
