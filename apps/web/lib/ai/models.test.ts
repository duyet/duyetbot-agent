import { describe, expect, it } from "vitest";
import {
	type ChatModel,
	chatModels,
	DEFAULT_CHAT_MODEL,
	DEFAULT_CONTEXT_WINDOWS,
	getContextWindow,
	modelsByProvider,
} from "./models";

describe("ai/models", () => {
	describe("DEFAULT_CHAT_MODEL", () => {
		it("should be a valid model ID", () => {
			expect(DEFAULT_CHAT_MODEL).toBe("google/gemini-2.5-flash-preview");
		});

		it("should exist in chatModels array", () => {
			const model = chatModels.find((m) => m.id === DEFAULT_CHAT_MODEL);
			expect(model).toBeDefined();
		});
	});

	describe("DEFAULT_CONTEXT_WINDOWS", () => {
		it("should have context windows for major providers", () => {
			expect(DEFAULT_CONTEXT_WINDOWS.anthropic).toBe(200_000);
			expect(DEFAULT_CONTEXT_WINDOWS.openai).toBe(128_000);
			expect(DEFAULT_CONTEXT_WINDOWS.google).toBe(1_000_000);
			expect(DEFAULT_CONTEXT_WINDOWS.xai).toBe(131_072);
			expect(DEFAULT_CONTEXT_WINDOWS.deepseek).toBe(64_000);
			expect(DEFAULT_CONTEXT_WINDOWS["z-ai"]).toBe(128_000);
		});

		it("should have numeric values for all providers", () => {
			for (const [_provider, contextWindow] of Object.entries(
				DEFAULT_CONTEXT_WINDOWS,
			)) {
				expect(typeof contextWindow).toBe("number");
				expect(contextWindow).toBeGreaterThan(0);
			}
		});
	});

	describe("getContextWindow", () => {
		it("should return explicit context window for model with one defined", () => {
			const contextWindow = getContextWindow("google/gemini-2.5-flash-preview");
			expect(contextWindow).toBe(1_000_000);
		});

		it("should return provider default for model without explicit context window", () => {
			const contextWindow = getContextWindow("anthropic/claude-3.5-haiku");
			expect(contextWindow).toBe(200_000);
		});

		it("should return provider default for openai models", () => {
			const contextWindow = getContextWindow("openai/gpt-4o");
			expect(contextWindow).toBe(128_000);
		});

		it("should return fallback for unknown provider", () => {
			const contextWindow = getContextWindow("unknown-provider/some-model");
			expect(contextWindow).toBe(128_000);
		});

		it("should handle model IDs without slash", () => {
			const contextWindow = getContextWindow("malformed-id");
			expect(contextWindow).toBe(128_000);
		});

		it("should return z-ai context window correctly", () => {
			const contextWindow = getContextWindow("z-ai/glm-4.7");
			expect(contextWindow).toBe(128_000);
		});
	});

	describe("chatModels", () => {
		it("should have at least 20 models", () => {
			expect(chatModels.length).toBeGreaterThanOrEqual(20);
		});

		it("should have required fields for all models", () => {
			for (const model of chatModels) {
				expect(model.id).toBeDefined();
				expect(model.id.length).toBeGreaterThan(0);
				expect(model.name).toBeDefined();
				expect(model.name.length).toBeGreaterThan(0);
				expect(model.provider).toBeDefined();
				expect(model.provider.length).toBeGreaterThan(0);
				expect(model.description).toBeDefined();
				expect(model.description.length).toBeGreaterThan(0);
			}
		});

		it("should have unique model IDs", () => {
			const ids = chatModels.map((m) => m.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(ids.length);
		});

		it("should have models from multiple providers", () => {
			const providers = new Set(chatModels.map((m) => m.provider));
			expect(providers.size).toBeGreaterThanOrEqual(5);
		});

		it("should include Anthropic Claude models", () => {
			const anthropicModels = chatModels.filter(
				(m) => m.provider === "anthropic",
			);
			expect(anthropicModels.length).toBeGreaterThanOrEqual(3);
			expect(anthropicModels.some((m) => m.name.includes("Claude"))).toBe(true);
		});

		it("should include OpenAI GPT models", () => {
			const openaiModels = chatModels.filter((m) => m.provider === "openai");
			expect(openaiModels.length).toBeGreaterThanOrEqual(3);
			expect(openaiModels.some((m) => m.name.includes("GPT"))).toBe(true);
		});

		it("should include Google Gemini models", () => {
			const googleModels = chatModels.filter((m) => m.provider === "google");
			expect(googleModels.length).toBeGreaterThanOrEqual(2);
			expect(googleModels.some((m) => m.name.includes("Gemini"))).toBe(true);
		});

		it("should have context window for Gemini models", () => {
			const geminiModels = chatModels.filter((m) => m.provider === "google");
			for (const model of geminiModels) {
				expect(model.contextWindow).toBe(1_000_000);
			}
		});
	});

	describe("modelsByProvider", () => {
		it("should group models by provider", () => {
			expect(modelsByProvider.anthropic).toBeDefined();
			expect(modelsByProvider.openai).toBeDefined();
			expect(modelsByProvider.google).toBeDefined();
		});

		it("should have correct models in each provider group", () => {
			for (const [provider, models] of Object.entries(modelsByProvider)) {
				for (const model of models) {
					expect(model.provider).toBe(provider);
				}
			}
		});

		it("should include all models from chatModels", () => {
			const totalModelsInGroups = Object.values(modelsByProvider).reduce(
				(sum, models) => sum + models.length,
				0,
			);
			expect(totalModelsInGroups).toBe(chatModels.length);
		});

		it("should have reasoning provider for thinking models", () => {
			expect(modelsByProvider.reasoning).toBeDefined();
			const reasoningModels = modelsByProvider.reasoning;
			expect(reasoningModels.length).toBeGreaterThanOrEqual(1);
			expect(
				reasoningModels.every(
					(m) =>
						m.id.includes("thinking") || m.description.includes("reasoning"),
				),
			).toBe(true);
		});
	});

	describe("ChatModel type", () => {
		it("should allow optional contextWindow", () => {
			const modelWithContext: ChatModel = {
				id: "test/model",
				name: "Test Model",
				provider: "test",
				description: "Test description",
				contextWindow: 100_000,
			};

			const modelWithoutContext: ChatModel = {
				id: "test/model2",
				name: "Test Model 2",
				provider: "test",
				description: "Test description 2",
			};

			expect(modelWithContext.contextWindow).toBe(100_000);
			expect(modelWithoutContext.contextWindow).toBeUndefined();
		});
	});

	describe("model ID format", () => {
		it("should follow provider/model-name format", () => {
			for (const model of chatModels) {
				expect(model.id).toMatch(/^[a-z0-9-]+\/[a-z0-9.-]+$/);
			}
		});

		it("should have provider prefix matching provider field", () => {
			for (const model of chatModels) {
				const idProvider = model.id.split("/")[0];
				// Some models like x-ai use different ID prefixes
				if (model.provider === "xai") {
					expect(idProvider).toBe("x-ai");
				} else if (model.provider === "reasoning") {
					// Reasoning models use their original provider prefix
					expect(["anthropic", "openai", "deepseek"]).toContain(idProvider);
				} else if (model.provider === "meta") {
					expect(idProvider).toBe("meta-llama");
				} else {
					expect(idProvider).toBe(model.provider);
				}
			}
		});
	});
});
