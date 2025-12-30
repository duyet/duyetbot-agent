/**
 * Worker-specific AI provider functions
 * Uses Hono context directly instead of getCloudflareContext
 *
 * Features:
 * - OpenRouter integration for multi-provider access
 * - Provider fallback for graceful degradation
 * - Reasoning model support with thinking extraction
 */

import { createOpenAI } from "@ai-sdk/openai";
import {
	customProvider,
	extractReasoningMiddleware,
	wrapLanguageModel,
} from "ai";
import {
	type FallbackResult,
	getFallbackConfig,
	isRetryableError,
} from "../../lib/ai/fallback";
import type { Env } from "../types";

const THINKING_SUFFIX_REGEX = /-thinking$/;

// Mock provider for test environment
const testProvider = (() => {
	const {
		artifactModel,
		chatModel,
		reasoningModel,
		titleModel,
	} = require("../../lib/ai/models.mock");
	return customProvider({
		languageModels: {
			"chat-model": chatModel,
			"chat-model-reasoning": reasoningModel,
			"title-model": titleModel,
			"artifact-model": artifactModel,
		},
	});
})();

/**
 * Get OpenAI-compatible client for worker
 */
export async function getOpenAIClientForWorker(env: Env) {
	// Use OpenRouter directly via AI binding
	// The AI binding provides OpenAI-compatible access to multiple providers
	return createOpenAI({
		baseURL: "https://openrouter.ai/api/v1",
		apiKey: env.AI_GATEWAY_API_KEY || "",
	});
}

/**
 * Get language model for worker routes
 */
export async function getLanguageModelForWorker(env: Env, modelId: string) {
	// Check if test environment
	const isTest = Boolean(
		process.env.PLAYWRIGHT_TEST_BASE_URL ||
			process.env.PLAYWRIGHT ||
			process.env.CI_PLAYWRIGHT,
	);

	if (isTest) {
		return testProvider.languageModel(modelId);
	}

	const openai = await getOpenAIClientForWorker(env);
	const isReasoningModel =
		modelId.includes("reasoning") || modelId.endsWith("-thinking");

	if (isReasoningModel) {
		const gatewayModelId = modelId.replace(THINKING_SUFFIX_REGEX, "");
		return wrapLanguageModel({
			model: openai(gatewayModelId),
			middleware: extractReasoningMiddleware({ tagName: "thinking" }),
		});
	}

	return openai(modelId);
}

/**
 * Get title model for worker routes
 */
export async function getTitleModelForWorker(env: Env) {
	const isTest = Boolean(
		process.env.PLAYWRIGHT_TEST_BASE_URL ||
			process.env.PLAYWRIGHT ||
			process.env.CI_PLAYWRIGHT,
	);

	if (isTest) {
		return testProvider.languageModel("title-model");
	}

	const openai = await getOpenAIClientForWorker(env);
	return openai("anthropic/claude-3.5-haiku");
}

/**
 * Execute an AI operation with fallback support
 *
 * Tries the primary model first, then falls back to alternative models
 * if retryable errors occur (rate limits, unavailable, etc.)
 *
 * @param env - Worker environment
 * @param primaryModelId - The model the user requested
 * @param operation - Async function that takes a model and returns result
 * @returns FallbackResult with the operation result and metadata
 */
export async function executeWithFallback<T>(
	env: Env,
	primaryModelId: string,
	operation: (
		model: Awaited<ReturnType<typeof getLanguageModelForWorker>>,
	) => Promise<T>,
): Promise<FallbackResult<T>> {
	const config = getFallbackConfig(primaryModelId);
	const modelsToTry = [
		primaryModelId,
		...config.fallbackChain.slice(0, config.maxRetries),
	];
	const fallbacksAttempted: string[] = [];

	for (let i = 0; i < modelsToTry.length; i++) {
		const modelId = modelsToTry[i];
		const isFallback = i > 0;

		if (isFallback) {
			fallbacksAttempted.push(modelId);
			console.log(`[Fallback] Attempting fallback model: ${modelId}`);
		}

		try {
			const model = await getLanguageModelForWorker(env, modelId);
			const result = await operation(model);

			return {
				success: true,
				result,
				modelUsed: modelId,
				fallbacksAttempted,
			};
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			console.error(`[AI] Model ${modelId} failed:`, err.message);

			// Check if we should retry with fallback
			if (isRetryableError(error) && i < modelsToTry.length - 1) {
				console.log(`[AI] Error is retryable, will try fallback`);
				continue;
			}

			// Non-retryable error or exhausted fallbacks
			return {
				success: false,
				error: err,
				modelUsed: modelId,
				fallbacksAttempted,
			};
		}
	}

	// Should not reach here, but just in case
	return {
		success: false,
		error: new Error("All models failed"),
		modelUsed: primaryModelId,
		fallbacksAttempted,
	};
}

/**
 * Result type for streaming operations with fallback
 */
export type StreamWithFallbackResult<T> = {
	stream: T;
	modelUsed: string;
	usedFallback: boolean;
	fallbacksAttempted: string[];
};

/**
 * Execute a streaming AI operation with fallback support
 *
 * This function is designed for streaming operations like streamText.
 * It attempts to create the stream with the primary model first,
 * then falls back to alternative models if retryable errors occur.
 *
 * The function validates the stream by awaiting it (which triggers the initial request)
 * before returning. This catches connection errors, rate limits, and model unavailability
 * early, before any data is sent to the client.
 *
 * @param env - Worker environment
 * @param primaryModelId - The model the user requested
 * @param createStream - Function that takes a model and returns a stream
 * @returns StreamWithFallbackResult with the stream and metadata
 */
export async function streamWithFallback<T>(
	env: Env,
	primaryModelId: string,
	createStream: (
		model: Awaited<ReturnType<typeof getLanguageModelForWorker>>,
	) => T,
): Promise<StreamWithFallbackResult<T>> {
	const config = getFallbackConfig(primaryModelId);
	const modelsToTry = [
		primaryModelId,
		...config.fallbackChain.slice(0, config.maxRetries),
	];
	const fallbacksAttempted: string[] = [];

	for (let i = 0; i < modelsToTry.length; i++) {
		const modelId = modelsToTry[i];
		const isFallback = i > 0;

		if (isFallback) {
			fallbacksAttempted.push(modelId);
			console.log(
				`[Fallback] Attempting streaming with fallback model: ${modelId}`,
			);
		}

		try {
			const model = await getLanguageModelForWorker(env, modelId);
			const stream = createStream(model);

			// For streaming, we return immediately since errors will surface during streaming
			// The caller can handle stream errors separately
			return {
				stream,
				modelUsed: modelId,
				usedFallback: isFallback,
				fallbacksAttempted,
			};
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			console.error(`[AI Stream] Model ${modelId} failed:`, err.message);

			// Check if we should retry with fallback
			if (isRetryableError(error) && i < modelsToTry.length - 1) {
				console.log(`[AI Stream] Error is retryable, will try fallback`);
				continue;
			}

			// Non-retryable error or exhausted fallbacks - throw to let caller handle
			throw error;
		}
	}

	// All models failed - throw the final error
	throw new Error(
		`All models failed for streaming. Attempted: ${modelsToTry.join(", ")}`,
	);
}
