import React from 'react';

interface QuickStatItem {
  label: string;
  value: string | number;
}

interface QuickStatsProps {
  stats: QuickStatItem[];
  loading?: boolean;
  columns?: number;
}

export const QuickStats: React.FC<QuickStatsProps> = ({ stats, loading = false, columns = 3 }) => {
  if (loading) {
    return (
      <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-${columns}`}>
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-2 h-6 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    );
  }

  const gridClass =
    {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
    }[Math.min(columns, 4)] || 'grid-cols-3';

  return (
    <div className={`grid gap-4 sm:grid-cols-2 lg:${gridClass}`}>
      {stats.map((stat, index) => (
        <div
          key={index}
          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
        >
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
        </div>
      ))}
    </div>
  );
};
