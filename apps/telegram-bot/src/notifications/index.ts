/**
 * Notifications Module
 *
 * Event Bridge notification system for Telegram.
 * Processes cross-agent events and sends admin notifications.
 */

export { formatEventBatch, formatEventNotification, formatGitHubPREvent } from './formatter.js';
export { processEventNotifications } from './processor.js';
export type {
  FormattedNotification,
  NotificationBatchResult,
  NotificationPreferences,
} from './types.js';
export { DEFAULT_PREFERENCES } from './types.js';
