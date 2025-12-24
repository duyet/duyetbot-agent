/**
 * Chat constants for client-side components
 */

export const COMMON_MODELS = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
  },
] as const;

export const DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';

export function isFreeModel(modelId: string): boolean {
  return modelId === 'anthropic/claude-3.5-haiku' || modelId === 'openai/gpt-4o-mini';
}

export const AVAILABLE_TOOLS = [
  {
    id: 'currentTime',
    name: 'Current Time',
    description: 'Get the current time in a specific timezone',
  },
  {
    id: 'webSearch',
    name: 'Web Search',
    description: 'Search the web for current information',
  },
  {
    id: 'calculator',
    name: 'Calculator',
    description: 'Perform mathematical calculations',
  },
  {
    id: 'dateMath',
    name: 'Date Math',
    description: 'Perform date and time calculations',
  },
  {
    id: 'weather',
    name: 'Weather',
    description: 'Get current weather information for a location',
  },
] as const;

export type ToolId = typeof AVAILABLE_TOOLS[number]['id'];

export const SUB_AGENTS = [
  {
    id: 'default',
    name: 'Default Chat',
    description: 'General-purpose chat agent',
    category: 'custom' as const,
    tools: [] as const,
    systemPrompt: 'You are a helpful AI assistant.',
  },
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Agent for research and information gathering',
    category: 'research' as const,
    tools: ['webSearch', 'currentTime'] as const,
    systemPrompt: 'You are a research assistant focused on gathering and analyzing information.',
  },
  {
    id: 'analyst',
    name: 'Data Analyst',
    description: 'Agent for calculations and data analysis',
    category: 'analysis' as const,
    tools: ['calculator', 'dateMath'] as const,
    systemPrompt: 'You are a data analyst focused on calculations and numerical analysis.',
  },
] as const;

export type SubAgentId = typeof SUB_AGENTS[number]['id'];

export type AgentCategory = typeof SUB_AGENTS[number]['category'];

export type SubAgentConfig = typeof SUB_AGENTS[number];

export function getDefaultSubAgent(): SubAgentConfig {
  return SUB_AGENTS[0];
}
