import { LucideIcon } from 'lucide-react';

// Chart data types
export interface ChartDataPoint {
  [key: string]: string | number | null;
}

export interface LineChartConfig<T extends ChartDataPoint> {
  data: T[];
  xKey: keyof T;
  yKeys: Array<{
    key: keyof T;
    color: string;
    name: string;
    dashed?: boolean;
  }>;
  height?: number;
  loading?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  xAxisFormatter?: (value: any) => string;
  yAxisFormatter?: (value: any) => string;
}

export interface BarChartConfig<T extends ChartDataPoint> {
  data: T[];
  xKey: keyof T;
  barKeys: Array<{
    key: keyof T;
    color: string;
    name: string;
  }>;
  height?: number;
  loading?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  layout?: 'vertical' | 'horizontal';
  xAxisFormatter?: (value: any) => string;
  yAxisFormatter?: (value: any) => string;
}

export interface PieChartConfig<T extends ChartDataPoint> {
  data: T[];
  dataKey: keyof T;
  nameKey: keyof T;
  height?: number;
  loading?: boolean;
  showLegend?: boolean;
  innerRadius?: number; // For donut chart
}

export interface AreaChartConfig<T extends ChartDataPoint> {
  data: T[];
  xKey: keyof T;
  areaKeys: Array<{
    key: keyof T;
    color: string;
    name: string;
    stackId?: string;
  }>;
  height?: number;
  loading?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  xAxisFormatter?: (value: any) => string;
  yAxisFormatter?: (value: any) => string;
}

// Dashboard data types
export interface KPICard {
  title: string;
  value: string | number;
  change: number; // % change
  changeLabel: string; // "vs last week"
  icon: LucideIcon;
  trend: 'up' | 'down' | 'neutral';
}

export interface TokenUsageData {
  date: string;
  input: number;
  output: number;
  cached: number;
}

export interface PlatformDistributionData {
  platform: 'telegram' | 'github' | 'cli' | 'api';
  count: number;
}

export interface AgentPerformanceData {
  agent: string;
  successRate: number;
  avgDuration: number; // milliseconds
  totalRuns: number;
}

export interface RecentEvent {
  id: string;
  type: 'message' | 'error' | 'agent_run' | 'task_completion';
  message: string;
  timestamp: Date;
  agent?: string;
  tokens?: number;
  duration?: number;
  status: 'success' | 'error' | 'pending';
}

// Token tracking types
export interface TokenSummary {
  totalInput: number;
  totalOutput: number;
  totalCached: number;
  totalTokens: number;
  estimatedCost?: number;
}

export interface TokenByModelData {
  model: string;
  input: number;
  output: number;
  cached: number;
}

export interface TokenByAgentData {
  agent: string;
  input: number;
  output: number;
  cached: number;
}

export interface TokenHeatmapData {
  hour: number; // 0-23
  day: number; // 0-6 (Sunday-Saturday)
  tokens: number;
}

// Event trace types
export interface AgentStep {
  id: string;
  name: string;
  duration: number; // milliseconds
  tokens: number;
  status: 'success' | 'error' | 'pending' | 'running';
  error?: string;
  children: AgentStep[];
}

export interface AgentTrace {
  id: string;
  rootStep: AgentStep;
  totalDuration: number;
  totalTokens: number;
  startTime: Date;
  endTime?: Date;
}

// Color palette
export const chartColors = {
  input: '#3b82f6', // blue-500
  output: '#22c55e', // green-500
  cached: '#a855f7', // purple-500
  reasoning: '#f59e0b', // amber-500
  error: '#ef4444', // red-500
  success: '#10b981', // emerald-500
  pending: '#6366f1', // indigo-500
  neutral: '#6b7280', // gray-500
} as const;

export const platformColors: Record<string, string> = {
  telegram: '#0088cc', // Telegram blue
  github: '#333333', // GitHub dark
  cli: '#10b981', // Green
  api: '#f59e0b', // Amber
};
