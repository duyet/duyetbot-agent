import React from 'react';
import { chartColors, TokenByModelData } from '../../types';
import { BarChart } from '../charts/BarChart';

interface TokenByModelChartProps {
  data: TokenByModelData[];
  loading?: boolean;
}

export const TokenByModelChart: React.FC<TokenByModelChartProps> = ({ data, loading = false }) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Token Usage by Model
      </h2>

      <BarChart
        data={data}
        xKey="model"
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
