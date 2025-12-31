/**
 * Format utilities for progress tracking and debug footer rendering.
 * Provides compact formatting for durations, numbers, costs, and tool outputs.
 */

/**
 * Format duration in milliseconds to human-readable string.
 *
 * Examples:
 * - 0 → "0ms"
 * - 123 → "123ms"
 * - 1234 → "1.23s"
 * - 12345 → "12.3s"
 * - 123456 → "2m 3s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  if (ms < 60000) {
    const seconds = ms / 1000;
    return `${seconds.toFixed(2)}s`;
  }

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format number to compact notation.
 *
 * Examples:
 * - 500 → "500"
 * - 1234 → "1.2k"
 * - 1500 → "1.5k"
 * - 12345 → "12k"
 * - 123456 → "123k"
 * - 1234567 → "1.2m"
 * - 12345678 → "12m"
 * - 1234567890 → "1.2b"
 */
export function formatCompactNumber(n: number): string {
  if (n < 1000) {
    return String(n);
  }

  if (n < 1000000) {
    const k = n / 1000;
    return k % 1 === 0 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
  }

  if (n < 1000000000) {
    const m = n / 1000000;
    return m % 1 === 0 ? `${Math.round(m)}m` : `${m.toFixed(1)}m`;
  }

  const b = n / 1000000000;
  return b % 1 === 0 ? `${Math.round(b)}b` : `${b.toFixed(1)}b`;
}

/**
 * Format USD cost with appropriate precision.
 *
 * Examples:
 * - 0.0001 → "$0.0001"
 * - 0.001 → "$0.001"
 * - 0.0023 → "$0.002" (rounds to 3 decimals for small amounts)
 * - 0.01 → "$0.01"
 * - 0.1 → "$0.10"
 * - 1.5 → "$1.50"
 * - 10.567 → "$10.57" (2 decimals for larger amounts)
 */
export function formatCost(usd: number): string {
  // For very small amounts, show up to 4 decimals
  if (usd < 0.01) {
    return `$${usd.toFixed(4).replace(/\.?0+$/, '')}`;
  }

  // For normal amounts, show 2 decimals
  return `$${usd.toFixed(2)}`;
}

/**
 * Truncate text to maximum length with ellipsis.
 *
 * Examples:
 * - truncate("hello", 5) → "hello"
 * - truncate("hello world", 8) → "hello..."
 * - truncate("hello world", 11) → "hello world"
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

/**
 * Format a single argument key-value pair.
 */
function formatArgValue(key: string, value: unknown, maxLength: number): string {
  if (typeof value === 'string') {
    const truncated = value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
    return `${key}: "${truncated}"`;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${key}: ${value}`;
  }

  if (value === null) {
    return `${key}: null`;
  }

  if (typeof value === 'object') {
    const json = JSON.stringify(value);
    const truncated = json.length > maxLength ? `${json.slice(0, maxLength - 3)}...` : json;
    return `${key}: ${truncated}`;
  }

  return `${key}: ${String(value)}`;
}

/**
 * Format tool arguments compactly for display.
 * Prioritizes showing the most relevant argument (query, url, prompt, etc.)
 * for concise display in progress indicators.
 *
 * Priority order:
 * 1. query, search, q (search-related)
 * 2. url, link, href (URL-related)
 * 3. prompt, question, input (input-related)
 * 4. text, content, message (content-related)
 * 5. path, file, filename (file-related)
 * 6. First key as fallback
 *
 * Examples:
 * - { query: "test", limit: 5 } → 'query: "test"'
 * - { url: "https://..." } → 'url: "https://..."'
 * - { count: 5, name: "test" } → 'count: 5'
 * - {} → ""
 *
 * @param args Tool arguments object
 * @param maxLength Maximum length for values (default: 50)
 * @returns Formatted string with priority key shown
 */
export function formatToolArgs(args?: Record<string, unknown>, maxLength = 50): string {
  if (!args || Object.keys(args).length === 0) {
    return '';
  }

  // Priority order for displaying args - show only the most important
  const priorityKeys = [
    'query',
    'search',
    'q', // Search-related
    'url',
    'link',
    'href', // URL-related
    'prompt',
    'question',
    'input', // Input-related
    'text',
    'content',
    'message', // Content-related
    'path',
    'file',
    'filename', // File-related
  ];

  // Find first priority key that exists
  for (const key of priorityKeys) {
    if (args[key] !== undefined) {
      return formatArgValue(key, args[key], maxLength);
    }
  }

  // Fallback: show first key-value
  const firstKey = Object.keys(args)[0];
  if (firstKey) {
    return formatArgValue(firstKey, args[firstKey], maxLength);
  }

  return '';
}

/**
 * Format all tool arguments for verbose display.
 * Shows all key-value pairs, useful for debug footers.
 *
 * Examples:
 * - {} → ""
 * - { key: "value" } → 'key: "value"'
 * - { count: 5, name: "test" } → 'count: 5, name: "test"'
 */
export function formatToolArgsVerbose(args?: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) {
    return '';
  }

  return Object.entries(args)
    .map(([key, value]) => formatArgValue(key, value, 100))
    .join(', ');
}

/**
 * Format tool result for compact display.
 *
 * Shows first N lines and truncates if longer. Useful for displaying
 * tool output in debug footers where space is limited.
 *
 * Examples:
 * - formatToolResult("success") → "success"
 * - formatToolResult("line1\nline2\nline3", 2) → "line1\nline2..."
 * - formatToolResult("x".repeat(200), 1, 50) → "xxxx...xxxx..."
 */
export function formatToolResult(
  result: string,
  maxLines: number = 3,
  maxLength: number = 200
): string {
  const lines = result.split('\n');

  // Take only first N lines
  let formatted = lines.slice(0, maxLines).join('\n');

  // Truncate total length
  if (formatted.length > maxLength) {
    formatted = truncate(formatted, maxLength);
  }

  // Add ellipsis if we cut lines
  if (lines.length > maxLines && !formatted.endsWith('...')) {
    formatted += '...';
  }

  return formatted;
}
