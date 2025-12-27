/**
 * Worker-specific AI provider functions
 * Uses Hono context directly instead of getCloudflareContext
 */

import { createOpenAI } from "@ai-sdk/openai";
import {
	customProvider,
	extractReasoningMiddleware,
	wrapLanguageModel,
} from "ai";
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
