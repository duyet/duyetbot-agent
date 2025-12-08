/**
 * Chart Theme Configuration for Recharts
 *
 * Design System: Grok/X Style
 * Optimized for dark mode with X Blue (#1D9BF0) as primary accent
 *
 * Usage:
 * import { chartTheme, chartColors, getChartColor } from '@/lib/chart-theme';
 */

// Chart color palette matching Grok/X design system
export const chartColors = {
  // Primary palette - ordered by visual priority
  primary: '#1D9BF0', // X Blue - primary metric
  success: '#00BA7C', // Green - positive/growth
  purple: '#7856FF', // Purple - tertiary
  warning: '#FFAD1F', // Amber - attention
  error: '#F4212E', // Red - alerts/negative
  violet: '#794BC4', // Violet - alternative

  // Extended palette for multi-series charts
  cyan: '#00C3E0',
  pink: '#F91880',
  orange: '#FF7A00',
  lime: '#84CC16',

  // Neutral tones
  muted: '#71767B',
  border: '#2F3336',
  background: '#000000',
  text: '#E7E9EA',
  textMuted: '#71767B',
} as const;

// Ordered array for multi-series charts
export const chartColorArray = [
  chartColors.primary,
  chartColors.success,
  chartColors.purple,
  chartColors.warning,
  chartColors.error,
  chartColors.violet,
  chartColors.cyan,
  chartColors.pink,
  chartColors.orange,
  chartColors.lime,
] as const;

/**
 * Get chart color by index (wraps around if index exceeds palette length)
 */
export function getChartColor(index: number): string {
  return chartColorArray[index % chartColorArray.length];
}

/**
 * Chart theme configuration for Recharts components
 */
export const chartTheme = {
  // Background
  background: 'transparent',

  // Text colors
  textColor: chartColors.textMuted,
  labelColor: chartColors.text,

  // Grid
  gridColor: chartColors.border,
  gridStroke: chartColors.border,
  gridStrokeWidth: 1,
  gridDashArray: '3 3',

  // Axis
  axis: {
    stroke: chartColors.border,
    strokeWidth: 1,
    tickColor: chartColors.textMuted,
    tickSize: 5,
    tickLine: false,
    axisLine: true,
  },

  // Tooltip
  tooltip: {
    background: '#121212',
    border: chartColors.border,
    borderRadius: 8,
    textColor: chartColors.text,
    labelColor: chartColors.text,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
  },

  // Legend
  legend: {
    iconType: 'circle' as const,
    iconSize: 8,
    textColor: chartColors.textMuted,
    itemGap: 16,
  },

  // Area charts
  area: {
    fillOpacity: 0.1,
    strokeWidth: 2,
    activeDotRadius: 6,
    dotRadius: 0,
  },

  // Line charts
  line: {
    strokeWidth: 2,
    activeDotRadius: 6,
    dotRadius: 0,
  },

  // Bar charts
  bar: {
    radius: [4, 4, 0, 0] as [number, number, number, number],
    barGap: 4,
    barCategoryGap: '20%',
  },

  // Pie charts
  pie: {
    innerRadius: '60%',
    outerRadius: '80%',
    paddingAngle: 2,
    strokeWidth: 0,
    labelLine: false,
  },

  // Animation
  animation: {
    duration: 300,
    easing: 'ease-out' as const,
  },
} as const;

/**
 * Common chart props for consistency
 */
export const chartDefaults = {
  // Responsive container settings
  responsive: {
    width: '100%',
    height: '100%',
    minHeight: 300,
  },

  // Margin settings
  margin: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  },

  // Small margin for compact charts
  marginCompact: {
    top: 10,
    right: 10,
    bottom: 10,
    left: 10,
  },
} as const;

/**
 * Tooltip content style configuration
 */
export const tooltipStyle = {
  contentStyle: {
    backgroundColor: chartTheme.tooltip.background,
    border: `1px solid ${chartTheme.tooltip.border}`,
    borderRadius: chartTheme.tooltip.borderRadius,
    boxShadow: chartTheme.tooltip.boxShadow,
    padding: '12px 16px',
  },
  labelStyle: {
    color: chartTheme.tooltip.labelColor,
    fontWeight: 600,
    marginBottom: 8,
  },
  itemStyle: {
    color: chartTheme.tooltip.textColor,
    padding: '4px 0',
  },
} as const;

/**
 * Format number with K/M/B suffixes
 */
export function formatNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * Format currency value
 */
export function formatCurrency(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format percentage value
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format duration in milliseconds to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 3_600_000) {
    return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  }
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

/**
 * Generate gradient definition for area charts
 */
export function createGradient(
  id: string,
  color: string,
  opacity = 0.3
): {
  id: string;
  stops: Array<{ offset: string; color: string; opacity: number }>;
} {
  return {
    id,
    stops: [
      { offset: '0%', color, opacity },
      { offset: '100%', color, opacity: 0 },
    ],
  };
}

// Re-export types for convenience
export type ChartColor = keyof typeof chartColors;
export type ChartTheme = typeof chartTheme;
