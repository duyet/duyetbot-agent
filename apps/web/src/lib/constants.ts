/**
 * Chat constants for client-side components
 */

/**
 * Model configuration for AI providers
 */
export interface ModelConfig {
  /** Unique model identifier (e.g., 'provider/model-name:variant') */
  id: string;
  /** Human-readable model name */
  name: string;
  /** AI provider name (e.g., 'xiaomi', 'x-ai', 'google', 'minimax') */
  provider: string;
}

export const COMMON_MODELS: readonly ModelConfig[] = [
  {
    id: 'xiaomi/mimo-v2-flash:free',
    name: 'MiMo v2 Flash (Free)',
    provider: 'xiaomi',
  },
  {
    id: 'x-ai/grok-4.1-fast',
    name: 'Grok 4.1 Fast',
    provider: 'x-ai',
  },
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    provider: 'google',
  },
  {
    id: 'minimax/minimax-m2.1',
    name: 'MiniMax M2.1',
    provider: 'minimax',
  },
] as const;

export const DEFAULT_MODEL = 'xiaomi/mimo-v2-flash:free';

export function isFreeModel(modelId: string): boolean {
  return modelId.endsWith(':free');
}

export const AVAILABLE_TOOLS = [
  {
    id: 'plan',
    name: 'Plan',
    description: 'Create structured plans for complex tasks',
  },
  {
    id: 'research',
    name: 'Research',
    description: 'Search the web for current information',
  },
  {
    id: 'scratchpad',
    name: 'Scratchpad',
    description: 'Store and retrieve temporary notes',
  },
] as const;

export type ToolId = (typeof AVAILABLE_TOOLS)[number]['id'];

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

export type SubAgentId = (typeof SUB_AGENTS)[number]['id'];

export type AgentCategory = (typeof SUB_AGENTS)[number]['category'];

export type SubAgentConfig = (typeof SUB_AGENTS)[number];

export function getDefaultSubAgent(): SubAgentConfig {
  return SUB_AGENTS[0];
}

/**
 * MCP Server configuration
 */
export interface McpServerConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export const MCP_SERVERS: readonly McpServerConfig[] = [
  {
    id: 'github-mcp',
    name: 'GitHub MCP',
    description: 'Access GitHub repositories and APIs',
    enabled: true,
  },
] as const;

export type McpServerId = (typeof MCP_SERVERS)[number]['id'];

/**
 * Thinking mode configuration for agent mode
 */
export type ThinkingMode = 'quick' | 'normal' | 'extended';

export interface ThinkingModeConfig {
  id: ThinkingMode;
  name: string;
  description: string;
  icon: string; // Lucide icon name
}

export const THINKING_MODES: readonly ThinkingModeConfig[] = [
  {
    id: 'quick',
    name: 'Quick',
    description: 'Fast responses with minimal reasoning',
    icon: 'Zap',
  },
  {
    id: 'normal',
    name: 'Normal',
    description: 'Balanced thinking and response time',
    icon: 'Brain',
  },
  {
    id: 'extended',
    name: 'Extended',
    description: 'Deep reasoning for complex problems',
    icon: 'Sparkles',
  },
] as const;
