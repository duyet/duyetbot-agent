/**
 * Notification Formatter
 *
 * Formats Event Bridge events into human-readable Telegram notifications.
 * Supports HTML formatting for rich display.
 */

import type { AgentEvent, GitHubPREventPayload } from '@duyetbot/cloudflare-agent';

/**
 * Priority emoji mapping
 */
const PRIORITY_EMOJI: Record<string, string> = {
  critical: '🚨',
  high: '🔴',
  normal: '🔵',
  low: '⚪',
};

/**
 * Category emoji mapping
 */
const CATEGORY_EMOJI: Record<string, string> = {
  github: '🐙',
  task: '📋',
  notification: '🔔',
  approval: '✅',
  schedule: '⏰',
  system: '⚙️',
  agent: '🤖',
};

/**
 * GitHub action emoji mapping
 */
const GITHUB_ACTION_EMOJI: Record<string, string> = {
  opened: '🆕',
  closed: '❌',
  merged: '🎉',
  review_requested: '👀',
  approved: '✅',
  changes_requested: '🔄',
};

/**
 * Format a relative time string
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return 'just now';
}

/**
 * Escape HTML special characters for Telegram
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Format a GitHub PR event for notification
 */
export function formatGitHubPREvent(event: AgentEvent): string {
  const payload = event.payload as GitHubPREventPayload;
  const actionEmoji = GITHUB_ACTION_EMOJI[payload.action] ?? '📌';
  const priorityEmoji = PRIORITY_EMOJI[event.priority] ?? '';

  const lines: string[] = [];

  // Header
  lines.push(`${priorityEmoji} ${actionEmoji} <b>PR ${payload.action}</b>`);
  lines.push('');

  // PR details
  lines.push(`📦 <b>${escapeHtml(payload.repo)}</b> #${payload.prNumber}`);
  lines.push(`📝 ${escapeHtml(payload.title)}`);
  lines.push(`👤 by ${escapeHtml(payload.author)}`);

  // Stats if available
  if (payload.additions !== undefined || payload.deletions !== undefined) {
    const stats: string[] = [];
    if (payload.additions !== undefined) {
      stats.push(`<code>+${payload.additions}</code>`);
    }
    if (payload.deletions !== undefined) {
      stats.push(`<code>-${payload.deletions}</code>`);
    }
    if (stats.length > 0) {
      lines.push(`📊 ${stats.join(' ')}`);
    }
  }

  // Link
  lines.push('');
  lines.push(`🔗 <a href="${payload.url}">View PR</a>`);

  // Timestamp
  lines.push(`<i>${formatRelativeTime(event.createdAt)}</i>`);

  return lines.join('\n');
}

/**
 * Format a generic event for notification
 */
export function formatGenericEvent(event: AgentEvent): string {
  const categoryEmoji = CATEGORY_EMOJI[event.category] ?? '📌';
  const priorityEmoji = PRIORITY_EMOJI[event.priority] ?? '';

  const lines: string[] = [];

  // Header
  lines.push(`${priorityEmoji} ${categoryEmoji} <b>${escapeHtml(event.type)}</b>`);
  lines.push('');

  // Payload summary (first 3 keys)
  const payload = event.payload as Record<string, unknown>;
  const keys = Object.keys(payload).slice(0, 3);
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' || typeof value === 'number') {
      lines.push(`• ${key}: ${escapeHtml(String(value))}`);
    }
  }

  // Source
  lines.push('');
  lines.push(`📡 from <code>${escapeHtml(event.source)}</code>`);
  lines.push(`<i>${formatRelativeTime(event.createdAt)}</i>`);

  return lines.join('\n');
}

/**
 * Format an event for notification
 *
 * Routes to specialized formatters based on event category/type.
 */
export function formatEventNotification(event: AgentEvent): string {
  // GitHub PR events
  if (event.category === 'github' && event.type.startsWith('pr.')) {
    return formatGitHubPREvent(event);
  }

  // Default: generic format
  return formatGenericEvent(event);
}

/**
 * Format a batch of events into a single notification
 *
 * Used when multiple events arrive at once to avoid notification spam.
 */
export function formatEventBatch(events: AgentEvent[]): string {
  if (events.length === 0) {
    return '';
  }

  if (events.length === 1) {
    return formatEventNotification(events[0]!);
  }

  const lines: string[] = [];
  lines.push(`📬 <b>${events.length} new events</b>`);
  lines.push('');

  // Group by category
  const byCategory = new Map<string, AgentEvent[]>();
  for (const event of events) {
    const list = byCategory.get(event.category) ?? [];
    list.push(event);
    byCategory.set(event.category, list);
  }

  for (const [category, categoryEvents] of byCategory) {
    const emoji = CATEGORY_EMOJI[category] ?? '📌';
    lines.push(`${emoji} <b>${category}</b> (${categoryEvents.length})`);

    for (const event of categoryEvents.slice(0, 3)) {
      const priorityEmoji = PRIORITY_EMOJI[event.priority] ?? '';
      lines.push(`  ${priorityEmoji} ${event.type}`);
    }

    if (categoryEvents.length > 3) {
      lines.push(`  <i>...and ${categoryEvents.length - 3} more</i>`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
