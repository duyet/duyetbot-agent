import React from 'react';
import { BarChart } from '@/components/charts';
import { chartColors, TokenByAgentData } from '@/types';

interface TokenByAgentChartProps {
  data: TokenByAgentData[];
  loading?: boolean;
}

export const TokenByAgentChart: React.FC<TokenByAgentChartProps> = ({ data, loading = false }) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Token Usage by Agent
      </h2>

      <BarChart
        data={data}
        xKey="agent"
        barKeys={[
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
          },
        ]}
        height={300}
        loading={loading}
        layout="horizontal"
        showGrid={true}
        showLegend={true}
        xAxisFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
      />
    </div>
  );
};
