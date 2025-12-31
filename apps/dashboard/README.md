# @duyetbot/dashboard

Analytics dashboard component library for the DuyetBot agent system. Provides reusable chart, visualization, and analytics components built with Recharts and Tailwind CSS.

## Components

### Chart Wrappers

Generic, reusable chart components that wrap Recharts with consistent styling and features:

- **LineChart**: Multi-line charts with customizable axes and formatting
- **BarChart**: Vertical/horizontal bar charts with legend support
- **PieChart**: Pie/donut charts with custom colors
- **AreaChart**: Stacked area charts for time-series data
- **ChartTooltip**: Custom tooltip component for all charts

### Dashboard Components

Pre-built dashboard visualizations:

- **OverviewCards**: KPI metric cards with trend indicators
- **TokenUsageChart**: Stacked area chart showing input/output/cached tokens over time
- **PlatformDistribution**: Donut chart showing message distribution by platform
- **AgentPerformanceChart**: Horizontal bar chart comparing agent success rates and duration
- **RecentEventsTable**: Activity feed with event types, status, and metadata
- **QuickStats**: Simple stat cards for at-a-glance metrics

### Token Visualization Components

Token and cost tracking visualizations:

- **TokenSummaryCards**: Summary cards for token counts and estimated cost
- **TokenTrendChart**: Line chart showing token usage trends
- **TokenByModelChart**: Breakdown of tokens by AI model
- **TokenByAgentChart**: Breakdown of tokens by agent
- **TokenHeatmap**: Activity heatmap (hour × day grid)

### Event Trace Components

Execution trace and debugging visualizations:

- **AgentTraceView**: Full execution trace with tree view and metrics
- **AgentStepNode**: Individual execution step with status and timing
- **TokenBreakdown**: Stacked progress bars showing token distribution
- **ErrorDisplay**: Error message card with copy functionality

## Usage

### Basic Example

```typescript
import React from 'react';
import {
  TokenUsageChart,
  OverviewCards,
  mockTokenTimeline,
  mockKPICards,
} from '@duyetbot/dashboard';

export function Dashboard() {
  return (
    <div className="space-y-6">
      <OverviewCards cards={mockKPICards} />
      <TokenUsageChart data={mockTokenTimeline} />
    </div>
  );
}
```

### Using Chart Wrappers

```typescript
import { LineChart } from '@duyetbot/dashboard';
import { chartColors } from '@duyetbot/dashboard';

function MyChart() {
  const data = [
    { date: '2024-01-01', value1: 100, value2: 200 },
    { date: '2024-01-02', value1: 150, value2: 220 },
  ];

  return (
    <LineChart
      data={data}
      xKey="date"
      yKeys={[
        { key: 'value1', color: chartColors.input, name: 'Metric 1' },
        { key: 'value2', color: chartColors.output, name: 'Metric 2' },
      ]}
      height={300}
      showGrid={true}
      showLegend={true}
    />
  );
}
```

### Token Tracking

```typescript
import {
  TokenSummaryCards,
  TokenByModelChart,
  TokenHeatmap,
  mockTokenSummary,
  mockTokenByModel,
  mockTokenHeatmap,
} from '@duyetbot/dashboard';

export function TokenDashboard() {
  return (
    <div className="space-y-6">
      <TokenSummaryCards summary={mockTokenSummary} />
      <TokenByModelChart data={mockTokenByModel} />
      <TokenHeatmap data={mockTokenHeatmap} />
    </div>
  );
}
```

### Execution Traces

```typescript
import { AgentTraceView, mockAgentTrace } from '@duyetbot/dashboard';

export function TraceViewer() {
  return <AgentTraceView trace={mockAgentTrace} />;
}
```

## Types

All components are fully typed with TypeScript. Key types:

- `ChartDataPoint`: Base interface for chart data
- `LineChartConfig<T>`: Configuration for line charts
- `BarChartConfig<T>`: Configuration for bar charts
- `TokenUsageData`: Token usage timeline data
- `AgentTrace`: Execution trace structure
- `RecentEvent`: Activity event

## Styling

All components use:

- **Tailwind CSS**: Utility-first styling with dark mode support
- **Recharts**: Composable charting library
- **Lucide React**: Icon library for UI elements

### Dark Mode

All components automatically support dark mode through Tailwind's `dark:` prefix. Apply the `dark` class to a parent element to enable dark theme.

### Color Palette

```typescript
const chartColors = {
  input: '#3b82f6',      // blue-500
  output: '#22c55e',     // green-500
  cached: '#a855f7',     // purple-500
  reasoning: '#f59e0b',  // amber-500
  error: '#ef4444',      // red-500
  success: '#10b981',    // emerald-500
  pending: '#6366f1',    // indigo-500
  neutral: '#6b7280',    // gray-500
};
```

## Mock Data

Development-ready mock data is exported for all component types:

- `mockTokenTimeline`: 30 days of token usage
- `mockPlatformDistribution`: Message counts by platform
- `mockAgentPerformance`: Agent metrics and success rates
- `mockRecentEvents`: Sample activity events
- `mockTokenByModel`: Token usage by AI model
- `mockTokenByAgent`: Token usage by agent
- `mockTokenHeatmap`: Activity heatmap data
- `mockAgentTrace`: Sample execution trace
- `mockKPICards`: Overview metric cards

## Features

- **Responsive**: Works on mobile, tablet, and desktop
- **Loading States**: Built-in loading skeletons for all components
- **Type Safe**: Full TypeScript support with generics
- **Accessible**: Semantic HTML and keyboard navigation
- **Dark Mode**: Automatic dark mode support
- **Customizable**: Formatters, colors, and layout options
- **Performance**: Optimized rendering with memoization

## Development

```bash
# Type check
bun run type-check

# Build
bun run build

# Test
bun run test
```

## License

MIT
