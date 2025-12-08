import { Zap } from 'lucide-react';
import React from 'react';
import { chartColors, TokenSummary } from '@/types';

interface TokenSummaryCardsProps {
  summary: TokenSummary;
  loading?: boolean;
}

export const TokenSummaryCards: React.FC<TokenSummaryCardsProps> = ({
  summary,
  loading = false,
}) => {
  const cards = [
    {
      label: 'Input Tokens',
      value: summary.totalInput.toLocaleString(),
      color: chartColors.input,
    },
    {
      label: 'Output Tokens',
      value: summary.totalOutput.toLocaleString(),
      color: chartColors.output,
    },
    {
      label: 'Cached Tokens',
      value: summary.totalCached.toLocaleString(),
      color: chartColors.cached,
    },
    {
      label: 'Total Tokens',
      value: summary.totalTokens.toLocaleString(),
      color: '#6b7280',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-4 h-8 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.label}</h3>
            <div className="rounded-lg p-2" style={{ backgroundColor: `${card.color}20` }}>
              <Zap className="h-5 w-5" style={{ color: card.color }} />
            </div>
          </div>

          <p className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
        </div>
      ))}

      {summary.estimatedCost && (
        <div className="col-span-full rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            Estimated Cost:{' '}
            <span className="font-semibold">${summary.estimatedCost.toFixed(4)}</span>
          </p>
        </div>
      )}
    </div>
  );
};
