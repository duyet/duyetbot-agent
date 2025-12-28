/**
 * Notification Processor
 *
 * Processes Event Bridge events and sends notifications to admins.
 * Called by the scheduled cron handler.
 */

import { EventBridge, type AgentEvent } from '@duyetbot/cloudflare-agent';
import { logger } from '@duyetbot/hono-middleware';
import { formatEventBatch, formatEventNotification } from './formatter.js';
import type { NotificationBatchResult, NotificationPreferences } from './types.js';

/**
 * Send a message to Telegram
 */
async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string
): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('[NotificationProcessor] Failed to send message', {
        chatId,
        status: response.status,
        error,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[NotificationProcessor] Error sending message', {
      chatId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get admin preferences from D1 or use defaults
 */
async function getAdminPreferences(
  db: D1Database,
  adminChatId: number
): Promise<NotificationPreferences> {
  try {
    const result = await db
      .prepare('SELECT * FROM notification_preferences WHERE chat_id = ?')
      .bind(adminChatId)
      .first<{
        user_id: number;
        chat_id: number;
        enabled: number;
        min_priority: string;
        categories: string;
        quiet_hours_start: number | null;
        quiet_hours_end: number | null;
        last_sequence: number;
        updated_at: number;
      }>();

    if (result) {
      return {
        userId: result.user_id,
        chatId: result.chat_id,
        enabled: result.enabled === 1,
        minPriority: result.min_priority as NotificationPreferences['minPriority'],
        categories: JSON.parse(result.categories) as NotificationPreferences['categories'],
        quietHoursStart: result.quiet_hours_start ?? undefined,
        quietHoursEnd: result.quiet_hours_end ?? undefined,
        lastSequence: result.last_sequence,
        updatedAt: result.updated_at,
      };
    }
  } catch (error) {
    // Table might not exist yet - will be created on first save
    logger.debug('[NotificationProcessor] No preferences found, using defaults', {
      chatId: adminChatId,
    });
  }

  // Return default preferences
  return {
    userId: adminChatId,
    chatId: adminChatId,
    enabled: true,
    minPriority: 'normal',
    categories: ['github', 'task', 'approval'],
    lastSequence: 0,
    updatedAt: Date.now(),
  };
}

/**
 * Save preferences to D1
 */
async function savePreferences(db: D1Database, prefs: NotificationPreferences): Promise<void> {
  try {
    // Ensure table exists
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS notification_preferences (
          chat_id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          min_priority TEXT NOT NULL DEFAULT 'normal',
          categories TEXT NOT NULL DEFAULT '["github","task","approval"]',
          quiet_hours_start INTEGER,
          quiet_hours_end INTEGER,
          last_sequence INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL
        )`
      )
      .run();

    await db
      .prepare(
        `INSERT OR REPLACE INTO notification_preferences
         (chat_id, user_id, enabled, min_priority, categories, quiet_hours_start, quiet_hours_end, last_sequence, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        prefs.chatId,
        prefs.userId,
        prefs.enabled ? 1 : 0,
        prefs.minPriority,
        JSON.stringify(prefs.categories),
        prefs.quietHoursStart ?? null,
        prefs.quietHoursEnd ?? null,
        prefs.lastSequence,
        prefs.updatedAt
      )
      .run();
  } catch (error) {
    logger.error('[NotificationProcessor] Failed to save preferences', {
      chatId: prefs.chatId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Check if current time is within quiet hours
 */
function isQuietHour(prefs: NotificationPreferences): boolean {
  if (prefs.quietHoursStart === undefined || prefs.quietHoursEnd === undefined) {
    return false;
  }

  const now = new Date();
  const currentHour = now.getUTCHours();

  if (prefs.quietHoursStart <= prefs.quietHoursEnd) {
    // Simple range: e.g., 22 to 6 doesn't wrap
    return currentHour >= prefs.quietHoursStart && currentHour < prefs.quietHoursEnd;
  } else {
    // Wrapping range: e.g., 22 to 6 (overnight)
    return currentHour >= prefs.quietHoursStart || currentHour < prefs.quietHoursEnd;
  }
}

/**
 * Filter events based on preferences
 */
function filterEvents(events: AgentEvent[], prefs: NotificationPreferences): AgentEvent[] {
  const priorityOrder = ['low', 'normal', 'high', 'critical'];
  const minPriorityIndex = priorityOrder.indexOf(prefs.minPriority);

  return events.filter((event) => {
    // Check category
    if (!prefs.categories.includes(event.category)) {
      return false;
    }

    // Check priority
    const eventPriorityIndex = priorityOrder.indexOf(event.priority);
    if (eventPriorityIndex < minPriorityIndex) {
      return false;
    }

    return true;
  });
}

/**
 * Process pending events and send notifications
 *
 * Main entry point called by the scheduled handler.
 */
export async function processEventNotifications(
  db: D1Database,
  botToken: string,
  adminChatId: number
): Promise<NotificationBatchResult> {
  const result: NotificationBatchResult = {
    eventsProcessed: 0,
    notificationsSent: 0,
    errors: [],
    lastSequence: 0,
  };

  try {
    // Get admin preferences
    const prefs = await getAdminPreferences(db, adminChatId);
    result.lastSequence = prefs.lastSequence;

    // Check if notifications are enabled
    if (!prefs.enabled) {
      logger.debug('[NotificationProcessor] Notifications disabled', { chatId: adminChatId });
      return result;
    }

    // Check quiet hours
    if (isQuietHour(prefs)) {
      logger.debug('[NotificationProcessor] In quiet hours', { chatId: adminChatId });
      return result;
    }

    // Initialize Event Bridge
    const bridge = new EventBridge({
      db,
      agentId: 'telegram-bot',
    });

    // Query new events since last sequence
    const events = await bridge.query({
      afterSequence: prefs.lastSequence,
      limit: 50,
    });

    if (events.length === 0) {
      logger.debug('[NotificationProcessor] No new events');
      return result;
    }

    result.eventsProcessed = events.length;

    // Filter events based on preferences
    const filteredEvents = filterEvents(events, prefs);

    if (filteredEvents.length === 0) {
      logger.debug('[NotificationProcessor] No matching events after filter', {
        total: events.length,
        filtered: 0,
      });

      // Update sequence even if no notifications sent
      const maxSequence = Math.max(...events.map((e) => e.sequence ?? 0));
      if (maxSequence > prefs.lastSequence) {
        prefs.lastSequence = maxSequence;
        prefs.updatedAt = Date.now();
        await savePreferences(db, prefs);
        result.lastSequence = maxSequence;
      }

      return result;
    }

    // Group by priority for batching
    const criticalEvents = filteredEvents.filter((e) => e.priority === 'critical');
    const otherEvents = filteredEvents.filter((e) => e.priority !== 'critical');

    // Send critical events individually
    for (const event of criticalEvents) {
      const text = formatEventNotification(event);
      const sent = await sendTelegramMessage(botToken, adminChatId, text);
      if (sent) {
        result.notificationsSent++;
      } else {
        result.errors.push(`Failed to send critical event ${event.id}`);
      }
    }

    // Batch other events
    if (otherEvents.length > 0) {
      const text = formatEventBatch(otherEvents);
      const sent = await sendTelegramMessage(botToken, adminChatId, text);
      if (sent) {
        result.notificationsSent++;
      } else {
        result.errors.push(`Failed to send batch of ${otherEvents.length} events`);
      }
    }

    // Update last sequence
    const maxSequence = Math.max(...events.map((e) => e.sequence ?? 0));
    if (maxSequence > prefs.lastSequence) {
      prefs.lastSequence = maxSequence;
      prefs.updatedAt = Date.now();
      await savePreferences(db, prefs);
      result.lastSequence = maxSequence;
    }

    logger.info('[NotificationProcessor] Processed events', {
      eventsProcessed: result.eventsProcessed,
      notificationsSent: result.notificationsSent,
      lastSequence: result.lastSequence,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    logger.error('[NotificationProcessor] Error processing events', { error: errorMessage });
    return result;
  }
}
