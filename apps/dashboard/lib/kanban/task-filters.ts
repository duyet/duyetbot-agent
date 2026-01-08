/**
 * Task Filter Utilities
 *
 * Functions to filter tasks based on search, priority, tags, and due date.
 * Combines all filter criteria into a single filter function.
 */

import { matchesDateFilter } from './date-filters';
import type { DateFilterType, TaskFilters, TaskItem } from './types';

export function filterTasks(tasks: TaskItem[], filters: TaskFilters): TaskItem[] {
  return tasks.filter((task) => {
    if (!matchesSearch(task, filters.searchQuery)) {
      return false;
    }

    if (!matchesPriority(task.priority, filters.priorityFilter)) {
      return false;
    }

    if (!matchesTags(task.tags, filters.tagFilters)) {
      return false;
    }

    if (!matchesDateFilter(task.due_date, filters.dateFilter)) {
      return false;
    }

    return true;
  });
}

function matchesSearch(task: TaskItem, query: string): boolean {
  if (!query.trim()) {
    return true;
  }

  const searchTerm = query.toLowerCase();

  const descriptionMatch = task.description.toLowerCase().includes(searchTerm);

  const tagsMatch = task.tags.some((tag) => tag.toLowerCase().includes(searchTerm));

  return descriptionMatch || tagsMatch;
}

function matchesPriority(priority: number, filter: TaskFilters['priorityFilter']): boolean {
  if (!filter) {
    return true;
  }

  switch (filter) {
    case 'high':
      return priority >= 8;
    case 'medium':
      return priority >= 5 && priority < 8;
    case 'low':
      return priority < 5;
    default:
      return true;
  }
}

function matchesTags(taskTags: string[], filterTags: string[]): boolean {
  if (filterTags.length === 0) {
    return true;
  }

  return filterTags.every((filterTag) => taskTags.includes(filterTag));
}

export function getAllTags(tasks: TaskItem[]): string[] {
  const tagSet = new Set<string>();
  tasks.forEach((task) => {
    task.tags.forEach((tag) => {
      tagSet.add(tag);
    });
  });
  return Array.from(tagSet).sort();
}
