import React from 'react';
import {
  Bar,
  CartesianGrid,
  Legend,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChartConfig, ChartDataPoint } from '@/types';
import { ChartTooltip } from './ChartTooltip';

interface BarChartProps<T extends ChartDataPoint> extends BarChartConfig<T> {
  className?: string;
}

export const BarChart = React.forwardRef<any, BarChartProps<any>>(function BarChart(
  {
    data,
    xKey,
    barKeys,
    height = 300,
    loading = false,
    showGrid = true,
    showLegend = true,
    layout = 'vertical',
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
        <RechartsBarChart
          data={data}
          layout={layout}
          margin={
            layout === 'vertical'
              ? { left: 100, right: 20, top: 10, bottom: 10 }
              : { top: 10, right: 30, left: 0, bottom: 10 }
          }
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis
            type={layout === 'vertical' ? 'number' : 'category'}
            dataKey={layout === 'vertical' ? undefined : String(xKey)}
            tickFormatter={layout === 'vertical' ? xAxisFormatter : undefined}
          />
          <YAxis
            type={layout === 'vertical' ? 'category' : 'number'}
            dataKey={layout === 'vertical' ? String(xKey) : undefined}
            tickFormatter={layout === 'vertical' ? undefined : yAxisFormatter}
            width={layout === 'vertical' ? 100 : undefined}
          />
          <Tooltip content={<ChartTooltip />} />
          {showLegend && <Legend />}
          {barKeys.map((barKey, index) => (
            <Bar
              key={index}
              dataKey={String(barKey.key)}
              fill={barKey.color}
              name={barKey.name}
              isAnimationActive={false}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
});
