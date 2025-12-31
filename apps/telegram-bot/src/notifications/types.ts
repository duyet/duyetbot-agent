/**
 * Notification Types
 *
 * Types for the event notification system that processes
 * Event Bridge events and sends admin notifications via Telegram.
 */

import type { EventCategory, EventPriority } from '@duyetbot/cloudflare-agent';

/**
 * User notification preferences stored in D1
 */
export interface NotificationPreferences {
  /** User ID (Telegram user ID) */
  userId: number;
  /** Chat ID for notifications */
  chatId: number;
  /** Whether notifications are enabled globally */
  enabled: boolean;
  /** Minimum priority to notify about */
  minPriority: EventPriority;
  /** Categories to receive notifications for */
  categories: EventCategory[];
  /** Quiet hours (UTC) - no notifications during these hours */
  quietHoursStart?: number;
  quietHoursEnd?: number;
  /** Last event sequence processed */
  lastSequence: number;
  /** When preferences were last updated */
  updatedAt: number;
}

/**
 * Default notification preferences for new users
 */
export const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'userId' | 'chatId'> = {
  enabled: true,
  minPriority: 'normal',
  categories: ['github', 'task', 'approval'],
  lastSequence: 0,
  updatedAt: Date.now(),
};

/**
 * Notification batch result
 */
export interface NotificationBatchResult {
  /** Number of events processed */
  eventsProcessed: number;
  /** Number of notifications sent */
  notificationsSent: number;
  /** Errors encountered */
  errors: string[];
  /** New sequence position */
  lastSequence: number;
}

/**
 * Formatted notification ready to send
 */
export interface FormattedNotification {
  /** Telegram chat ID to send to */
  chatId: number;
  /** Formatted message text (HTML) */
  text: string;
  /** Original event ID for tracking */
  eventId: string;
  /** Priority for ordering */
  priority: EventPriority;
}
