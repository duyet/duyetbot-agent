import { createOpenAI } from "@ai-sdk/openai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
	customProvider,
	extractReasoningMiddleware,
	wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";
import { chatModels, DEFAULT_CHAT_MODEL } from "./models";

const THINKING_SUFFIX_REGEX = /-thinking$/;

// Mock provider for test environment
const testProvider = (() => {
	const {
		artifactModel,
		chatModel,
		reasoningModel,
		titleModel,
	} = require("./models.mock");
	return customProvider({
		languageModels: {
			"chat-model": chatModel,
			"chat-model-reasoning": reasoningModel,
			"title-model": titleModel,
			"artifact-model": artifactModel,
		},
	});
})();

// Get OpenAI-compatible client configured for Cloudflare AI Gateway
async function getOpenAIClient() {
	const { env } = await getCloudflareContext({ async: true });
	const envAny = env as any; // Type assertion for Cloudflare env with AI Gateway

	// Get AI Gateway URL for OpenRouter
	const gateway = envAny.AI.gateway(envAny.AI_GATEWAY_NAME || "ai-gateway");
	const gatewayUrl = await gateway.getUrl("openrouter");

	return createOpenAI({
		baseURL: gatewayUrl,
		apiKey: envAny.AI_GATEWAY_API_KEY || "",
	});
}

export async function getLanguageModel(modelId: string) {
	if (isTestEnvironment) {
		return testProvider.languageModel(modelId);
	}

	// Validate modelId exists in our configuration
	const validModel = chatModels.find((m) => m.id === modelId);
	if (!validModel) {
		console.warn(
			`[providers] Unknown model ID: ${modelId}. Falling back to default: ${DEFAULT_CHAT_MODEL}`,
		);
	}

	const openai = await getOpenAIClient();
	const isReasoningModel =
		modelId.includes("reasoning") || modelId.endsWith("-thinking");

	if (isReasoningModel) {
		const gatewayModelId = modelId.replace(THINKING_SUFFIX_REGEX, "");
		return wrapLanguageModel({
			model: openai(gatewayModelId),
			middleware: extractReasoningMiddleware({ tagName: "thinking" }),
		});
	}

	return openai(validModel ? modelId : DEFAULT_CHAT_MODEL);
}

export async function getTitleModel() {
	if (isTestEnvironment) {
		return testProvider.languageModel("title-model");
	}

	const openai = await getOpenAIClient();
	return openai("anthropic/claude-3.5-haiku");
}

export async function getArtifactModel() {
	if (isTestEnvironment) {
		return testProvider.languageModel("artifact-model");
	}

	const openai = await getOpenAIClient();
	return openai("anthropic/claude-3.5-haiku");
}
