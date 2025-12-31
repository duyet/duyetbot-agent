import React from 'react';
import {
  calculatePercentages,
  calculateTotal,
  formatTokenWithPercent,
  percentToWidth,
  type TokenBreakdown as TokenBreakdownData,
} from '@/lib/token-breakdown-utils';
import { chartColors } from '@/types';

interface TokenBreakdownProps {
  input: number;
  output: number;
  cached: number;
}

export const TokenBreakdown: React.FC<TokenBreakdownProps> = ({ input, output, cached }) => {
  const breakdown: TokenBreakdownData = { input, output, cached };
  const total = calculateTotal(breakdown);
  const {
    input: inputPercent,
    output: outputPercent,
    cached: cachedPercent,
  } = calculatePercentages(breakdown);

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-900 dark:text-white">Input</span>
          <span className="text-gray-600 dark:text-gray-400">
            {formatTokenWithPercent(input, inputPercent)}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full"
            style={{
              width: percentToWidth(inputPercent),
              backgroundColor: chartColors.input,
            }}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-900 dark:text-white">Output</span>
          <span className="text-gray-600 dark:text-gray-400">
            {formatTokenWithPercent(output, outputPercent)}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full"
            style={{
              width: percentToWidth(outputPercent),
              backgroundColor: chartColors.output,
            }}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-900 dark:text-white">Cached</span>
          <span className="text-gray-600 dark:text-gray-400">
            {formatTokenWithPercent(cached, cachedPercent)}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full"
            style={{
              width: percentToWidth(cachedPercent),
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
