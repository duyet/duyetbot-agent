/**
 * Utilities for working with LLM model names
 */

/**
 * Shortens an LLM model name according to common patterns
 *
 * Rules:
 * - claude-3-5-sonnet-YYYYMMDD → sonnet-3.5
 * - claude-3-5-haiku-YYYYMMDD → haiku-3.5
 * - claude-3-opus-YYYYMMDD → opus-3
 * - claude-4-opus → opus-4
 * - gpt-4o-mini → gpt-4o-mini (keep as-is)
 * - gpt-4-turbo-YYYY-MM-DD → gpt-4-turbo (remove date suffix)
 * - Any model > 20 chars → truncate to 17 + '...'
 *
 * @param model - The model name to shorten
 * @returns The shortened model name
 */
export function shortenModelName(model: string): string {
  if (!model) {
    return model;
  }

  // Handle Claude 3.5 variants (sonnet, haiku)
  if (model.includes('claude-3-5-sonnet')) {
    return 'sonnet-3.5';
  }

  if (model.includes('claude-3-5-haiku')) {
    return 'haiku-3.5';
  }

  // Handle Claude 3 opus
  if (model.includes('claude-3-opus')) {
    return 'opus-3';
  }

  // Handle Claude 4 opus
  if (model.includes('claude-4-opus')) {
    return 'opus-4';
  }

  // Handle GPT-4o mini (keep as-is)
  if (model === 'gpt-4o-mini') {
    return model;
  }

  // Handle GPT-4 turbo (remove date suffix)
  if (model.startsWith('gpt-4-turbo')) {
    return 'gpt-4-turbo';
  }

  // Handle generic length truncation
  if (model.length > 20) {
    return model.substring(0, 17) + '...';
  }

  // Return as-is for short names
  return model;
}
