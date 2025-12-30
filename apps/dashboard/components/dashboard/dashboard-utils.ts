/**
 * Dashboard component utilities.
 * These utilities handle common formatting and mapping logic
 * for dashboard components.
 */

/**
 * Maps a column count to the appropriate Tailwind grid class.
 * Limits the maximum columns to 4 and defaults to 3 for invalid values.
 * Non-integer values are floored to the nearest whole number.
 * @param columns - Desired number of columns
 * @returns Tailwind grid class string
 */
export function getGridClass(columns: number): string {
  const clampedColumns = Math.floor(Math.min(columns, 4));
  const gridClasses: Record<number, string> = {
    0: 'grid-cols-3',
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };
  return gridClasses[clampedColumns] || 'grid-cols-3';
}

/**
 * Formats a trend value and change percentage into a trend direction string.
 * @param change - The change percentage (can be negative)
 * @returns The trend direction: 'up', 'down', or 'neutral'
 */
export function getTrendDirection(change: number): 'up' | 'down' | 'neutral' {
  if (change > 0) {
    return 'up';
  }
  if (change < 0) {
    return 'down';
  }
  return 'neutral';
}

/**
 * Formats a number with optional K/M suffixes for large numbers.
 * Handles negative numbers by preserving the sign.
 * @param num - The number to format
 * @returns Formatted string with K/M suffixes if applicable
 */
export function formatCompactNumber(num: number): string {
  const absValue = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (absValue >= 1000000) {
    return `${sign}${(absValue / 1000000).toFixed(1)}M`;
  }
  if (absValue >= 1000) {
    return `${sign}${(absValue / 1000).toFixed(1)}K`;
  }
  return num.toString();
}
