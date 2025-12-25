import type { SubAgentId } from './constants';

export interface QuickAction {
  id: string;
  label: string;
  icon: string; // Lucide icon name
  prompt: string;
  category: 'general' | 'research' | 'creative' | 'technical' | 'productivity';
  modeFilter?: 'chat' | 'agent';
  agentFilter?: SubAgentId;
}

// Chat mode quick actions
export const CHAT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'ai-slides',
    label: 'AI Slides',
    icon: 'Presentation',
    prompt: 'Help me create a presentation about ',
    category: 'creative',
    modeFilter: 'chat',
  },
  {
    id: 'full-stack',
    label: 'Full-Stack',
    icon: 'Layers',
    prompt: 'I need help building a full-stack application that ',
    category: 'technical',
    modeFilter: 'chat',
  },
  {
    id: 'magic-design',
    label: 'Magic Design',
    icon: 'Wand2',
    prompt: 'Design a user interface for ',
    category: 'creative',
    modeFilter: 'chat',
  },
  {
    id: 'write-code',
    label: 'Write Code',
    icon: 'Code',
    prompt: 'Write code to ',
    category: 'technical',
    modeFilter: 'chat',
  },
  {
    id: 'deep-research',
    label: 'Deep Research',
    icon: 'Search',
    prompt: 'Research and provide a comprehensive analysis of ',
    category: 'research',
    modeFilter: 'chat',
  },
];

// Agent mode quick actions (general)
export const AGENT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'schedules',
    label: 'Schedules',
    icon: 'Calendar',
    prompt: 'Help me schedule and organize ',
    category: 'productivity',
    modeFilter: 'agent',
  },
  {
    id: 'websites',
    label: 'Websites',
    icon: 'Globe',
    prompt: 'Create a website for ',
    category: 'technical',
    modeFilter: 'agent',
  },
  {
    id: 'research',
    label: 'Research',
    icon: 'BookOpen',
    prompt: 'Research and analyze ',
    category: 'research',
    modeFilter: 'agent',
  },
  {
    id: 'videos',
    label: 'Videos',
    icon: 'Video',
    prompt: 'Help me create a video about ',
    category: 'creative',
    modeFilter: 'agent',
  },
];

// Researcher agent specific actions
export const RESEARCHER_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'investment-analysis',
    label: 'Investment Analysis',
    icon: 'TrendingUp',
    prompt:
      'I currently have $100,000 and aim for a 10% annual return. Based on current macroeconomic data and financial analysis, recommend an investment strategy.',
    category: 'research',
    agentFilter: 'researcher',
  },
  {
    id: 'opensource-inference',
    label: 'Open-source Inference',
    icon: 'Cpu',
    prompt:
      'Provide a comprehensive overview of the current open-source inference ecosystem. What are the mainstream frameworks, their pros and cons?',
    category: 'research',
    agentFilter: 'researcher',
  },
  {
    id: 'market-expansion',
    label: 'Market Research',
    icon: 'Map',
    prompt:
      "Research Temu's path of expansion in overseas markets, summarize the key factors behind its success, and analyze future challenges.",
    category: 'research',
    agentFilter: 'researcher',
  },
  {
    id: 'literature-review',
    label: 'Literature Review',
    icon: 'FileText',
    prompt:
      "Write a literature review on 'Analyzing the Relationship between Construction Economics and Real Estate Markets'.",
    category: 'research',
    agentFilter: 'researcher',
  },
  {
    id: 'product-analysis',
    label: 'Product Analysis',
    icon: 'Box',
    prompt:
      'I plan to develop an AI 3D modeling tool tailored for beginners. Analyze the target user personas and the competitive landscape.',
    category: 'research',
    agentFilter: 'researcher',
  },
];

// Analyst agent specific actions
export const ANALYST_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'data-analysis',
    label: 'Data Analysis',
    icon: 'BarChart3',
    prompt: 'Analyze the following data and provide insights: ',
    category: 'research',
    agentFilter: 'analyst',
  },
  {
    id: 'calculations',
    label: 'Calculations',
    icon: 'Calculator',
    prompt: 'Calculate and explain ',
    category: 'technical',
    agentFilter: 'analyst',
  },
  {
    id: 'metrics',
    label: 'Metrics Review',
    icon: 'Activity',
    prompt: 'Review and analyze these metrics: ',
    category: 'research',
    agentFilter: 'analyst',
  },
  {
    id: 'forecast',
    label: 'Forecast',
    icon: 'LineChart',
    prompt: 'Create a forecast for ',
    category: 'research',
    agentFilter: 'analyst',
  },
];

/**
 * Get quick actions based on mode and selected agent
 */
export function getQuickActions(mode: 'chat' | 'agent', subAgentId?: SubAgentId): QuickAction[] {
  if (mode === 'chat') {
    return CHAT_QUICK_ACTIONS;
  }

  // Agent mode - return agent-specific actions if available
  switch (subAgentId) {
    case 'researcher':
      return RESEARCHER_QUICK_ACTIONS;
    case 'analyst':
      return ANALYST_QUICK_ACTIONS;
    default:
      return AGENT_QUICK_ACTIONS;
  }
}
