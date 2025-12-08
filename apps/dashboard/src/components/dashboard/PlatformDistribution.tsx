import React from 'react';
import { PlatformDistributionData, platformColors } from '../../types';
import { PieChart } from '../charts/PieChart';

interface PlatformDistributionProps {
  data: PlatformDistributionData[];
  loading?: boolean;
}

export const PlatformDistribution: React.FC<PlatformDistributionProps> = ({
  data,
  loading = false,
}) => {
  const colors = data.map((item) => platformColors[item.platform] || '#6b7280');

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Messages by Platform
      </h2>

      <PieChart
        data={data}
        dataKey="count"
        nameKey="platform"
        height={300}
        loading={loading}
        showLegend={true}
        innerRadius={60}
        colors={colors}
      />
    </div>
  );
};
