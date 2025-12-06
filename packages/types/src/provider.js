/**
 * LLM Provider Types and Interfaces
 *
 * Defines the unified interface for all LLM providers (Claude, OpenAI, OpenRouter)
 */
/**
 * Error thrown by LLM providers
 */
export class LLMProviderError extends Error {
  provider;
  code;
  statusCode;
  cause;
  constructor(message, provider, code, statusCode, cause) {
    super(message);
    this.name = 'LLMProviderError';
    this.provider = provider;
    if (code !== undefined) {
      this.code = code;
    }
    if (statusCode !== undefined) {
      this.statusCode = statusCode;
    }
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
/**
 * Parse provider format string
 */
export function parseProviderFormat(format) {
  const parts = format.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid provider format: "${format}". Expected format: <provider>:<model_id>`);
  }
  return {
    provider: parts[0].trim(),
    model: parts[1].trim(),
    original: format,
  };
}
/**
 * Format provider and model into standard format
 */
export function formatProvider(provider, model) {
  return `${provider}:${model}`;
}
