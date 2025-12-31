/**
 * Session Formatting Utilities
 *
 * Pure functions for formatting session-related data
 */

/**
 * Format a timestamp as relative time or absolute date
 * Returns "Just now", "Xm ago", "Xh ago", "Xd ago", or absolute date for older dates
 */
export function formatSessionTimestamp(ts: number | undefined): string {
  if (!ts) {
    return 'Unknown';
  }
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  if (days < 7) {
    return `${days}d ago`;
  }
  return date.toLocaleDateString();
}

/**
 * Format a number with K/M suffixes for large values
 * Returns "X.XM" for millions, "X.XK" for thousands, or string representation
 */
export function formatSessionNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}
