/**
 * Event Publishers
 *
 * Helper functions for publishing common event types.
 *
 * @module events/publishers
 */

import type { EventBridge } from './event-bridge.js';
import type {
  AgentEvent,
  ApprovalEventPayload,
  EventSource,
  GitHubPREventPayload,
  NotificationPayload,
  SystemHealthPayload,
  TaskEventPayload,
} from './types.js';

/**
 * Publish a GitHub PR event.
 */
export async function publishPREvent(
  bridge: EventBridge,
  payload: GitHubPREventPayload,
  correlationId?: string
): Promise<AgentEvent> {
  return bridge.publish({
    category: 'github',
    type: `pr.${payload.action}`,
    priority: payload.action === 'merged' ? 'high' : 'normal',
    payload,
    targets: ['telegram-bot'], // Notify admin via Telegram
    ...(correlationId ? { correlationId } : {}),
  });
}

/**
 * Publish a task lifecycle event.
 */
export async function publishTaskEvent(
  bridge: EventBridge,
  payload: TaskEventPayload,
  correlationId?: string
): Promise<AgentEvent> {
  const priority =
    payload.status === 'failed' ? 'high' : payload.status === 'completed' ? 'normal' : 'low';

  return bridge.publish({
    category: 'task',
    type: `task.${payload.status}`,
    priority,
    payload,
    ...(correlationId ? { correlationId } : {}),
  });
}

/**
 * Publish an approval request event.
 */
export async function publishApprovalRequest(
  bridge: EventBridge,
  payload: ApprovalEventPayload,
  correlationId?: string
): Promise<AgentEvent> {
  return bridge.publish({
    category: 'approval',
    type: 'approval.requested',
    priority: 'high',
    payload,
    targets: ['telegram-bot'], // Approvals go to Telegram
    ttl: 86400, // 24 hours
    ...(correlationId ? { correlationId } : {}),
  });
}

/**
 * Publish an approval response event.
 */
export async function publishApprovalResponse(
  bridge: EventBridge,
  requestId: string,
  approved: boolean,
  approver: string,
  correlationId?: string
): Promise<AgentEvent> {
  return bridge.publish({
    category: 'approval',
    type: approved ? 'approval.approved' : 'approval.rejected',
    priority: 'high',
    payload: {
      requestId,
      approved,
      approver,
      respondedAt: Date.now(),
    },
    ...(correlationId ? { correlationId } : {}),
  });
}

/**
 * Publish a system health event.
 */
export async function publishHealthEvent(
  bridge: EventBridge,
  payload: SystemHealthPayload
): Promise<AgentEvent> {
  const priority =
    payload.status === 'unhealthy' ? 'critical' : payload.status === 'degraded' ? 'high' : 'low';

  return bridge.publish({
    category: 'system',
    type: `health.${payload.status}`,
    priority,
    payload,
    ttl: 3600, // 1 hour
  });
}

/**
 * Publish a notification event for Telegram delivery.
 */
export async function publishNotification(
  bridge: EventBridge,
  payload: NotificationPayload,
  priority: 'high' | 'normal' | 'low' = 'normal'
): Promise<AgentEvent> {
  return bridge.publish({
    category: 'notification',
    type: `notification.${payload.level}`,
    priority,
    payload,
    targets: ['telegram-bot'],
    ttl: 86400, // 24 hours
  });
}

/**
 * Publish an agent lifecycle event.
 */
export async function publishAgentEvent(
  bridge: EventBridge,
  agentId: EventSource,
  status: 'started' | 'stopped' | 'error' | 'recovered',
  message?: string,
  metadata?: Record<string, unknown>
): Promise<AgentEvent> {
  return bridge.publish({
    category: 'agent',
    type: `agent.${status}`,
    priority: status === 'error' ? 'high' : 'normal',
    payload: {
      agentId,
      status,
      timestamp: Date.now(),
      ...(message ? { message } : {}),
      ...metadata,
    },
    ttl: 3600, // 1 hour
  });
}

/**
 * Publish a scheduled task event.
 */
export async function publishScheduleEvent(
  bridge: EventBridge,
  taskId: string,
  action: 'scheduled' | 'triggered' | 'completed' | 'failed',
  payload: Record<string, unknown> = {}
): Promise<AgentEvent> {
  return bridge.publish({
    category: 'schedule',
    type: `schedule.${action}`,
    priority: action === 'failed' ? 'high' : 'normal',
    payload: {
      taskId,
      action,
      ...payload,
    },
    correlationId: taskId,
    ttl: 3600, // 1 hour
  });
}
