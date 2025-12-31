import React from 'react';
import { chartColors } from '@/types';

interface TokenBreakdownProps {
  input: number;
  output: number;
  cached: number;
}

export const TokenBreakdown: React.FC<TokenBreakdownProps> = ({ input, output, cached }) => {
  const total = input + output + cached;
  const inputPercent = total > 0 ? (input / total) * 100 : 0;
  const outputPercent = total > 0 ? (output / total) * 100 : 0;
  const cachedPercent = total > 0 ? (cached / total) * 100 : 0;

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-900 dark:text-white">Input</span>
          <span className="text-gray-600 dark:text-gray-400">
            {input.toLocaleString()} ({inputPercent.toFixed(0)}%)
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full"
            style={{
              width: `${inputPercent}%`,
              backgroundColor: chartColors.input,
            }}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-900 dark:text-white">Output</span>
          <span className="text-gray-600 dark:text-gray-400">
            {output.toLocaleString()} ({outputPercent.toFixed(0)}%)
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full"
            style={{
              width: `${outputPercent}%`,
              backgroundColor: chartColors.output,
            }}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-900 dark:text-white">Cached</span>
          <span className="text-gray-600 dark:text-gray-400">
            {cached.toLocaleString()} ({cachedPercent.toFixed(0)}%)
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full"
            style={{
              width: `${cachedPercent}%`,
              backgroundColor: chartColors.cached,
            }}
          />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
        <div className="flex items-center justify-between font-semibold text-gray-900 dark:text-white">
          <span>Total</span>
          <span>{total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
