import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createOpenAI } from "@ai-sdk/openai";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

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

  // Get AI Gateway URL for OpenRouter
  const gateway = env.AI.gateway(env.AI_GATEWAY_NAME || "ai-gateway");
  const gatewayUrl = await gateway.getUrl("openrouter");

  return createOpenAI({
    baseURL: gatewayUrl,
    apiKey: env.AI_GATEWAY_API_KEY || "",
  });
}

export async function getLanguageModel(modelId: string) {
  if (isTestEnvironment) {
    return testProvider.languageModel(modelId);
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

  return openai(modelId);
}

export async function getTitleModel() {
  if (isTestEnvironment) {
    return testProvider.languageModel("title-model");
  }

  const openai = await getOpenAIClient();
  return openai("anthropic/claude-haiku-4.5");
}

export async function getArtifactModel() {
  if (isTestEnvironment) {
    return testProvider.languageModel("artifact-model");
  }

  const openai = await getOpenAIClient();
  return openai("anthropic/claude-haiku-4.5");
}
