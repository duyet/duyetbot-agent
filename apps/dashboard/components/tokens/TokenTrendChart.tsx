import React from 'react';
import { LineChart } from '@/components/charts';
import { chartColors, TokenUsageData } from '@/types';

interface TokenTrendChartProps {
  data: TokenUsageData[];
  loading?: boolean;
  title?: string;
}

export const TokenTrendChart: React.FC<TokenTrendChartProps> = ({
  data,
  loading = false,
  title = 'Token Usage Over Time',
}) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>

      <LineChart
        data={data}
        xKey="date"
        yKeys={[
          {
            key: 'input',
            color: chartColors.input,
            name: 'Input',
          },
          {
            key: 'output',
            color: chartColors.output,
            name: 'Output',
          },
          {
            key: 'cached',
            color: chartColors.cached,
            name: 'Cached',
            dashed: true,
          },
        ]}
        height={300}
        loading={loading}
        showGrid={true}
        showLegend={true}
        yAxisFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
      />
    </div>
  );
};
