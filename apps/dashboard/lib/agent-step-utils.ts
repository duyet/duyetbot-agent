/**
 * Agent Step Utilities
 *
 * Extracted pure functions for agent step status configuration and styling.
 */

import type { AgentStep } from '@/types';

// Re-export AgentStep type for convenience
export type { AgentStep };

export type AgentStepStatus = AgentStep['status'];

export interface StatusConfig {
  bgClass: string;
  label: string;
}

/**
 * Get background class for step status
 */
export function getStatusBgClass(status: AgentStepStatus): string {
  const statusMap: Record<AgentStepStatus, string> = {
    success: 'bg-success/10 border-success/20',
    error: 'bg-destructive/10 border-destructive/20',
    pending: 'bg-muted/50 border-muted',
    running: 'bg-primary/10 border-primary/20',
  };
  return statusMap[status];
}

/**
 * Get status label for display
 */
export function getStatusLabel(status: AgentStepStatus): string {
  const labelMap: Record<AgentStepStatus, string> = {
    success: 'Success',
    error: 'Error',
    pending: 'Pending',
    running: 'Running',
  };
  return labelMap[status];
}

/**
 * Check if step is in a final state (success or error)
 */
export function isFinalStatus(status: AgentStepStatus): boolean {
  return status === 'success' || status === 'error';
}

/**
 * Check if step is currently running
 */
export function isRunning(status: AgentStepStatus): boolean {
  return status === 'running';
}

/**
 * Check if step has children
 */
export function hasChildren(step: AgentStep): boolean {
  return step.children.length > 0;
}

/**
 * Calculate padding left based on nesting level
 */
export function calculatePaddingLeft(level: number, unit = 1.5): string {
  return `${level * unit}rem`;
}

/**
 * Format duration in milliseconds for display
 */
export function formatDuration(ms: number): string {
  return `${ms}ms`;
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  return tokens.toLocaleString();
}

/**
 * Get status config object containing both bgClass and label
 */
export function getStatusConfig(status: AgentStepStatus): StatusConfig {
  return {
    bgClass: getStatusBgClass(status),
    label: getStatusLabel(status),
  };
}
