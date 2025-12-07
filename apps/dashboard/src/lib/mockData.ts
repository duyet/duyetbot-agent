import { Clock, MessageSquare, TrendingUp, Zap } from 'lucide-react';
import {
  AgentPerformanceData,
  AgentTrace,
  KPICard,
  PlatformDistributionData,
  RecentEvent,
  TokenByAgentData,
  TokenByModelData,
  TokenHeatmapData,
  TokenSummary,
  TokenUsageData,
} from '../types';

export const mockTokenTimeline: TokenUsageData[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  return {
    date: date.toISOString().split('T')[0],
    input: Math.floor(Math.random() * 15000) + 10000,
    output: Math.floor(Math.random() * 10000) + 5000,
    cached: Math.floor(Math.random() * 3000) + 1000,
  };
});

export const mockPlatformDistribution: PlatformDistributionData[] = [
  { platform: 'telegram', count: 4523 },
  { platform: 'github', count: 2341 },
  { platform: 'api', count: 1203 },
  { platform: 'cli', count: 892 },
];

export const mockAgentPerformance: AgentPerformanceData[] = [
  {
    agent: 'router-agent',
    successRate: 98.5,
    avgDuration: 120,
    totalRuns: 2145,
  },
  {
    agent: 'simple-agent',
    successRate: 96.2,
    avgDuration: 450,
    totalRuns: 1532,
  },
  {
    agent: 'orchestrator-agent',
    successRate: 94.8,
    avgDuration: 2400,
    totalRuns: 892,
  },
  {
    agent: 'code-worker',
    successRate: 91.3,
    avgDuration: 3200,
    totalRuns: 654,
  },
  {
    agent: 'research-worker',
    successRate: 89.7,
    avgDuration: 4100,
    totalRuns: 423,
  },
];

export const mockRecentEvents: RecentEvent[] = [
  {
    id: '1',
    type: 'message',
    message: 'Telegram message processed successfully',
    timestamp: new Date(Date.now() - 2 * 60000),
    agent: 'router-agent',
    tokens: 450,
    duration: 120,
    status: 'success',
  },
  {
    id: '2',
    type: 'agent_run',
    message: 'Orchestrator agent executed task decomposition',
    timestamp: new Date(Date.now() - 5 * 60000),
    agent: 'orchestrator-agent',
    tokens: 3200,
    duration: 2400,
    status: 'success',
  },
  {
    id: '3',
    type: 'message',
    message: 'GitHub webhook processed',
    timestamp: new Date(Date.now() - 8 * 60000),
    agent: 'router-agent',
    tokens: 320,
    duration: 95,
    status: 'success',
  },
  {
    id: '4',
    type: 'error',
    message: 'Failed to process code analysis',
    timestamp: new Date(Date.now() - 12 * 60000),
    agent: 'code-worker',
    tokens: 1800,
    duration: 3200,
    status: 'error',
  },
  {
    id: '5',
    type: 'task_completion',
    message: 'Research task completed',
    timestamp: new Date(Date.now() - 25 * 60000),
    agent: 'research-worker',
    tokens: 5400,
    duration: 4100,
    status: 'success',
  },
];

export const mockTokenByModel: TokenByModelData[] = [
  { model: 'claude-opus', input: 45000, output: 32000, cached: 8000 },
  { model: 'claude-sonnet', input: 28000, output: 18000, cached: 5000 },
  { model: 'claude-haiku', input: 12000, output: 6000, cached: 2000 },
];

export const mockTokenByAgent: TokenByAgentData[] = [
  {
    agent: 'router-agent',
    input: 12000,
    output: 8000,
    cached: 2000,
  },
  {
    agent: 'orchestrator-agent',
    input: 28000,
    output: 22000,
    cached: 6000,
  },
  {
    agent: 'code-worker',
    input: 18000,
    output: 14000,
    cached: 3000,
  },
  {
    agent: 'research-worker',
    input: 22000,
    output: 18000,
    cached: 4000,
  },
];

export const mockTokenHeatmap: TokenHeatmapData[] = Array.from({ length: 7 * 24 }, (_, i) => {
  const day = Math.floor(i / 24);
  const hour = i % 24;
  // More activity during business hours
  const baseTokens = hour >= 9 && hour <= 17 ? 2000 : 500;
  return {
    day,
    hour,
    tokens: baseTokens + Math.floor(Math.random() * 1000),
  };
});

export const mockTokenSummary: TokenSummary = {
  totalInput: 85000,
  totalOutput: 56000,
  totalCached: 15000,
  totalTokens: 156000,
  estimatedCost: 0.8234,
};

export const mockAgentTrace: AgentTrace = {
  id: 'trace-2024-12-07-001',
  rootStep: {
    id: 'step-router',
    name: 'router-agent',
    duration: 2400,
    tokens: 3200,
    status: 'success',
    children: [
      {
        id: 'step-orchestrator',
        name: 'orchestrator-agent',
        duration: 2200,
        tokens: 2800,
        status: 'success',
        children: [
          {
            id: 'step-research',
            name: 'research-worker',
            duration: 1200,
            tokens: 1500,
            status: 'success',
            children: [],
          },
          {
            id: 'step-code',
            name: 'code-worker',
            duration: 800,
            tokens: 1200,
            status: 'success',
            children: [],
          },
          {
            id: 'step-github',
            name: 'github-worker',
            duration: 400,
            tokens: 800,
            status: 'success',
            children: [],
          },
        ],
      },
    ],
  },
  totalDuration: 2400,
  totalTokens: 3200,
  startTime: new Date(Date.now() - 5 * 60000),
  endTime: new Date(Date.now() - 3 * 60000),
};

export const mockKPICards: KPICard[] = [
  {
    title: 'Total Messages',
    value: '8,959',
    change: 12.5,
    changeLabel: 'vs last week',
    icon: MessageSquare,
    trend: 'up',
  },
  {
    title: 'Total Tokens',
    value: '156,000',
    change: 8.3,
    changeLabel: 'vs last week',
    icon: Zap,
    trend: 'up',
  },
  {
    title: 'Active Users',
    value: '342',
    change: -2.1,
    changeLabel: 'vs last week',
    icon: TrendingUp,
    trend: 'down',
  },
  {
    title: 'Avg Response Time',
    value: '245ms',
    change: 5.7,
    changeLabel: 'vs last week',
    icon: Clock,
    trend: 'neutral',
  },
];
