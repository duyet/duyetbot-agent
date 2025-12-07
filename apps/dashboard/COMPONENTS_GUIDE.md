# Chart Components Quick Reference Guide

## Overview

The dashboard contains 27 reusable chart and visualization components organized into 4 categories. All components are:
- **Type-safe** with full TypeScript support
- **Responsive** with mobile-first design
- **Accessible** with dark mode support
- **Themeable** with Tailwind CSS

## Quick Start

### Install Dependencies
```bash
bun install
```

### Import Components
```typescript
import {
  LineChart,
  BarChart,
  PieChart,
  TokenUsageChart,
  OverviewCards,
  AgentTraceView,
  mockTokenTimeline,
  mockKPICards,
  chartColors,
} from '@duyetbot/dashboard';
```

### Basic Usage
```typescript
// Chart component
<LineChart
  data={data}
  xKey="date"
  yKeys={[{ key: 'value', color: chartColors.input, name: 'Value' }]}
  height={300}
/>

// Dashboard component
<OverviewCards cards={mockKPICards} />
```

---

## Chart Components (Generic Wrappers)

Use these for custom charts with flexible data structures.

### LineChart
Multi-line chart for time-series data.

```typescript
<LineChart
  data={data}
  xKey="date"
  yKeys={[
    { key: 'metric1', color: '#3b82f6', name: 'Metric 1' },
    { key: 'metric2', color: '#22c55e', name: 'Metric 2' },
  ]}
  height={300}
  loading={false}
  showGrid={true}
  showLegend={true}
  xAxisFormatter={(val) => new Date(val).toLocaleDateString()}
  yAxisFormatter={(val) => `${val.toLocaleString()}`}
/>
```

**Props**:
- `data: T[]` - Data points
- `xKey: keyof T` - X-axis data key
- `yKeys: Array<{key, color, name, dashed?}>` - Y-axis series
- `height?: number` - Chart height (default: 300)
- `loading?: boolean` - Show loading state
- `showGrid?: boolean` - Show grid (default: true)
- `showLegend?: boolean` - Show legend (default: true)
- `xAxisFormatter?: (value) => string` - X-axis label formatter
- `yAxisFormatter?: (value) => string` - Y-axis label formatter

### BarChart
Vertical or horizontal bar charts.

```typescript
<BarChart
  data={data}
  xKey="name"
  barKeys={[
    { key: 'value1', color: '#3b82f6', name: 'Series 1' },
    { key: 'value2', color: '#22c55e', name: 'Series 2' },
  ]}
  layout="horizontal"  // or "vertical"
  height={300}
/>
```

**Props**:
- `data: T[]` - Data points
- `xKey: keyof T` - Category key
- `barKeys: Array<{key, color, name}>` - Bar series
- `layout?: 'vertical' | 'horizontal'` - Layout direction (default: vertical)
- `height?: number` - Chart height
- `loading?: boolean` - Show loading state
- `showGrid?: boolean` - Show grid
- `showLegend?: boolean` - Show legend
- `xAxisFormatter?: (value) => string` - Formatter
- `yAxisFormatter?: (value) => string` - Formatter

### PieChart
Pie and donut charts.

```typescript
<PieChart
  data={platformData}
  dataKey="count"
  nameKey="platform"
  innerRadius={60}  // Omit for pie, include for donut
  height={300}
  colors={['#0088cc', '#333333', '#10b981', '#f59e0b']}
/>
```

**Props**:
- `data: T[]` - Data points
- `dataKey: keyof T` - Value key
- `nameKey: keyof T` - Label key
- `innerRadius?: number` - Inner radius (for donut)
- `height?: number` - Chart height
- `loading?: boolean` - Show loading state
- `showLegend?: boolean` - Show legend
- `colors?: string[]` - Color array

### AreaChart
Stacked area charts for trends.

```typescript
<AreaChart
  data={tokenData}
  xKey="date"
  areaKeys={[
    { key: 'input', color: '#3b82f6', name: 'Input', stackId: 'tokens' },
    { key: 'output', color: '#22c55e', name: 'Output', stackId: 'tokens' },
  ]}
  height={300}
/>
```

**Props**:
- `data: T[]` - Data points
- `xKey: keyof T` - X-axis key
- `areaKeys: Array<{key, color, name, stackId?}>` - Area series
- `height?: number` - Chart height
- `loading?: boolean` - Show loading state
- `showGrid?: boolean` - Show grid
- `showLegend?: boolean` - Show legend
- `xAxisFormatter?: (value) => string` - Formatter
- `yAxisFormatter?: (value) => string` - Formatter

### ChartTooltip
Custom tooltip (auto-integrated).

No direct usage needed - automatically used by all chart components.

---

## Dashboard Components (Pre-built)

Ready-to-use dashboard visualizations with built-in styling.

### OverviewCards
KPI metric cards with trends.

```typescript
<OverviewCards
  cards={[
    {
      title: 'Total Messages',
      value: '8,959',
      change: 12.5,
      changeLabel: 'vs last week',
      icon: MessageSquare,
      trend: 'up',
    },
  ]}
  loading={false}
/>
```

**Props**:
- `cards: KPICard[]` - Card data (4 recommended)
- `loading?: boolean` - Show loading state

### TokenUsageChart
Area chart of token usage.

```typescript
<TokenUsageChart
  data={mockTokenTimeline}
  loading={false}
/>
```

**Props**:
- `data: TokenUsageData[]` - Timeline data
- `loading?: boolean` - Show loading state
- `xAxisFormatter?: (value) => string` - Custom formatter
- `yAxisFormatter?: (value) => string` - Custom formatter

### PlatformDistribution
Donut chart of messages by platform.

```typescript
<PlatformDistribution
  data={platformData}
  loading={false}
/>
```

**Props**:
- `data: PlatformDistributionData[]` - Platform data
- `loading?: boolean` - Show loading state

### AgentPerformanceChart
Agent success rates and duration.

```typescript
<AgentPerformanceChart
  data={agentData}
  loading={false}
/>
```

**Props**:
- `data: AgentPerformanceData[]` - Agent metrics
- `loading?: boolean` - Show loading state

### RecentEventsTable
Activity feed with event types.

```typescript
<RecentEventsTable
  events={recentEvents}
  loading={false}
/>
```

**Props**:
- `events: RecentEvent[]` - Event list
- `loading?: boolean` - Show loading state

### QuickStats
Simple stat cards.

```typescript
<QuickStats
  stats={[
    { label: 'Active Users', value: '342' },
    { label: 'Uptime', value: '99.9%' },
  ]}
  columns={2}
  loading={false}
/>
```

**Props**:
- `stats: Array<{label, value}>` - Stat items
- `columns?: 1 | 2 | 3 | 4` - Grid columns (default: 3)
- `loading?: boolean` - Show loading state

---

## Token Components (Specialized)

Token and cost tracking visualizations.

### TokenSummaryCards
Token count and cost summary.

```typescript
<TokenSummaryCards
  summary={{
    totalInput: 85000,
    totalOutput: 56000,
    totalCached: 15000,
    totalTokens: 156000,
    estimatedCost: 0.8234,
  }}
  loading={false}
/>
```

### TokenTrendChart
Token usage over time.

```typescript
<TokenTrendChart
  data={tokenTimeline}
  loading={false}
  title="7-Day Token Usage"
/>
```

### TokenByModelChart
Token usage by model (horizontal bars).

```typescript
<TokenByModelChart
  data={[
    { model: 'Claude Opus', input: 45000, output: 32000, cached: 8000 },
  ]}
  loading={false}
/>
```

### TokenByAgentChart
Token usage by agent (horizontal bars).

```typescript
<TokenByAgentChart
  data={[
    { agent: 'router-agent', input: 12000, output: 8000, cached: 2000 },
  ]}
  loading={false}
/>
```

### TokenHeatmap
Activity heatmap (hour × day).

```typescript
<TokenHeatmap
  data={heatmapData}
  loading={false}
/>
```

---

## Event Components (Debug)

Execution trace and debugging visualizations.

### AgentTraceView
Full execution trace with metrics.

```typescript
<AgentTraceView
  trace={agentTrace}
  loading={false}
/>
```

Displays:
- Trace metadata (ID, duration, start time)
- Token breakdown with stacked bars
- Execution step tree with status icons
- Error display if failed

### AgentStepNode
Individual execution step.

Used internally by `AgentTraceView`. Shows:
- Step name and status (success/error/pending/running)
- Duration and token count
- Expandable children
- Error messages

### TokenBreakdown
Token distribution (input/output/cached).

```typescript
<TokenBreakdown
  input={1500}
  output={2000}
  cached={500}
/>
```

Shows stacked progress bars with percentages.

### ErrorDisplay
Error message with copy button.

```typescript
<ErrorDisplay
  error="Error message here"
  title="Error Details"
/>
```

---

## Color Palette

### Chart Colors
```typescript
chartColors = {
  input: '#3b82f6',       // Blue
  output: '#22c55e',      // Green
  cached: '#a855f7',      // Purple
  reasoning: '#f59e0b',   // Amber
  error: '#ef4444',       // Red
  success: '#10b981',     // Emerald
  pending: '#6366f1',     // Indigo
  neutral: '#6b7280',     // Gray
}
```

### Platform Colors
```typescript
platformColors = {
  telegram: '#0088cc',
  github: '#333333',
  cli: '#10b981',
  api: '#f59e0b',
}
```

---

## Mock Data

For development and testing:

```typescript
import {
  mockTokenTimeline,      // 30 days
  mockPlatformDistribution,
  mockAgentPerformance,
  mockRecentEvents,
  mockTokenByModel,
  mockTokenByAgent,
  mockTokenHeatmap,
  mockAgentTrace,
  mockKPICards,
  mockTokenSummary,
} from '@duyetbot/dashboard';
```

---

## Common Patterns

### Loading State
```typescript
const [loading, setLoading] = useState(true);

<OverviewCards cards={mockKPICards} loading={loading} />
```

### Custom Formatters
```typescript
<LineChart
  data={data}
  xKey="timestamp"
  yKeys={[...]}
  xAxisFormatter={(ts) => new Date(ts).toLocaleDateString()}
  yAxisFormatter={(val) => `$${val.toFixed(2)}`}
/>
```

### Responsive Container
```typescript
<div className="w-full h-[400px]">
  <TokenUsageChart data={tokenData} />
</div>
```

### Dark Mode
```typescript
<div className="dark">
  <OverviewCards cards={mockKPICards} />
</div>
```

---

## Integration with Next.js

### In Server Component
```typescript
// app/dashboard/page.tsx
import { OverviewCards, mockKPICards } from '@duyetbot/dashboard';

export default function Dashboard() {
  return <OverviewCards cards={mockKPICards} />;
}
```

### In Client Component
```typescript
'use client';

import { useState, useEffect } from 'react';
import { TokenUsageChart } from '@duyetbot/dashboard';

export default function TokenDashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTokenData();
  }, []);

  return <TokenUsageChart data={data} loading={loading} />;
}
```

---

## Best Practices

1. **Always Provide Keys**: Use unique React keys when rendering lists
2. **Memoize Data**: Prevent unnecessary re-renders with useMemo
3. **Handle Loading**: Show loading state while fetching data
4. **Format Dates**: Use xAxisFormatter for readable dates
5. **Set Heights**: Specify height for proper responsive sizing
6. **Use Mock Data**: Start development with mockData exports
7. **Dark Mode**: Wrap in `dark` class for dark mode testing

---

## Troubleshooting

### Chart Not Showing
- Check data structure matches type definitions
- Verify xKey and dataKey values exist in data
- Ensure height is specified

### Loading State Not Hiding
- Set `loading={false}` when data is ready

### Colors Look Wrong
- Use chartColors constants for consistency
- Check dark mode class application

### Responsive Issues
- Wrap charts in div with width constraint
- Use ResponsiveContainer (auto-included)

---

## Component Statistics

| Category | Count | Purpose |
|----------|-------|---------|
| Charts | 5 | Generic wrappers |
| Dashboard | 6 | Pre-built visualizations |
| Tokens | 5 | Token tracking |
| Events | 4 | Execution traces |
| **Total** | **27** | **All visualizations** |

---

## File Locations

All components in: `/apps/dashboard/src/`

```
src/
├── components/
│   ├── charts/     → Generic chart wrappers
│   ├── dashboard/  → Dashboard visualizations
│   ├── tokens/     → Token tracking
│   └── events/     → Execution traces
├── types.ts        → Type definitions
├── index.ts        → Main exports
└── lib/
    └── mockData.ts → Development data
```

---

**Last Updated**: 2024-12-07
**Version**: 1.0.0
