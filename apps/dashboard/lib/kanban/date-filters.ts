/**
 * Date Filter Utilities
 *
 * Helper functions for filtering tasks by due date.
 * Provides common date ranges: overdue, today, this week, this month.
 */

import { endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import type { DateFilterType } from './types';

export function getDateRange(filterType: DateFilterType): { start: number; end: number } | null {
  const now = new Date();

  switch (filterType) {
    case 'overdue':
      return { start: 0, end: startOfDay(now).getTime() };

    case 'today':
      return {
        start: startOfDay(now).getTime(),
        end: endOfDay(now).getTime(),
      };

    case 'this_week':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }).getTime(),
        end: endOfWeek(now, { weekStartsOn: 1 }).getTime(),
      };

    case 'this_month':
      return {
        start: startOfMonth(now).getTime(),
        end: endOfMonth(now).getTime(),
      };

    default:
      return null;
  }
}

export function matchesDateFilter(dueDate: number | null, filterType: DateFilterType): boolean {
  if (!dueDate) {
    return filterType === null;
  }

  const range = getDateRange(filterType);
  if (!range) {
    return true;
  }

  return dueDate >= range.start && dueDate <= range.end;
}
