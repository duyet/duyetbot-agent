import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { getResponseChunksByPrompt } from "@/tests/prompts/utils";

// Note: There's a version mismatch between @ai-sdk/provider versions in the monorepo.
// The beta and stable versions have incompatible types for LanguageModelV3StreamPart.
// Using @ts-ignore since the mocks work correctly at runtime.

const mockUsage = {
	inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
	outputTokens: { total: 20, text: 20, reasoning: 0 },
};

export const chatModel = new MockLanguageModelV3({
	// @ts-ignore - Version mismatch between @ai-sdk/provider beta and stable versions
	doGenerate: async () => ({
		finishReason: "stop" as const,
		usage: mockUsage,
		content: [{ type: "text" as const, text: "Hello, world!" }],
		warnings: [],
	}),
	// @ts-ignore - Version mismatch between @ai-sdk/provider beta and stable versions
	doStream: async ({ prompt }) => ({
		stream: simulateReadableStream({
			chunkDelayInMs: 500,
			initialDelayInMs: 1000,
			chunks: getResponseChunksByPrompt(prompt),
		}),
	}),
});

export const reasoningModel = new MockLanguageModelV3({
	// @ts-ignore - Version mismatch between @ai-sdk/provider beta and stable versions
	doGenerate: async () => ({
		finishReason: "stop" as const,
		usage: mockUsage,
		content: [{ type: "text" as const, text: "Hello, world!" }],
		warnings: [],
	}),
	// @ts-ignore - Version mismatch between @ai-sdk/provider beta and stable versions
	doStream: async ({ prompt }) => ({
		stream: simulateReadableStream({
			chunkDelayInMs: 500,
			initialDelayInMs: 1000,
			chunks: getResponseChunksByPrompt(prompt, true),
		}),
	}),
});

export const titleModel = new MockLanguageModelV3({
	// @ts-ignore - Version mismatch between @ai-sdk/provider beta and stable versions
	doGenerate: async () => ({
		finishReason: "stop" as const,
		usage: mockUsage,
		content: [{ type: "text" as const, text: "This is a test title" }],
		warnings: [],
	}),
	// @ts-ignore - Version mismatch between @ai-sdk/provider beta and stable versions
	doStream: async () => ({
		stream: simulateReadableStream({
			chunkDelayInMs: 500,
			initialDelayInMs: 1000,
			chunks: [
				{ id: "1", type: "text-start" as const },
				{ id: "1", type: "text-delta" as const, delta: "This is a test title" },
				{ id: "1", type: "text-end" as const },
				{
					type: "finish" as const,
					finishReason: "stop" as const,
					usage: mockUsage,
				},
			],
		}),
	}),
});

export const artifactModel = new MockLanguageModelV3({
	// @ts-ignore - Version mismatch between @ai-sdk/provider beta and stable versions
	doGenerate: async () => ({
		finishReason: "stop" as const,
		usage: mockUsage,
		content: [{ type: "text" as const, text: "Hello, world!" }],
		warnings: [],
	}),
	// @ts-ignore - Version mismatch between @ai-sdk/provider beta and stable versions
	doStream: async ({ prompt }) => ({
		stream: simulateReadableStream({
			chunkDelayInMs: 50,
			initialDelayInMs: 100,
			chunks: getResponseChunksByPrompt(prompt),
		}),
	}),
});
