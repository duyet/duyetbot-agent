/**
 * KPI Card Utilities
 *
 * Extracted pure functions for KPI card display logic including trend formatting
 * and color class generation.
 */

import type { KPICard } from '@/types';

export type TrendDirection = 'up' | 'down' | 'neutral';

/**
 * Get color class for trend direction
 * @param trend - Trend direction
 * @returns Tailwind color class string
 */
export function getTrendColorClass(trend: TrendDirection): string {
  switch (trend) {
    case 'up':
      return 'text-green-500';
    case 'down':
      return 'text-red-500';
    case 'neutral':
      return 'text-gray-500';
  }
}

/**
 * Format change percentage with sign
 * @param change - Numeric change value (can be negative)
 * @returns Formatted string with + prefix for positive values
 */
export function formatChange(change: number): string {
  return change > 0 ? `+${change}` : String(change);
}

/**
 * Format full change label with percentage and context
 * @param change - Numeric change value
 * @param changeLabel - Context label (e.g., "vs last week")
 * @returns Object with formatted change and label
 */
export function formatChangeLabel(
  change: number,
  changeLabel: string
): {
  formattedChange: string;
  label: string;
} {
  return {
    formattedChange: `${formatChange(change)}%`,
    label: changeLabel,
  };
}

/**
 * Check if card has valid positive change
 * @param card - KPI card to check
 * @returns true if change is positive
 */
export function hasPositiveChange(card: KPICard): boolean {
  return card.change > 0;
}

/**
 * Check if card has valid negative change
 * @param card - KPI card to check
 * @returns true if change is negative
 */
export function hasNegativeChange(card: KPICard): boolean {
  return card.change < 0;
}

/**
 * Check if card has neutral change (zero)
 * @param card - KPI card to check
 * @returns true if change is zero
 */
export function hasNeutralChange(card: KPICard): boolean {
  return card.change === 0;
}
