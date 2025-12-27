// Curated list of top models from OpenRouter
// See: https://openrouter.ai/models for full list
export const DEFAULT_CHAT_MODEL = "google/gemini-2.5-flash-preview";

export type ChatModel = {
	id: string;
	name: string;
	provider: string;
	description: string;
	contextWindow?: number; // Max context size in tokens
};

// Default context windows by provider (in tokens)
export const DEFAULT_CONTEXT_WINDOWS: Record<string, number> = {
	anthropic: 200_000, // Claude 3+ models
	openai: 128_000, // GPT-4o and newer
	google: 1_000_000, // Gemini 1.5+
	xai: 131_072, // Grok
	deepseek: 64_000, // DeepSeek
};

// Get context window for a model
export function getContextWindow(modelId: string): number {
	const model = chatModels.find((m) => m.id === modelId);
	if (model?.contextWindow) return model.contextWindow;

	// Fallback to provider defaults
	const provider = modelId.split("/")[0];
	return DEFAULT_CONTEXT_WINDOWS[provider] || 128_000;
}

export const chatModels: ChatModel[] = [
	// Anthropic - Claude family
	{
		id: "anthropic/claude-3.5-haiku",
		name: "Claude 3.5 Haiku",
		provider: "anthropic",
		description: "Fast and affordable, great for everyday tasks",
	},
	{
		id: "anthropic/claude-sonnet-4",
		name: "Claude Sonnet 4",
		provider: "anthropic",
		description: "Best balance of speed, intelligence, and cost",
	},
	{
		id: "anthropic/claude-opus-4",
		name: "Claude Opus 4",
		provider: "anthropic",
		description: "Most capable Anthropic model",
	},
	// OpenAI - GPT family
	{
		id: "openai/gpt-4o-mini",
		name: "GPT-4o Mini",
		provider: "openai",
		description: "Fast and cost-effective for simple tasks",
	},
	{
		id: "openai/gpt-4o",
		name: "GPT-4o",
		provider: "openai",
		description: "Multimodal flagship model",
	},
	{
		id: "openai/o1",
		name: "o1",
		provider: "openai",
		description: "Advanced reasoning model",
	},
	// Google - Gemini family
	{
		id: "google/gemini-2.5-flash-preview",
		name: "Gemini 2.5 Flash",
		provider: "google",
		description: "Ultra fast and affordable",
	},
	{
		id: "google/gemini-2.5-pro-preview",
		name: "Gemini 2.5 Pro",
		provider: "google",
		description: "Most capable Google model",
	},
	// xAI - Grok family
	{
		id: "x-ai/grok-3-beta",
		name: "Grok 3",
		provider: "xai",
		description: "xAI's latest flagship model",
	},
	// DeepSeek
	{
		id: "deepseek/deepseek-chat-v3-0324",
		name: "DeepSeek V3",
		provider: "deepseek",
		description: "Powerful open-weight model",
	},
	// Reasoning models (extended thinking)
	{
		id: "anthropic/claude-sonnet-4-thinking",
		name: "Claude Sonnet 4 Thinking",
		provider: "reasoning",
		description: "Extended thinking for complex problems",
	},
	{
		id: "openai/o1-thinking",
		name: "o1 Reasoning",
		provider: "reasoning",
		description: "OpenAI's best reasoning model",
	},
	{
		id: "deepseek/deepseek-reasoner-thinking",
		name: "DeepSeek R1",
		provider: "reasoning",
		description: "Open-weight reasoning model",
	},
];

// Group models by provider for UI
export const modelsByProvider = chatModels.reduce(
	(acc, model) => {
		if (!acc[model.provider]) {
			acc[model.provider] = [];
		}
		acc[model.provider].push(model);
		return acc;
	},
	{} as Record<string, ChatModel[]>,
);
