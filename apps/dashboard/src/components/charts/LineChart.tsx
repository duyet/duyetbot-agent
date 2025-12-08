import React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartDataPoint, LineChartConfig } from '../../types';
import { ChartTooltip } from './ChartTooltip';

interface LineChartProps<T extends ChartDataPoint> extends LineChartConfig<T> {
  className?: string;
}

export const LineChart = React.forwardRef<any, LineChartProps<any>>(function LineChart(
  {
    data,
    xKey,
    yKeys,
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
        <RechartsLineChart data={data}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey={String(xKey)} tickFormatter={xAxisFormatter} />
          <YAxis tickFormatter={yAxisFormatter} />
          <Tooltip content={<ChartTooltip />} />
          {showLegend && <Legend />}
          {yKeys.map((yKey, index) => (
            <Line
              key={index}
              type="monotone"
              dataKey={String(yKey.key)}
              stroke={yKey.color}
              name={yKey.name}
              strokeDasharray={yKey.dashed ? '5 5' : undefined}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
});
