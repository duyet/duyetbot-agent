/**
 * Token Breakdown Utilities
 *
 * Extracted pure functions for token percentage calculations and formatting.
 */

export interface TokenBreakdown {
  input: number;
  output: number;
  cached: number;
}

export interface TokenPercentages {
  input: number;
  output: number;
  cached: number;
}

/**
 * Calculate total tokens from breakdown
 */
export function calculateTotal(breakdown: TokenBreakdown): number {
  return breakdown.input + breakdown.output + breakdown.cached;
}

/**
 * Calculate percentage for each token type
 */
export function calculatePercentages(breakdown: TokenBreakdown): TokenPercentages {
  const total = calculateTotal(breakdown);
  if (total === 0) {
    return { input: 0, output: 0, cached: 0 };
  }
  return {
    input: (breakdown.input / total) * 100,
    output: (breakdown.output / total) * 100,
    cached: (breakdown.cached / total) * 100,
  };
}

/**
 * Format token value with percentage label
 */
export function formatTokenWithPercent(value: number, percent: number): string {
  return `${value.toLocaleString()} (${percent.toFixed(0)}%)`;
}

/**
 * Format percentage to fixed decimal places
 */
export function formatPercent(percent: number, decimals = 0): string {
  return percent.toFixed(decimals);
}

/**
 * Get percentage as CSS width string
 */
export function percentToWidth(percent: number): string {
  return `${percent}%`;
}

/**
 * Check if breakdown has any tokens
 */
export function hasTokens(breakdown: TokenBreakdown): boolean {
  return breakdown.input > 0 || breakdown.output > 0 || breakdown.cached > 0;
}
