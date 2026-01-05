/**
 * useTasks React Query Hook
 *
 * Custom hook for managing tasks with React Query.
 * Provides optimistic updates and automatic refetching.
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksClient } from './tasks-client';
import type { AddTaskInput, TaskItem, UpdateTaskInput } from './types';

export const TASKS_QUERY_KEY = ['tasks'] as const;

/**
 * Fetch all tasks for the Kanban board
 */
export function useTasks() {
  return useQuery({
    queryKey: TASKS_QUERY_KEY,
    queryFn: () => tasksClient.fetchAll(),
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Add a new task with optimistic update
 */
export function useAddTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddTaskInput) => tasksClient.add(data),
    onMutate: async (newTask) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData<TaskItem[]>(TASKS_QUERY_KEY);

      // Optimistically add task
      const optimisticTask: TaskItem = {
        id: `temp-${Date.now()}`,
        description: newTask.description,
        status: 'pending',
        priority: newTask.priority || 5,
        due_date: newTask.due_date || null,
        completed_at: null,
        parent_task_id: newTask.parent_task_id || null,
        tags: newTask.tags || [],
        created_at: Date.now(),
        updated_at: Date.now(),
        metadata: newTask.metadata || null,
      };

      queryClient.setQueryData<TaskItem[]>(TASKS_QUERY_KEY, (old = []) => [...old, optimisticTask]);

      return { previousTasks };
    },
    onError: (_err, _, context) => {
      // Rollback on error
      queryClient.setQueryData(TASKS_QUERY_KEY, context?.previousTasks);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}

/**
 * Update a task with optimistic update
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTaskInput) => tasksClient.update(data),
    onMutate: async (updatedTask) => {
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });

      const previousTasks = queryClient.getQueryData<TaskItem[]>(TASKS_QUERY_KEY);

      queryClient.setQueryData<TaskItem[]>(TASKS_QUERY_KEY, (old = []) =>
        old.map((task) => (task.id === updatedTask.id ? { ...task, ...updatedTask } : task))
      );

      return { previousTasks };
    },
    onError: (_err, _, context) => {
      queryClient.setQueryData(TASKS_QUERY_KEY, context?.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}

/**
 * Delete a task with optimistic update
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tasksClient.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });

      const previousTasks = queryClient.getQueryData<TaskItem[]>(TASKS_QUERY_KEY);

      queryClient.setQueryData<TaskItem[]>(TASKS_QUERY_KEY, (old = []) =>
        old.filter((task) => task.id !== id)
      );

      return { previousTasks };
    },
    onError: (_err, _, context) => {
      queryClient.setQueryData(TASKS_QUERY_KEY, context?.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}

/**
 * Complete a task with optimistic update
 */
export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tasksClient.complete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });

      const previousTasks = queryClient.getQueryData<TaskItem[]>(TASKS_QUERY_KEY);

      queryClient.setQueryData<TaskItem[]>(TASKS_QUERY_KEY, (old = []) =>
        old.map((task) =>
          task.id === id
            ? { ...task, status: 'completed' as const, completed_at: Date.now() }
            : task
        )
      );

      return { previousTasks };
    },
    onError: (_err, _, context) => {
      queryClient.setQueryData(TASKS_QUERY_KEY, context?.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}
