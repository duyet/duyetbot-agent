// Constants and data for homepage architecture diagram

import type { AgentData, ConnectionData, PlatformData, TechStackItem, UseCaseData } from './types';

// Agent definitions with metadata
export const AGENTS: Record<string, AgentData> = {
  router: {
    id: 'router',
    name: 'RouterAgent',
    shortName: 'Router',
    role: 'Hybrid Classifier',
    description: 'Pattern match + LLM classification for intelligent query routing',
    triggers: ['All incoming messages'],
    routesTo: ['simple', 'orchestrator', 'hitl', 'lead-researcher', 'duyet-info'],
    color: '#a855f7', // purple-500
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/50',
    metrics: { avgLatency: '10-500ms', successRate: '99.9%' },
  },
  simple: {
    id: 'simple',
    name: 'SimpleAgent',
    shortName: 'Simple',
    role: 'Quick Responses',
    description: 'Direct LLM calls for greetings, simple Q&A, and quick tasks',
    triggers: ['Greetings', 'Simple questions', 'Low complexity'],
    color: '#22c55e', // green-500
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/50',
    metrics: { avgLatency: '100-500ms', successRate: '99.8%' },
  },
  orchestrator: {
    id: 'orchestrator',
    name: 'OrchestratorAgent',
    shortName: 'Orchestrator',
    role: 'Complex Task Planner',
    description: 'Plans complex tasks and dispatches to specialized workers',
    triggers: ['Multi-step tasks', 'Code operations', 'High complexity'],
    routesTo: ['code-worker', 'research-worker', 'github-worker'],
    color: '#3b82f6', // blue-500
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/50',
    metrics: { avgLatency: '1-5s', successRate: '98.5%' },
  },
  hitl: {
    id: 'hitl',
    name: 'HITLAgent',
    shortName: 'HITL',
    role: 'Human-in-the-Loop',
    description: 'Handles confirmations and approvals for sensitive operations',
    triggers: ['Confirmations', 'Approvals', 'Sensitive actions'],
    color: '#f97316', // orange-500
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/50',
    metrics: { avgLatency: 'User-dependent', successRate: '100%' },
  },
  'lead-researcher': {
    id: 'lead-researcher',
    name: 'LeadResearcherAgent',
    shortName: 'Researcher',
    role: 'Research Coordinator',
    description: 'Multi-agent parallel research with synthesis and validation',
    triggers: ['Research tasks', 'Comparisons', 'Deep analysis'],
    routesTo: ['research-worker'],
    color: '#06b6d4', // cyan-500
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/50',
    metrics: { avgLatency: '5-30s', successRate: '97%' },
  },
  'duyet-info': {
    id: 'duyet-info',
    name: 'DuyetInfoAgent',
    shortName: 'Info',
    role: 'Knowledge Retrieval',
    description: 'Personal knowledge lookup via MCP server',
    triggers: ['About Duyet', 'Personal info', 'Knowledge queries'],
    color: '#eab308', // yellow-500
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/50',
    metrics: { avgLatency: '50-200ms', successRate: '99.5%' },
  },
  'code-worker': {
    id: 'code-worker',
    name: 'CodeWorker',
    shortName: 'Code',
    role: 'Code Analysis',
    description: 'Stateless worker for code review and analysis',
    triggers: ['Code review', 'Analysis'],
    color: '#64748b', // slate-500
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/50',
    metrics: { avgLatency: '1-3s', successRate: '99%' },
  },
  'research-worker': {
    id: 'research-worker',
    name: 'ResearchWorker',
    shortName: 'Web',
    role: 'Web Research',
    description: 'Stateless worker for web search and synthesis',
    triggers: ['Web search', 'Synthesis'],
    color: '#64748b', // slate-500
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/50',
    metrics: { avgLatency: '2-10s', successRate: '95%' },
  },
  'github-worker': {
    id: 'github-worker',
    name: 'GitHubWorker',
    shortName: 'GitHub',
    role: 'GitHub Operations',
    description: 'Stateless worker for GitHub API operations',
    triggers: ['GitHub API', 'PR operations'],
    color: '#64748b', // slate-500
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/50',
    metrics: { avgLatency: '500ms-2s', successRate: '99%' },
  },
};

// Platform definitions
export const PLATFORMS: Record<string, PlatformData> = {
  telegram: {
    id: 'telegram',
    name: 'Telegram',
    icon: 'TG',
    color: '#0088cc',
    bgColor: 'bg-sky-500/10',
    description: 'Chat interface with message batching',
  },
  github: {
    id: 'github',
    name: 'GitHub',
    icon: 'GH',
    color: '#6e40c9',
    bgColor: 'bg-violet-500/10',
    description: '@mentions and webhook handlers',
  },
  future: {
    id: 'future',
    name: 'More...',
    icon: '...',
    color: '#6b7280',
    bgColor: 'bg-gray-500/10',
    description: 'Slack, Discord, API, CLI',
  },
};

// Use case highlights
export const USE_CASES: UseCaseData[] = [
  {
    id: 'quick-chat',
    title: 'Quick Chat',
    triggerExample: '"Hi! How are you?"',
    agentPath: ['telegram', 'router', 'simple'],
    icon: '💬',
    description: 'Instant responses for greetings and simple questions',
    platform: 'telegram',
  },
  {
    id: 'code-review',
    title: 'Code Review',
    triggerExample: '"@bot review PR #123"',
    agentPath: ['github', 'router', 'orchestrator', 'code-worker'],
    icon: '📝',
    description: 'Automated PR review with detailed feedback',
    platform: 'github',
  },
  {
    id: 'deep-research',
    title: 'Deep Research',
    triggerExample: '"Compare AI frameworks"',
    agentPath: ['telegram', 'router', 'lead-researcher', 'research-worker'],
    icon: '🔍',
    description: 'Multi-agent parallel research with synthesis',
    platform: 'telegram',
  },
  {
    id: 'confirmation',
    title: 'Safe Operations',
    triggerExample: '"Delete production logs"',
    agentPath: ['telegram', 'router', 'hitl'],
    icon: '✋',
    description: 'Human-in-the-loop for sensitive actions',
    platform: 'telegram',
  },
  {
    id: 'knowledge',
    title: 'Knowledge Lookup',
    triggerExample: '"Tell me about yourself"',
    agentPath: ['telegram', 'router', 'duyet-info'],
    icon: '📚',
    description: 'Personal knowledge via MCP server',
    platform: 'telegram',
  },
];

// Tech stack badges
export const TECH_STACK: TechStackItem[] = [
  { name: 'Cloudflare Workers', color: '#f38020', bgColor: 'bg-orange-500/10' },
  { name: 'Durable Objects', color: '#f38020', bgColor: 'bg-orange-500/10' },
  { name: 'TypeScript', color: '#3178c6', bgColor: 'bg-blue-500/10' },
  { name: 'Hono', color: '#ff5a1f', bgColor: 'bg-red-500/10' },
  { name: 'Bun', color: '#fbf0df', bgColor: 'bg-amber-500/10' },
];

// Connection definitions for the flow diagram
export const CONNECTIONS: ConnectionData[] = [
  { from: 'telegram', to: 'edge', animated: true },
  { from: 'github', to: 'edge', animated: true },
  { from: 'edge', to: 'router', animated: true },
  { from: 'router', to: 'simple' },
  { from: 'router', to: 'orchestrator' },
  { from: 'router', to: 'hitl' },
  { from: 'router', to: 'lead-researcher' },
  { from: 'router', to: 'duyet-info' },
  { from: 'orchestrator', to: 'code-worker' },
  { from: 'orchestrator', to: 'research-worker' },
  { from: 'orchestrator', to: 'github-worker' },
  { from: 'lead-researcher', to: 'research-worker' },
];

// SVG dimensions and layout
export const DIAGRAM_CONFIG = {
  viewBox: { width: 900, height: 400 },
  padding: 40,
  stageGap: 200,
  nodeSize: { sm: 32, md: 48, lg: 64 },
  stages: {
    inputs: { x: 80, width: 100 },
    edge: { x: 280, width: 140 },
    routing: { x: 500, width: 120 },
    agents: { x: 720, width: 160 },
  },
};

// Animation CSS classes (to be used with Tailwind)
export const ANIMATION_CLASSES = {
  breathe: 'animate-breathe',
  flowPulse: 'animate-flow-pulse',
  slideIn: 'animate-slide-in',
  fadeIn: 'animate-fade-in',
  glow: 'animate-glow',
};
