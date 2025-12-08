import React from 'react';
import { BarChart } from '@/components/charts';
import { AgentPerformanceData, chartColors } from '@/types';

interface AgentPerformanceChartProps {
  data: AgentPerformanceData[];
  loading?: boolean;
}

export const AgentPerformanceChart: React.FC<AgentPerformanceChartProps> = ({
  data,
  loading = false,
}) => {
  const chartData = data.map((item) => ({
    agent: item.agent,
    successRate: item.successRate,
    'Avg Duration (ms)': item.avgDuration,
  }));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Agent Performance
      </h2>

      <BarChart
        data={chartData}
        xKey="agent"
        barKeys={[
          {
            key: 'successRate',
            color: chartColors.success,
            name: 'Success Rate %',
          },
          {
            key: 'Avg Duration (ms)',
            color: chartColors.reasoning,
            name: 'Avg Duration (ms)',
          },
        ]}
        height={300}
        loading={loading}
        layout="vertical"
        showGrid={true}
        showLegend={true}
        yAxisFormatter={(val) => `${val}%`}
      />
    </div>
  );
};
