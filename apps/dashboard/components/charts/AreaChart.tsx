import React from 'react';
import {
  Area,
  CartesianGrid,
  Legend,
  AreaChart as RechartsAreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AreaChartConfig, ChartDataPoint } from '@/types';
import { ChartTooltip } from './ChartTooltip';

interface AreaChartProps<T extends ChartDataPoint> extends AreaChartConfig<T> {
  className?: string;
}

export const AreaChart = React.forwardRef<any, AreaChartProps<any>>(function AreaChart(
  {
    data,
    xKey,
    areaKeys,
    height = 300,
    loading = false,
    showGrid = true,
    showLegend = true,
    xAxisFormatter,
    yAxisFormatter,
    className = '',
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
        <RechartsAreaChart data={data}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey={String(xKey)} tickFormatter={xAxisFormatter} />
          <YAxis tickFormatter={yAxisFormatter} />
          <Tooltip content={<ChartTooltip />} />
          {showLegend && <Legend />}
          {areaKeys.map((areaKey) => (
            <Area
              key={String(areaKey.key)}
              type="monotone"
              dataKey={String(areaKey.key)}
              fill={areaKey.color}
              stroke={areaKey.color}
              name={areaKey.name}
              stackId={areaKey.stackId || '0'}
              fillOpacity={0.6}
              isAnimationActive={false}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
});
