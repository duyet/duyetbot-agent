import React from 'react';
import { TokenHeatmapData } from '../../types';

interface TokenHeatmapProps {
  data: TokenHeatmapData[];
  loading?: boolean;
  colorScale?: (value: number, max: number) => string;
}

const defaultColorScale = (value: number, max: number): string => {
  const ratio = value / max;
  if (ratio < 0.25) {
    return '#e0e7ff'; // indigo-100
  }
  if (ratio < 0.5) {
    return '#a5b4fc'; // indigo-300
  }
  if (ratio < 0.75) {
    return '#6366f1'; // indigo-500
  }
  return '#4f46e5'; // indigo-600
};

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const TokenHeatmap: React.FC<TokenHeatmapProps> = ({
  data,
  loading = false,
  colorScale = defaultColorScale,
}) => {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Activity Heatmap
        </h2>
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      </div>
    );
  }

  const maxTokens = Math.max(...data.map((d) => d.tokens), 1);

  // Group data by day
  const grid = Array.from({ length: 7 }).map((_, day) =>
    Array.from({ length: 24 }).map((_, hour) => {
      const item = data.find((d) => d.day === day && d.hour === hour);
      return item?.tokens || 0;
    })
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Activity Heatmap</h2>

      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Day labels */}
          <div className="flex">
            <div className="w-12" />
            <div className="flex gap-0.5">
              {Array.from({ length: 24 }).map((_, hour) => (
                <div
                  key={`hour-${hour}`}
                  className="flex w-6 items-center justify-center text-xs text-gray-600 dark:text-gray-400"
                >
                  {hour % 6 === 0 ? hour : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Heatmap grid */}
          {grid.map((row, dayIndex) => (
            <div key={`row-${dayIndex}`} className="flex gap-1">
              <div className="flex w-12 items-center justify-start text-sm font-medium text-gray-700 dark:text-gray-300">
                {dayLabels[dayIndex]}
              </div>

              <div className="flex gap-0.5">
                {row.map((tokens, hourIndex) => (
                  <div
                    key={`${dayIndex}-${hourIndex}`}
                    className="h-6 w-6 rounded border border-gray-200 dark:border-gray-700"
                    style={{
                      backgroundColor: colorScale(tokens, maxTokens),
                    }}
                    title={`${dayLabels[dayIndex]} ${hourIndex}:00 - ${tokens.toLocaleString()} tokens`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs">
        <span className="text-gray-600 dark:text-gray-400">Less</span>
        <div className="flex gap-1">
          {['#e0e7ff', '#a5b4fc', '#6366f1', '#4f46e5'].map((color, i) => (
            <div key={i} className="h-3 w-3 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <span className="text-gray-600 dark:text-gray-400">More</span>
      </div>
    </div>
  );
};
