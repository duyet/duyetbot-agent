/**
 * Notification System
 *
 * Send notifications to users for GitHub events
 */

import type { Context, Telegraf } from 'telegraf';
import type { NotificationPayload, NotificationType, UserSubscription } from './types.js';

/**
 * Notification Manager
 */
export class NotificationManager {
  private bot: Telegraf<Context>;
  private subscriptions: Map<number, UserSubscription> = new Map();

  constructor(bot: Telegraf<Context>) {
    this.bot = bot;
  }

  /**
   * Subscribe user to notifications
   */
  subscribe(
    userId: number,
    chatId: number,
    notifications: NotificationType[],
    repositories?: string[]
  ): void {
    this.subscriptions.set(userId, {
      userId,
      chatId,
      notifications,
      repositories,
      enabled: true,
    });
  }

  /**
   * Unsubscribe user
   */
  unsubscribe(userId: number): void {
    this.subscriptions.delete(userId);
  }

  /**
   * Update subscription
   */
  updateSubscription(userId: number, updates: Partial<UserSubscription>): void {
    const existing = this.subscriptions.get(userId);
    if (existing) {
      this.subscriptions.set(userId, { ...existing, ...updates });
    }
  }

  /**
   * Get user subscription
   */
  getSubscription(userId: number): UserSubscription | undefined {
    return this.subscriptions.get(userId);
  }

  /**
   * Send notification to user
   */
  async notify(userId: number, payload: NotificationPayload): Promise<boolean> {
    const subscription = this.subscriptions.get(userId);

    if (!subscription || !subscription.enabled) {
      return false;
    }

    // Check if user subscribed to this notification type
    if (!subscription.notifications.includes(payload.type)) {
      return false;
    }

    // Check repository filter
    if (
      subscription.repositories &&
      subscription.repositories.length > 0 &&
      payload.repository &&
      !subscription.repositories.includes(payload.repository)
    ) {
      return false;
    }

    try {
      const message = formatNotification(payload);
      await this.bot.telegram.sendMessage(subscription.chatId, message, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true },
      });
      return true;
    } catch (error) {
      console.error(`Failed to send notification to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast notification to all subscribed users
   */
  async broadcast(
    payload: NotificationPayload,
    filter?: (sub: UserSubscription) => boolean
  ): Promise<number> {
    let sent = 0;

    for (const [userId, subscription] of this.subscriptions) {
      if (filter && !filter(subscription)) {
        continue;
      }

      const success = await this.notify(userId, payload);
      if (success) sent++;
    }

    return sent;
  }

  /**
   * Get all subscriptions
   */
  getAllSubscriptions(): UserSubscription[] {
    return Array.from(this.subscriptions.values());
  }
}

/**
 * Format notification message
 */
function formatNotification(payload: NotificationPayload): string {
  const emoji = getNotificationEmoji(payload.type);
  let message = `${emoji} **${payload.title}**\n\n${payload.body}`;

  if (payload.url) {
    message += `\n\n[View on GitHub](${payload.url})`;
  }

  return message;
}

/**
 * Get emoji for notification type
 */
function getNotificationEmoji(type: NotificationType): string {
  switch (type) {
    case 'pr_merged':
      return '🟣';
    case 'pr_review_requested':
      return '👀';
    case 'issue_assigned':
      return '📋';
    case 'issue_mentioned':
      return '💬';
    case 'ci_failed':
      return '❌';
    case 'ci_passed':
      return '✅';
    case 'deployment_completed':
      return '🚀';
    default:
      return '📢';
  }
}

/**
 * Create notification from GitHub webhook event
 */
export function createGitHubNotification(
  event: string,
  payload: Record<string, unknown>
): NotificationPayload | null {
  switch (event) {
    case 'pull_request': {
      const action = payload.action as string;
      const pr = payload.pull_request as Record<string, unknown>;
      const repo = payload.repository as Record<string, unknown>;

      if (action === 'closed' && pr.merged) {
        return {
          type: 'pr_merged',
          title: 'PR Merged',
          body: `#${pr.number} ${pr.title}`,
          url: pr.html_url as string,
          repository: repo.full_name as string,
        };
      }

      if (action === 'review_requested') {
        return {
          type: 'pr_review_requested',
          title: 'Review Requested',
          body: `#${pr.number} ${pr.title}`,
          url: pr.html_url as string,
          repository: repo.full_name as string,
        };
      }
      break;
    }

    case 'issues': {
      const action = payload.action as string;
      const issue = payload.issue as Record<string, unknown>;
      const repo = payload.repository as Record<string, unknown>;

      if (action === 'assigned') {
        return {
          type: 'issue_assigned',
          title: 'Issue Assigned',
          body: `#${issue.number} ${issue.title}`,
          url: issue.html_url as string,
          repository: repo.full_name as string,
        };
      }
      break;
    }

    case 'check_run': {
      const checkRun = payload.check_run as Record<string, unknown>;
      const repo = payload.repository as Record<string, unknown>;
      const conclusion = checkRun.conclusion as string;

      if (checkRun.status === 'completed') {
        return {
          type: conclusion === 'success' ? 'ci_passed' : 'ci_failed',
          title: conclusion === 'success' ? 'CI Passed' : 'CI Failed',
          body: `${checkRun.name}`,
          url: checkRun.html_url as string,
          repository: repo.full_name as string,
        };
      }
      break;
    }

    case 'deployment_status': {
      const status = payload.deployment_status as Record<string, unknown>;
      const repo = payload.repository as Record<string, unknown>;

      if (status.state === 'success') {
        return {
          type: 'deployment_completed',
          title: 'Deployment Completed',
          body: `Environment: ${status.environment}`,
          url: status.target_url as string,
          repository: repo.full_name as string,
        };
      }
      break;
    }
  }

  return null;
}
