import React from 'react';
import { chartColors, TokenUsageData } from '../../types';
import { AreaChart } from '../charts/AreaChart';

interface TokenUsageChartProps {
  data: TokenUsageData[];
  loading?: boolean;
  xAxisFormatter?: (value: any) => string;
  yAxisFormatter?: (value: any) => string;
}

export const TokenUsageChart: React.FC<TokenUsageChartProps> = ({
  data,
  loading = false,
  xAxisFormatter = (val) => String(val),
  yAxisFormatter = (val) => `${val.toLocaleString()}`,
}) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Token Usage Trend
      </h2>

      <AreaChart
        data={data}
        xKey="date"
        areaKeys={[
          {
            key: 'input',
            color: chartColors.input,
            name: 'Input Tokens',
            stackId: 'tokens',
          },
          {
            key: 'output',
            color: chartColors.output,
            name: 'Output Tokens',
            stackId: 'tokens',
          },
          {
            key: 'cached',
            color: chartColors.cached,
            name: 'Cached Tokens',
            stackId: 'tokens',
          },
        ]}
        height={300}
        loading={loading}
        showGrid={true}
        showLegend={true}
        xAxisFormatter={xAxisFormatter}
        yAxisFormatter={yAxisFormatter}
      />
    </div>
  );
};
