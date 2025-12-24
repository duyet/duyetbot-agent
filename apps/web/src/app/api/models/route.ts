import { NextResponse } from 'next/server';

export interface Model {
  id: string;
  name: string;
  provider: string;
  isDefault?: boolean;
}

export const DEFAULT_MODEL = 'x-ai/grok-4.1-fast';

export const COMMON_MODELS: Model[] = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
  },
  {
    id: 'x-ai/grok-4.1-fast',
    name: 'Grok 4.1 Fast',
    provider: 'xAI',
    isDefault: true,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
  },
  {
    id: 'google/gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash (Experimental)',
    provider: 'Google',
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
  },
];

/**
 * Check if model ID indicates free tier
 * OpenRouter uses :free suffix (e.g., "xiaomi/mimo-v2-flash:free")
 */
export function isFreeModel(modelId: string): boolean {
  return modelId.endsWith(':free');
}

export async function GET() {
  return NextResponse.json({
    models: COMMON_MODELS,
    defaultModel: DEFAULT_MODEL,
  });
}
