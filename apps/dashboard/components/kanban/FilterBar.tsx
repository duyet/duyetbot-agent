/**
 * FilterBar Component
 *
 * Filter tasks by priority, tags, and due date.
 * Provides multi-select for tags and clear all functionality.
 *
 * Design: Compact filter bar with dropdowns and badges
 */

'use client';

import { ChevronDown, Filter, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DateFilterType } from '@/lib/kanban';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  priorityFilter: 'high' | 'medium' | 'low' | null;
  onPriorityChange: (priority: 'high' | 'medium' | 'low' | null) => void;
  tagFilters: string[];
  onTagFiltersChange: (tags: string[]) => void;
  dateFilter: DateFilterType;
  onDateFilterChange: (filter: DateFilterType) => void;
  availableTags: string[];
  className?: string;
}

export function FilterBar({
  priorityFilter,
  onPriorityChange,
  tagFilters,
  onTagFiltersChange,
  dateFilter,
  onDateFilterChange,
  availableTags,
  className,
}: FilterBarProps) {
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const hasActiveFilters = priorityFilter || tagFilters.length > 0 || dateFilter;

  const toggleTag = (tag: string) => {
    if (tagFilters.includes(tag)) {
      onTagFiltersChange(tagFilters.filter((t) => t !== tag));
    } else {
      onTagFiltersChange([...tagFilters, tag]);
    }
  };

  const clearAllFilters = () => {
    onPriorityChange(null);
    onTagFiltersChange([]);
    onDateFilterChange(null);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Filter className="h-4 w-4 text-white/40" />

      {/* Priority Filter */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
          className={cn(
            'border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
            priorityFilter && 'border-amber-500/30 bg-amber-500/10 text-amber-500'
          )}
        >
          Priority
          {priorityFilter && (
            <Badge variant="outline" className="ml-2 h-4 px-1 text-[10px] font-mono">
              {priorityFilter === 'high' ? 'H' : priorityFilter === 'medium' ? 'M' : 'L'}
            </Badge>
          )}
          <ChevronDown className="ml-2 h-3 w-3" />
        </Button>

        {showPriorityDropdown && (
          <div className="absolute top-full left-0 mt-1 z-10 min-w-[120px] bg-black/95 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl">
            <div className="p-1 space-y-1">
              <button
                type="button"
                onClick={() => {
                  onPriorityChange(priorityFilter === 'high' ? null : 'high');
                  setShowPriorityDropdown(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm rounded-md transition-colors',
                  'hover:bg-white/10',
                  priorityFilter === 'high' ? 'bg-amber-500/20 text-amber-500' : 'text-white/70'
                )}
              >
                High (8-10)
              </button>
              <button
                type="button"
                onClick={() => {
                  onPriorityChange(priorityFilter === 'medium' ? null : 'medium');
                  setShowPriorityDropdown(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm rounded-md transition-colors',
                  'hover:bg-white/10',
                  priorityFilter === 'medium' ? 'bg-blue-500/20 text-blue-500' : 'text-white/70'
                )}
              >
                Medium (5-7)
              </button>
              <button
                type="button"
                onClick={() => {
                  onPriorityChange(priorityFilter === 'low' ? null : 'low');
                  setShowPriorityDropdown(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm rounded-md transition-colors',
                  'hover:bg-white/10',
                  priorityFilter === 'low' ? 'bg-slate-500/20 text-slate-400' : 'text-white/70'
                )}
              >
                Low (1-4)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tag Filter */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTagDropdown(!showTagDropdown)}
          className={cn(
            'border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
            tagFilters.length > 0 && 'border-amber-500/30 bg-amber-500/10 text-amber-500'
          )}
        >
          Tags
          {tagFilters.length > 0 && (
            <Badge variant="outline" className="ml-2 h-4 px-1 text-[10px] font-mono">
              {tagFilters.length}
            </Badge>
          )}
          <ChevronDown className="ml-2 h-3 w-3" />
        </Button>

        {showTagDropdown && availableTags.length > 0 && (
          <div className="absolute top-full left-0 mt-1 z-10 min-w-[200px] max-w-[300px] bg-black/95 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl">
            <div className="p-3 max-h-60 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={tagFilters.includes(tag) ? 'outline' : 'default'}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      'cursor-pointer transition-colors',
                      tagFilters.includes(tag)
                        ? 'border-amber-500/30 bg-amber-500/20 text-amber-500'
                        : 'bg-white/5 text-white/40 hover:bg-white/10'
                    )}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Date Filter */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDateDropdown(!showDateDropdown)}
          className={cn(
            'border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
            dateFilter && 'border-amber-500/30 bg-amber-500/10 text-amber-500'
          )}
        >
          Due Date
          {dateFilter && (
            <Badge variant="outline" className="ml-2 h-4 px-1 text-[10px]">
              {dateFilter === 'overdue'
                ? '!'
                : dateFilter === 'today'
                  ? 'T'
                  : dateFilter === 'this_week'
                    ? 'W'
                    : 'M'}
            </Badge>
          )}
          <ChevronDown className="ml-2 h-3 w-3" />
        </Button>

        {showDateDropdown && (
          <div className="absolute top-full left-0 mt-1 z-10 min-w-[160px] bg-black/95 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl">
            <div className="p-1 space-y-1">
              <button
                type="button"
                onClick={() => {
                  onDateFilterChange(dateFilter === 'overdue' ? null : 'overdue');
                  setShowDateDropdown(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm rounded-md transition-colors',
                  'hover:bg-white/10',
                  dateFilter === 'overdue' ? 'bg-red-500/20 text-red-500' : 'text-white/70'
                )}
              >
                Overdue
              </button>
              <button
                type="button"
                onClick={() => {
                  onDateFilterChange(dateFilter === 'today' ? null : 'today');
                  setShowDateDropdown(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm rounded-md transition-colors',
                  'hover:bg-white/10',
                  dateFilter === 'today' ? 'bg-amber-500/20 text-amber-500' : 'text-white/70'
                )}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  onDateFilterChange(dateFilter === 'this_week' ? null : 'this_week');
                  setShowDateDropdown(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm rounded-md transition-colors',
                  'hover:bg-white/10',
                  dateFilter === 'this_week' ? 'bg-blue-500/20 text-blue-500' : 'text-white/70'
                )}
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => {
                  onDateFilterChange(dateFilter === 'this_month' ? null : 'this_month');
                  setShowDateDropdown(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm rounded-md transition-colors',
                  'hover:bg-white/10',
                  dateFilter === 'this_month' ? 'bg-purple-500/20 text-purple-500' : 'text-white/70'
                )}
              >
                This Month
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Clear All Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="text-white/40 hover:text-white/60 hover:bg-white/5"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}

      {/* Close dropdowns on outside click */}
      <button
        type="button"
        className="fixed inset-0 z-0 cursor-default bg-transparent border-0"
        onClick={() => {
          setShowPriorityDropdown(false);
          setShowTagDropdown(false);
          setShowDateDropdown(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setShowPriorityDropdown(false);
            setShowTagDropdown(false);
            setShowDateDropdown(false);
          }
        }}
        aria-label="Close filters"
      />
    </div>
  );
}
