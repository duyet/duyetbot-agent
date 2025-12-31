/**
 * Token Heatmap Utilities
 *
 * Extracted pure functions for heatmap color scaling and data grouping.
 */

import type { TokenHeatmapData } from '@/types';

/**
 * Get heatmap color based on value ratio to maximum
 * @param value - Current token value
 * @param max - Maximum token value in dataset
 * @returns CSS color string for heatmap cell
 */
export function getHeatmapColor(value: number, max: number): string {
  const ratio = value / max;
  if (ratio < 0.25) {
    return '#e0e7ff'; // indigo-100
  }
  if (ratio < 0.5) {
    return '#a5b4fc'; // indigo-300
  }
  if (ratio < 0.75) {
    return '#6366f1'; // indigo-500
  }
  return '#4f46e5'; // indigo-600
}

/**
 * Get all heatmap color scale values for legend
 * @returns Array of color strings from least to most intense
 */
export function getHeatmapColorScale(): string[] {
  return ['#e0e7ff', '#a5b4fc', '#6366f1', '#4f46e5'];
}

/**
 * Group heatmap data by day and hour into a 7x24 grid
 * @param data - Array of TokenHeatmapData points
 * @returns 2D array [day][hour] of token values
 */
export function groupHeatmapByGrid(data: TokenHeatmapData[]): number[][] {
  const grid = Array.from({ length: 7 }).map((_, day) =>
    Array.from({ length: 24 }).map((_, hour) => {
      const item = data.find((d) => d.day === day && d.hour === hour);
      return item?.tokens ?? 0;
    })
  );
  return grid;
}

/**
 * Get day labels for heatmap rows
 * @returns Array of day abbreviations starting with Sunday
 */
export function getDayLabels(): string[] {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
}

/**
 * Get hour display label (shows label every 6 hours)
 * @param hour - Hour value (0-23)
 * @returns Hour number as string or empty string
 */
export function getHourLabel(hour: number): string {
  return hour % 6 === 0 ? String(hour) : '';
}

/**
 * Get the maximum token value from data
 * @param data - Array of TokenHeatmapData points
 * @returns Maximum token value, or 1 if data is empty
 */
export function getMaxTokens(data: TokenHeatmapData[]): number {
  return Math.max(...data.map((d) => d.tokens), 1);
}
