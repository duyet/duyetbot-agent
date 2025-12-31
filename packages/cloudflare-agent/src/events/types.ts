/**
 * Event Bridge Types
 *
 * Defines the event system for cross-agent communication in the DuyetBot ecosystem.
 * Events are persisted to D1 and can be subscribed to by any agent.
 *
 * @module events/types
 */

/**
 * Event priority levels for processing order.
 */
export type EventPriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * Event categories for filtering and routing.
 */
export type EventCategory =
  | 'system' // System-level events (health, errors, restarts)
  | 'agent' // Agent lifecycle events (start, stop, error)
  | 'task' // Task execution events (created, completed, failed)
  | 'github' // GitHub events (PR, issue, review)
  | 'notification' // User notifications
  | 'approval' // Human-in-the-loop approval requests
  | 'schedule'; // Scheduled task events

/**
 * Source agent that emitted the event.
 */
export type EventSource =
  | 'telegram-bot'
  | 'github-bot'
  | 'memory-mcp'
  | 'scheduler'
  | 'safety-kernel'
  | 'system';

/**
 * Event delivery status.
 */
export type DeliveryStatus = 'pending' | 'delivered' | 'acknowledged' | 'failed' | 'expired';

/**
 * Base event interface for the Event Bridge.
 */
export interface AgentEvent {
  /** Unique event ID (UUID) */
  id: string;

  /** Monotonically increasing sequence number for ordering */
  sequence?: number;

  /** Event category for routing */
  category: EventCategory;

  /** Event type within category (e.g., 'pr.opened', 'task.completed') */
  type: string;

  /** Source agent that emitted this event */
  source: EventSource;

  /** Event priority */
  priority: EventPriority;

  /** Timestamp when event was created */
  createdAt: number;

  /** Time-to-live in seconds (0 = never expires) */
  ttl: number;

  /** Event payload (JSON-serializable) */
  payload: Record<string, unknown> | object;

  /** Optional correlation ID for related events */
  correlationId?: string | undefined;

  /** Optional target agent(s) - if empty, broadcast to all */
  targets?: EventSource[] | undefined;
}

/**
 * Event with delivery tracking.
 */
export interface TrackedEvent extends AgentEvent {
  /** Delivery attempts */
  deliveryAttempts: number;

  /** Last delivery attempt timestamp */
  lastAttemptAt?: number;

  /** Delivery status per target */
  deliveryStatus: Record<EventSource, DeliveryStatus>;
}

/**
 * Event subscription configuration.
 */
export interface EventSubscription {
  /** Subscriber agent ID */
  subscriberId: EventSource;

  /** Categories to subscribe to (empty = all) */
  categories: EventCategory[];

  /** Event types to subscribe to (empty = all in category) */
  types: string[];

  /** Minimum priority to receive */
  minPriority: EventPriority;

  /** Last processed sequence number */
  lastSequence: number;

  /** Subscription creation timestamp */
  createdAt: number;
}

/**
 * Event query options for fetching events.
 */
export interface EventQueryOptions {
  /** Filter by categories */
  categories?: EventCategory[] | undefined;

  /** Filter by event types */
  types?: string[] | undefined;

  /** Filter by source agents */
  sources?: EventSource[] | undefined;

  /** Minimum priority */
  minPriority?: EventPriority | undefined;

  /** Only events after this sequence */
  afterSequence?: number | undefined;

  /** Only events after this timestamp */
  afterTimestamp?: number | undefined;

  /** Maximum events to return */
  limit?: number | undefined;

  /** Include expired events */
  includeExpired?: boolean | undefined;
}

/**
 * Event Bridge statistics.
 */
export interface EventBridgeStats {
  /** Total events in queue */
  totalEvents: number;

  /** Events by category */
  byCategory: Record<EventCategory, number>;

  /** Events by priority */
  byPriority: Record<EventPriority, number>;

  /** Active subscriptions */
  activeSubscriptions: number;

  /** Oldest unprocessed event timestamp */
  oldestEventAt?: number;

  /** Current sequence number */
  currentSequence: number;
}

// ============================================
// Pre-defined Event Types (Phase 1 Roadmap)
// ============================================

/**
 * GitHub PR event payload.
 */
export interface GitHubPREventPayload {
  action: 'opened' | 'closed' | 'merged' | 'review_requested' | 'approved' | 'changes_requested';
  repo: string;
  prNumber: number;
  title: string;
  author: string;
  url: string;
  additions?: number;
  deletions?: number;
  reviewers?: string[];
}

/**
 * Task completion event payload.
 */
export interface TaskEventPayload {
  taskId: string;
  taskType: string;
  status: 'created' | 'started' | 'completed' | 'failed' | 'cancelled';
  description: string;
  result?: string;
  error?: string;
  durationMs?: number;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
}

/**
 * Approval request event payload.
 */
export interface ApprovalEventPayload {
  requestId: string;
  action: string;
  description: string;
  requiredApprovers: string[];
  expiresAt: number;
  context: Record<string, unknown>;
}

/**
 * System health event payload.
 */
export interface SystemHealthPayload {
  component: EventSource;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  metrics?: {
    uptime?: number;
    memoryUsage?: number;
    errorRate?: number;
  };
}

/**
 * Notification event payload for Telegram alerts.
 */
export interface NotificationPayload {
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Priority weight mapping for sorting.
 */
export const PRIORITY_WEIGHTS: Record<EventPriority, number> = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 25,
};

/**
 * Default TTL values by category (in seconds).
 */
export const DEFAULT_TTL: Record<EventCategory, number> = {
  system: 3600, // 1 hour
  agent: 3600, // 1 hour
  task: 86400, // 24 hours
  github: 604800, // 7 days
  notification: 86400, // 24 hours
  approval: 86400, // 24 hours
  schedule: 3600, // 1 hour
};
