/**
 * Event formatting utilities for the events content component.
 * These utilities handle timestamp formatting, duration display,
 * and status label/variant mapping.
 */

/**
 * Formats a timestamp into a human-readable relative time string.
 * @param ts - Unix timestamp in milliseconds
 * @returns Formatted time string (e.g., "Just now", "5m ago", "2h ago", "3d ago")
 */
export function formatEventTimestamp(ts: number | undefined): string {
  if (!ts) {
    return 'Unknown';
  }
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Formats a duration in milliseconds into a human-readable string.
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string (e.g., "500ms", "2.5s", "3m 45s")
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Maps an event status string to a badge variant.
 * @param status - The event status string
 * @returns The corresponding badge variant
 */
export function getStatusVariant(
  status: string
): 'success' | 'warning' | 'destructive' | 'info' | 'secondary' {
  switch (status) {
    case 'success':
      return 'success';
    case 'running':
    case 'pending':
      return 'warning';
    case 'error':
      return 'destructive';
    default:
      return 'secondary';
  }
}

/**
 * Maps an event status string to a human-readable label.
 * @param status - The event status string
 * @returns The human-readable status label
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'success':
      return 'Completed';
    case 'running':
      return 'Running';
    case 'pending':
      return 'Pending';
    case 'error':
      return 'Error';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}
