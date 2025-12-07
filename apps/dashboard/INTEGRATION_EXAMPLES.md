# Chart Components Integration Examples

Complete, production-ready examples for integrating chart components into the dashboard.

## Example 1: Full Dashboard Page

```typescript
// app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  OverviewCards,
  TokenUsageChart,
  PlatformDistribution,
  AgentPerformanceChart,
  RecentEventsTable,
  QuickStats,
  mockKPICards,
  mockTokenTimeline,
  mockPlatformDistribution,
  mockAgentPerformance,
  mockRecentEvents,
} from '@duyetbot/dashboard';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-500">Welcome back! Here's your system overview.</p>
      </div>

      {/* KPI Cards */}
      <OverviewCards cards={mockKPICards} loading={loading} />

      {/* Main Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <TokenUsageChart data={mockTokenTimeline} loading={loading} />
        <PlatformDistribution data={mockPlatformDistribution} loading={loading} />
      </div>

      {/* Performance */}
      <AgentPerformanceChart data={mockAgentPerformance} loading={loading} />

      {/* Recent Activity */}
      <RecentEventsTable events={mockRecentEvents} loading={loading} />

      {/* Quick Stats */}
      <QuickStats
        stats={[
          { label: 'Total Messages', value: '8,959' },
          { label: 'Active Sessions', value: '12' },
          { label: 'System Health', value: '99.9%' },
        ]}
        loading={loading}
      />
    </div>
  );
}
```

## Example 2: Token Analytics Page

```typescript
// app/tokens/page.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  TokenSummaryCards,
  TokenTrendChart,
  TokenByModelChart,
  TokenByAgentChart,
  TokenHeatmap,
  mockTokenSummary,
  mockTokenTimeline,
  mockTokenByModel,
  mockTokenByAgent,
  mockTokenHeatmap,
} from '@duyetbot/dashboard';

export default function TokensPage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, [timeRange]);

  return (
    <div className="space-y-6 p-6">
      {/* Header with Filter */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Token Analytics</h1>
          <p className="text-gray-500">Monitor your token usage and costs</p>
        </div>

        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="year">Last Year</option>
        </select>
      </div>

      {/* Summary Cards */}
      <TokenSummaryCards summary={mockTokenSummary} loading={loading} />

      {/* Trends */}
      <TokenTrendChart
        data={mockTokenTimeline}
        loading={loading}
        title={`Token Usage (${timeRange})`}
      />

      {/* Breakdown by Model and Agent */}
      <div className="grid gap-6 md:grid-cols-2">
        <TokenByModelChart data={mockTokenByModel} loading={loading} />
        <TokenByAgentChart data={mockTokenByAgent} loading={loading} />
      </div>

      {/* Activity Heatmap */}
      <TokenHeatmap data={mockTokenHeatmap} loading={loading} />
    </div>
  );
}
```

## Example 3: Agent Trace Viewer

```typescript
// app/events/[traceId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { AgentTraceView, mockAgentTrace } from '@duyetbot/dashboard';

interface TracePageProps {
  params: {
    traceId: string;
  };
}

export default function TracePage({ params }: TracePageProps) {
  const [trace, setTrace] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch trace data
    const fetchTrace = async () => {
      try {
        // const response = await fetch(`/api/traces/${params.traceId}`);
        // const data = await response.json();
        // setTrace(data);

        // Using mock data for demo
        setTrace(mockAgentTrace);
      } finally {
        setLoading(false);
      }
    };

    fetchTrace();
  }, [params.traceId]);

  if (!trace) return <div>Loading...</div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Execution Trace</h1>
        <p className="text-gray-500">View detailed agent execution information</p>
      </div>

      <AgentTraceView trace={trace} loading={loading} />

      {/* Related Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="font-semibold">Properties</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Trace ID</dt>
              <dd className="font-mono">{trace.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Total Duration</dt>
              <dd>{trace.totalDuration}ms</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Total Tokens</dt>
              <dd>{trace.totalTokens.toLocaleString()}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="font-semibold">Timing</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Started</dt>
              <dd>{trace.startTime.toLocaleTimeString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Completed</dt>
              <dd>{trace.endTime?.toLocaleTimeString() || 'N/A'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
```

## Example 4: Real-time Updates with React Query

```typescript
// hooks/useTokenMetrics.ts
import { useQuery } from '@tanstack/react-query';
import { TokenUsageData, TokenSummary } from '@duyetbot/dashboard';

export function useTokenMetrics() {
  return useQuery({
    queryKey: ['token-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/metrics/tokens');
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

// Usage in component
'use client';

import { useTokenMetrics } from '@/hooks/useTokenMetrics';
import { TokenTrendChart } from '@duyetbot/dashboard';

export function TokenDashboard() {
  const { data, isLoading } = useTokenMetrics();

  return (
    <TokenTrendChart
      data={data?.timeline || []}
      loading={isLoading}
    />
  );
}
```

## Example 5: Custom Chart with Formatters

```typescript
'use client';

import { LineChart, chartColors } from '@duyetbot/dashboard';

interface PerformanceData {
  timestamp: number;
  responseTime: number;
  throughput: number;
}

export function PerformanceChart({ data }: { data: PerformanceData[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold">API Performance</h2>

      <LineChart
        data={data}
        xKey="timestamp"
        yKeys={[
          {
            key: 'responseTime',
            color: chartColors.input,
            name: 'Response Time (ms)',
          },
          {
            key: 'throughput',
            color: chartColors.output,
            name: 'Throughput (req/s)',
          },
        ]}
        height={400}
        xAxisFormatter={(timestamp) => {
          const date = new Date(timestamp);
          return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
        }}
        yAxisFormatter={(value) => {
          if (value >= 1000) {
            return `${(value / 1000).toFixed(1)}k`;
          }
          return String(value);
        }}
      />
    </div>
  );
}
```

## Example 6: Responsive Dashboard Grid

```typescript
'use client';

import { ReactNode } from 'react';

interface DashboardCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}

function DashboardCard({ title, description, children }: DashboardCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </div>
  );
}

// Usage
export function AnalyticsDashboard() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Analytics</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Token Usage"
          description="Last 30 days"
        >
          <TokenTrendChart data={mockTokenTimeline} />
        </DashboardCard>

        <DashboardCard
          title="Platform Distribution"
          description="Message distribution"
        >
          <PlatformDistribution data={mockPlatformDistribution} />
        </DashboardCard>

        <DashboardCard
          title="Agent Performance"
          description="Success rates"
        >
          <AgentPerformanceChart data={mockAgentPerformance} />
        </DashboardCard>
      </div>
    </div>
  );
}
```

## Example 7: Theme Switching

```typescript
'use client';

import { useState } from 'react';
import { OverviewCards, mockKPICards } from '@duyetbot/dashboard';

export function ThemeSwitcher() {
  const [isDark, setIsDark] = useState(false);

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="bg-white p-6 dark:bg-gray-900">
        <button
          onClick={() => setIsDark(!isDark)}
          className="mb-6 rounded bg-blue-500 px-4 py-2 text-white"
        >
          Toggle {isDark ? 'Light' : 'Dark'} Mode
        </button>

        <OverviewCards cards={mockKPICards} />
      </div>
    </div>
  );
}
```

## Example 8: Data Filtering with State

```typescript
'use client';

import { useState } from 'react';
import {
  AgentPerformanceChart,
  AgentPerformanceData,
  mockAgentPerformance,
} from '@duyetbot/dashboard';

export function FilteredAgentChart() {
  const [minSuccessRate, setMinSuccessRate] = useState(80);

  const filteredData = mockAgentPerformance.filter(
    (agent) => agent.successRate >= minSuccessRate
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium">
          Minimum Success Rate: {minSuccessRate}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={minSuccessRate}
          onChange={(e) => setMinSuccessRate(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <AgentPerformanceChart data={filteredData} />
    </div>
  );
}
```

## Example 9: Export Chart as Image

```typescript
'use client';

import { useRef } from 'react';
import html2canvas from 'html2canvas';
import { TokenUsageChart, mockTokenTimeline } from '@duyetbot/dashboard';

export function ExportableChart() {
  const chartRef = useRef<HTMLDivElement>(null);

  const exportChart = async () => {
    if (!chartRef.current) return;

    const canvas = await html2canvas(chartRef.current);
    const link = document.createElement('a');
    link.href = canvas.toDataURL();
    link.download = 'token-usage-chart.png';
    link.click();
  };

  return (
    <div className="space-y-4">
      <button
        onClick={exportChart}
        className="rounded bg-blue-500 px-4 py-2 text-white"
      >
        Export as PNG
      </button>

      <div ref={chartRef} className="rounded-lg border border-gray-200 p-6">
        <h2 className="mb-4 text-lg font-semibold">Token Usage</h2>
        <TokenUsageChart data={mockTokenTimeline} />
      </div>
    </div>
  );
}
```

## Example 10: Comparison Dashboard

```typescript
'use client';

import { useState } from 'react';
import { LineChart, chartColors } from '@duyetbot/dashboard';

interface ComparisonData {
  date: string;
  baseline: number;
  current: number;
}

export function ComparisonChart({ data }: { data: ComparisonData[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Performance Comparison</h2>

      <LineChart
        data={data}
        xKey="date"
        yKeys={[
          {
            key: 'baseline',
            color: chartColors.neutral,
            name: 'Baseline',
            dashed: true,
          },
          {
            key: 'current',
            color: chartColors.success,
            name: 'Current',
          },
        ]}
        height={400}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-gray-200 p-4">
          <h3 className="font-semibold">Summary</h3>
          <p className="mt-2 text-sm text-gray-600">
            Current performance shows improvement over baseline metrics.
          </p>
        </div>

        <div className="rounded border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
          <h3 className="font-semibold text-green-900 dark:text-green-200">
            Improvement
          </h3>
          <p className="mt-2 text-sm text-green-800 dark:text-green-300">
            12% better than baseline
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## Integration Checklist

- [ ] Import required components
- [ ] Provide data in correct format
- [ ] Set loading states
- [ ] Configure formatters if needed
- [ ] Apply custom styling/layout
- [ ] Test dark mode
- [ ] Test responsive behavior
- [ ] Add error boundaries
- [ ] Implement data fetching
- [ ] Add TypeScript types

## Common Props Patterns

All components support:
- `loading?: boolean` - Show loading state
- `height?: number` - Override height (px)
- `className?: string` - Additional CSS classes

Formatters return strings:
- `xAxisFormatter?: (value) => string`
- `yAxisFormatter?: (value) => string`

---

**Last Updated**: 2024-12-07
