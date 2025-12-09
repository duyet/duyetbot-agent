import React from 'react';
import {
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ChartDataPoint, PieChartConfig } from '@/types';
import { ChartTooltip } from './ChartTooltip';

const COLORS = [
  '#3b82f6',
  '#22c55e',
  '#a855f7',
  '#f59e0b',
  '#ef4444',
  '#10b981',
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

interface PieChartProps<T extends ChartDataPoint> extends PieChartConfig<T> {
  className?: string;
  colors?: string[];
}

export const PieChart = React.forwardRef<any, PieChartProps<any>>(function PieChart(
  {
    data,
    dataKey,
    nameKey,
    height = 300,
    loading = false,
    showLegend = true,
    innerRadius,
    className = '',
    colors = COLORS,
  },
  ref
) {
  if (loading) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 dark:bg-gray-900 ${className}`}
        style={{ height }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div ref={ref} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey={String(dataKey)}
            nameKey={String(nameKey)}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            innerRadius={innerRadius}
            isAnimationActive={false}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          {showLegend && <Legend />}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
});
