/**
 * Event Bridge Module
 *
 * Cross-agent communication system for the DuyetBot ecosystem.
 *
 * @module events
 *
 * @example
 * ```typescript
 * import { EventBridge, publishNotification, publishPREvent } from '@duyetbot/cloudflare-agent/events';
 *
 * // Initialize the bridge
 * const bridge = new EventBridge({
 *   db: env.OBSERVABILITY_DB,
 *   agentId: 'telegram-bot',
 * });
 * await bridge.initialize();
 *
 * // Publish events
 * await publishNotification(bridge, {
 *   title: 'PR Merged',
 *   message: 'PR #123 was merged successfully',
 *   level: 'success',
 * });
 *
 * // Subscribe to events
 * bridge.subscribe(['github', 'task'], async (event) => {
 *   console.log('Received:', event.type, event.payload);
 * });
 *
 * // Process pending events
 * await bridge.processPending();
 * ```
 */

export type { EventBridgeConfig, EventHandler } from './event-bridge.js';
// Core
export { EventBridge } from './event-bridge.js';
// Publishers
export {
  publishAgentEvent,
  publishApprovalRequest,
  publishApprovalResponse,
  publishHealthEvent,
  publishNotification,
  publishPREvent,
  publishScheduleEvent,
  publishTaskEvent,
} from './publishers.js';
// Types
export type {
  AgentEvent,
  ApprovalEventPayload,
  DeliveryStatus,
  EventBridgeStats,
  EventCategory,
  EventPriority,
  EventQueryOptions,
  EventSource,
  EventSubscription,
  GitHubPREventPayload,
  NotificationPayload,
  SystemHealthPayload,
  TaskEventPayload,
  TrackedEvent,
} from './types.js';
export { DEFAULT_TTL, PRIORITY_WEIGHTS } from './types.js';
