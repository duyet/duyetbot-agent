// OpenRouter models via Cloudflare AI Gateway
export const DEFAULT_CHAT_MODEL = "xiaomi/mimo-v2-flash:free";

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  tier?: "free" | "paid" | "premium";
};

export const chatModels: ChatModel[] = [
  // OpenRouter - Free Tier
  {
    id: "xiaomi/mimo-v2-flash:free",
    name: "Mimo Flash Free",
    provider: "openrouter",
    description: "Fast and free AI model (public beta)",
    tier: "free",
  },
  {
    id: "google/gemma-3-4b-it:free",
    name: "Gemma 3 4B",
    provider: "openrouter",
    description: "Google's lightweight free model",
    tier: "free",
  },

  // OpenRouter - Paid Tier
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openrouter",
    description: "OpenAI's efficient small model",
    tier: "paid",
  },
  {
    id: "anthropic/claude-3-haiku",
    name: "Claude 3 Haiku",
    provider: "openrouter",
    description: "Anthropic's fast and compact model",
    tier: "paid",
  },

  // OpenRouter - Premium Tier
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "openrouter",
    description: "Anthropic's most capable model",
    tier: "premium",
  },
];

// Group models by tier for UI
export const modelsByTier = chatModels.reduce(
  (acc, model) => {
    const tier = model.tier || "paid";
    if (!acc[tier]) {
      acc[tier] = [];
    }
    acc[tier].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);

// Group models by provider for UI
export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
