import type { MCPServerStatus } from './types';

/**
 * MCP Server Card Utilities
 *
 * Pure functions for rendering MCP server status cards.
 * Extracted from MCPServerCard component for testability.
 */

export type ServerStatus = MCPServerStatus['status'];

/**
 * Get border class for card based on server status and enabled state
 */
export function getCardBorderClass(status: ServerStatus, enabled: boolean): string {
  if (!enabled) {
    return 'opacity-60';
  }
  switch (status) {
    case 'online':
      return 'border-success/30';
    case 'offline':
      return 'border-destructive/30';
    default:
      return '';
  }
}

/**
 * Get badge variant for status badge
 */
export function getStatusBadgeVariant(
  status: ServerStatus
): 'success' | 'destructive' | 'secondary' {
  switch (status) {
    case 'online':
      return 'success';
    case 'offline':
      return 'destructive';
    case 'disabled':
      return 'secondary';
    default:
      return 'secondary';
  }
}

/**
 * Get human-readable status label
 */
export function getServerStatusLabel(status: ServerStatus): string {
  switch (status) {
    case 'online':
      return 'Online';
    case 'offline':
      return 'Offline';
    case 'disabled':
      return 'Disabled';
    case 'checking':
      return 'Checking...';
    default:
      return 'Unknown';
  }
}

/**
 * Format response time in milliseconds
 */
export function formatResponseTime(ms?: number): string {
  if (!ms) {
    return 'N/A';
  }
  return `${ms}ms`;
}

/**
 * Truncate URL to maximum length
 */
export function truncateUrl(url: string, maxLength = 50): string {
  if (url.length > maxLength) {
    const truncateAt = maxLength - 3; // Reserve space for "..."
    return `${url.substring(0, truncateAt)}...`;
  }
  return url;
}
