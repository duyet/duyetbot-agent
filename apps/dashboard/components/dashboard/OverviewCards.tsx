import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import React from 'react';
import { KPICard } from '@/types';

interface OverviewCardsProps {
  cards: KPICard[];
  loading?: boolean;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ cards, loading = false }) => {
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
            <div className="mt-4 h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
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
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.title}</h3>
            <card.icon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>

          <p className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>

          <div className="mt-4 flex items-center gap-1">
            {card.trend === 'up' ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : card.trend === 'down' ? (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ) : (
              <Minus className="h-4 w-4 text-gray-500" />
            )}
            <span
              className={`text-sm font-semibold ${
                card.trend === 'up'
                  ? 'text-green-500'
                  : card.trend === 'down'
                    ? 'text-red-500'
                    : 'text-gray-500'
              }`}
            >
              {card.change > 0 ? '+' : ''}
              {card.change}%
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{card.changeLabel}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
