import React from 'react';
import {
  getDayLabels,
  getHeatmapColor,
  getHeatmapColorScale,
  getHourLabel,
  getMaxTokens,
  groupHeatmapByGrid,
} from '@/lib/token-heatmap-utils';
import { TokenHeatmapData } from '@/types';

interface TokenHeatmapProps {
  data: TokenHeatmapData[];
  loading?: boolean;
  colorScale?: (value: number, max: number) => string;
}

const defaultColorScale = getHeatmapColor;

export const TokenHeatmap: React.FC<TokenHeatmapProps> = ({
  data,
  loading = false,
  colorScale = defaultColorScale,
}) => {
  const dayLabels = getDayLabels();
  const colorScaleForLegend = getHeatmapColorScale();

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Activity Heatmap
        </h2>
        <div className="animate-pulse space-y-2">
          {dayLabels.map((day) => (
            <div key={day} className="h-8 w-full rounded bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      </div>
    );
  }

  const maxTokens = getMaxTokens(data);

  // Group data by day
  const grid = groupHeatmapByGrid(data);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Activity Heatmap</h2>

      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Day labels */}
          <div className="flex">
            <div className="w-12" />
            <div className="flex gap-0.5">
              {Array.from({ length: 24 }, (_, h) => h).map((hour) => (
                <div
                  key={`hour-label-${hour}`}
                  className="flex w-6 items-center justify-center text-xs text-gray-600 dark:text-gray-400"
                >
                  {getHourLabel(hour)}
                </div>
              ))}
            </div>
          </div>

          {/* Heatmap grid */}
          {dayLabels.map((dayLabel, dayIndex) => (
            <div key={`row-${dayLabel}`} className="flex gap-1">
              <div className="flex w-12 items-center justify-start text-sm font-medium text-gray-700 dark:text-gray-300">
                {dayLabel}
              </div>

              <div className="flex gap-0.5">
                {Array.from({ length: 24 }, (_, h) => h).map((hour) => (
                  <div
                    key={`${dayLabel}-h${hour}`}
                    className="h-6 w-6 rounded border border-gray-200 dark:border-gray-700"
                    style={{
                      backgroundColor: colorScale(grid[dayIndex][hour], maxTokens),
                    }}
                    title={`${dayLabel} ${hour}:00 - ${grid[dayIndex][hour].toLocaleString()} tokens`}
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
          {colorScaleForLegend.map((color) => (
            <div key={color} className="h-3 w-3 rounded" style={{ backgroundColor: color }} />
          ))}
        </div>
        <span className="text-gray-600 dark:text-gray-400">More</span>
      </div>
    </div>
  );
};
