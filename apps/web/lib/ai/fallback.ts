/**
 * Provider Fallback Configuration
 *
 * Defines fallback chains for graceful degradation when models fail.
 * Each provider has a priority-ordered list of fallback models.
 */

export type FallbackConfig = {
	/** Primary model that was requested */
	primaryModel: string;
	/** Ordered list of fallback models to try */
	fallbackChain: string[];
	/** Maximum retries before giving up */
	maxRetries: number;
};

/**
 * Fallback chains by provider
 * When a model fails, try the next model in the chain
 */
const fallbackChains: Record<string, string[]> = {
	// Anthropic models
	anthropic: [
		"anthropic/claude-sonnet-4",
		"anthropic/claude-3.5-haiku",
		"google/gemini-2.5-flash-preview",
	],
	// OpenAI models
	openai: [
		"openai/gpt-4o",
		"openai/gpt-4o-mini",
		"google/gemini-2.5-flash-preview",
	],
	// Google models
	google: [
		"google/gemini-2.5-pro-preview",
		"google/gemini-2.5-flash-preview",
		"anthropic/claude-3.5-haiku",
	],
	// xAI models
	xai: [
		"x-ai/grok-3-beta",
		"anthropic/claude-sonnet-4",
		"google/gemini-2.5-flash-preview",
	],
	// DeepSeek models
	deepseek: [
		"deepseek/deepseek-chat-v3-0324",
		"google/gemini-2.5-flash-preview",
		"anthropic/claude-3.5-haiku",
	],
	// Reasoning models (special handling)
	reasoning: [
		"anthropic/claude-sonnet-4-thinking",
		"openai/o1-thinking",
		"deepseek/deepseek-reasoner-thinking",
	],
};

/**
 * Universal fallback used when provider-specific chain is exhausted
 */
const universalFallback = "google/gemini-2.5-flash-preview";

/**
 * Get provider from model ID
 */
export function getProviderFromModel(modelId: string): string {
	if (modelId.includes("thinking") || modelId.includes("reasoning")) {
		return "reasoning";
	}
	const provider = modelId.split("/")[0];
	// Normalize provider names
	if (provider === "x-ai") return "xai";
	return provider;
}

/**
 * Get fallback configuration for a model
 */
export function getFallbackConfig(modelId: string): FallbackConfig {
	const provider = getProviderFromModel(modelId);
	const providerChain = fallbackChains[provider] || [];

	// Build fallback chain: provider-specific models (excluding the requested one) + universal fallback
	const fallbackChain = [
		...providerChain.filter((m) => m !== modelId),
		universalFallback,
	].filter((m, i, arr) => arr.indexOf(m) === i); // Dedupe

	return {
		primaryModel: modelId,
		fallbackChain,
		maxRetries: 2, // Try up to 2 fallbacks
	};
}

/**
 * Check if an error is retryable (model unavailable vs user error)
 */
export function isRetryableError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;

	const message = error.message.toLowerCase();

	// Retryable errors - provider/model issues
	const retryablePatterns = [
		"model not available",
		"model is not available",
		"rate limit",
		"429",
		"503",
		"502",
		"500",
		"timeout",
		"econnrefused",
		"econnreset",
		"socket hang up",
		"unavailable",
		"overloaded",
		"capacity",
		"service unavailable",
	];

	// Non-retryable errors - user/client issues
	const nonRetryablePatterns = [
		"invalid api key",
		"authentication",
		"unauthorized",
		"401",
		"403",
		"content policy",
		"safety",
		"blocked",
		"context length",
		"max tokens",
	];

	// Check non-retryable first
	if (nonRetryablePatterns.some((p) => message.includes(p))) {
		return false;
	}

	// Check retryable patterns
	return retryablePatterns.some((p) => message.includes(p));
}

/**
 * Result of a fallback attempt
 */
export type FallbackResult<T> = {
	success: boolean;
	result?: T;
	error?: Error;
	modelUsed: string;
	fallbacksAttempted: string[];
};
