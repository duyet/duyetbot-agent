/**
 * Model Pricing Table
 *
 * Provides pricing information for LLM models to estimate request costs.
 * Prices are in USD per 1 million tokens.
 *
 * @see https://openrouter.ai/docs/models
 */

/**
 * Pricing rates for a model (USD per 1M tokens)
 */
export interface ModelPricing {
  /** Cost per 1M input tokens */
  inputPerMillion: number;
  /** Cost per 1M output tokens */
  outputPerMillion: number;
  /** Cost per 1M cached input tokens (optional, usually discounted) */
  cachedPerMillion?: number;
}

/**
 * Model pricing table (OpenRouter pricing as of Dec 2024)
 *
 * Format: 'provider/model-name' -> pricing
 * Prices sourced from https://openrouter.ai/docs/models
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // xAI Models
  'x-ai/grok-4.1-fast': { inputPerMillion: 0.2, outputPerMillion: 0.6 },
  'x-ai/grok-4.1': { inputPerMillion: 3.0, outputPerMillion: 9.0 },
  'x-ai/grok-3': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  'x-ai/grok-3-fast': { inputPerMillion: 0.6, outputPerMillion: 3.0 },
  'x-ai/grok-2': { inputPerMillion: 2.0, outputPerMillion: 10.0 },
  'x-ai/grok-beta': { inputPerMillion: 5.0, outputPerMillion: 15.0 },

  // Anthropic Claude Models
  'anthropic/claude-3.5-sonnet': {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cachedPerMillion: 0.3,
  },
  'anthropic/claude-3.5-sonnet-20241022': {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cachedPerMillion: 0.3,
  },
  'anthropic/claude-3.5-haiku': {
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
    cachedPerMillion: 0.08,
  },
  'anthropic/claude-3.5-haiku-20241022': {
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
    cachedPerMillion: 0.08,
  },
  'anthropic/claude-3-opus': {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    cachedPerMillion: 1.5,
  },
  'anthropic/claude-3-sonnet': {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cachedPerMillion: 0.3,
  },
  'anthropic/claude-3-haiku': {
    inputPerMillion: 0.25,
    outputPerMillion: 1.25,
    cachedPerMillion: 0.03,
  },

  // OpenAI Models
  'openai/gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10.0 },
  'openai/gpt-4o-2024-11-20': { inputPerMillion: 2.5, outputPerMillion: 10.0 },
  'openai/gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'openai/gpt-4o-mini-2024-07-18': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'openai/gpt-4-turbo': { inputPerMillion: 10.0, outputPerMillion: 30.0 },
  'openai/gpt-4': { inputPerMillion: 30.0, outputPerMillion: 60.0 },
  'openai/gpt-3.5-turbo': { inputPerMillion: 0.5, outputPerMillion: 1.5 },
  'openai/o1': { inputPerMillion: 15.0, outputPerMillion: 60.0 },
  'openai/o1-mini': { inputPerMillion: 3.0, outputPerMillion: 12.0 },
  'openai/o1-preview': { inputPerMillion: 15.0, outputPerMillion: 60.0 },
  'openai/o3-mini': { inputPerMillion: 1.1, outputPerMillion: 4.4 },

  // Google Models
  'google/gemini-pro-1.5': { inputPerMillion: 1.25, outputPerMillion: 5.0 },
  'google/gemini-flash-1.5': { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  'google/gemini-2.0-flash-exp': { inputPerMillion: 0.0, outputPerMillion: 0.0 },

  // Meta Models
  'meta-llama/llama-3.1-405b-instruct': { inputPerMillion: 2.7, outputPerMillion: 2.7 },
  'meta-llama/llama-3.1-70b-instruct': { inputPerMillion: 0.52, outputPerMillion: 0.75 },
  'meta-llama/llama-3.1-8b-instruct': { inputPerMillion: 0.055, outputPerMillion: 0.055 },
  'meta-llama/llama-3.3-70b-instruct': { inputPerMillion: 0.12, outputPerMillion: 0.3 },

  // Mistral Models
  'mistralai/mistral-large': { inputPerMillion: 2.0, outputPerMillion: 6.0 },
  'mistralai/mistral-medium': { inputPerMillion: 2.75, outputPerMillion: 8.1 },
  'mistralai/mistral-small': { inputPerMillion: 0.2, outputPerMillion: 0.6 },
  'mistralai/mixtral-8x7b-instruct': { inputPerMillion: 0.24, outputPerMillion: 0.24 },
  'mistralai/codestral-mamba': { inputPerMillion: 0.25, outputPerMillion: 0.25 },

  // DeepSeek Models
  'deepseek/deepseek-chat': { inputPerMillion: 0.14, outputPerMillion: 0.28 },
  'deepseek/deepseek-coder': { inputPerMillion: 0.14, outputPerMillion: 0.28 },
  'deepseek/deepseek-r1': { inputPerMillion: 0.55, outputPerMillion: 2.19 },

  // Qwen Models
  'qwen/qwen-2.5-72b-instruct': { inputPerMillion: 0.35, outputPerMillion: 0.4 },
  'qwen/qwen-2.5-coder-32b-instruct': { inputPerMillion: 0.18, outputPerMillion: 0.18 },
  'qwen/qwq-32b-preview': { inputPerMillion: 0.12, outputPerMillion: 0.18 },
};

/**
 * Default pricing for unknown models
 * Uses conservative mid-range estimates
 */
const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 1.0,
  outputPerMillion: 3.0,
  cachedPerMillion: 0.1,
};

/**
 * Get pricing for a model
 *
 * @param model - Model identifier (e.g., 'x-ai/grok-4.1-fast')
 * @returns Pricing info, or default if model not found
 */
export function getModelPricing(model: string): ModelPricing {
  // Direct lookup
  if (MODEL_PRICING[model]) {
    return MODEL_PRICING[model];
  }

  // Try without version suffix (e.g., 'anthropic/claude-3.5-sonnet-20241022' -> 'anthropic/claude-3.5-sonnet')
  const baseModel = model.replace(/-\d{8}$/, '');
  if (MODEL_PRICING[baseModel]) {
    return MODEL_PRICING[baseModel];
  }

  // Try extracting provider/model pattern from longer strings
  const parts = model.split('/');
  if (parts.length >= 2) {
    const shortModel = `${parts[0]}/${parts[1]}`;
    if (MODEL_PRICING[shortModel]) {
      return MODEL_PRICING[shortModel];
    }
  }

  return DEFAULT_PRICING;
}

/**
 * Token usage for cost calculation
 */
export interface TokenUsageForCost {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
}

/**
 * Estimate cost for a request based on model and token usage
 *
 * @param model - Model identifier
 * @param usage - Token usage from response
 * @returns Estimated cost in USD
 *
 * @example
 * ```typescript
 * const cost = estimateCost('x-ai/grok-4.1-fast', {
 *   inputTokens: 1200,
 *   outputTokens: 400,
 * });
 * // cost = 0.00024 + 0.00024 = 0.00048 USD
 * ```
 */
export function estimateCost(model: string, usage: TokenUsageForCost): number {
  const pricing = getModelPricing(model);

  // Calculate input cost (subtract cached tokens if available)
  const nonCachedInputTokens = usage.cachedTokens
    ? Math.max(0, usage.inputTokens - usage.cachedTokens)
    : usage.inputTokens;

  const inputCost = (nonCachedInputTokens * pricing.inputPerMillion) / 1_000_000;
  const outputCost = (usage.outputTokens * pricing.outputPerMillion) / 1_000_000;

  // Add cached token cost if applicable
  const cachedCost =
    usage.cachedTokens && pricing.cachedPerMillion
      ? (usage.cachedTokens * pricing.cachedPerMillion) / 1_000_000
      : 0;

  return inputCost + outputCost + cachedCost;
}

/**
 * Format cost for display
 *
 * @param cost - Cost in USD
 * @returns Formatted string (e.g., '$0.0042', '<$0.0001')
 */
export function formatCost(cost: number): string {
  if (cost === 0) {
    return '$0';
  }
  if (cost < 0.0001) {
    return '<$0.0001';
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(3)}`;
}
