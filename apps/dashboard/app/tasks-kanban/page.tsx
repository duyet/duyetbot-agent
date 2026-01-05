/**
 * Tasks Kanban Page
 *
 * Main Kanban dashboard page for task management.
 *
 * Design: Full-screen immersive experience with minimal chrome
 */

'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Board } from '@/components/kanban';
import { TaskDetails } from '@/components/kanban/TaskDetails';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AddTaskInput, TaskItem, UpdateTaskInput } from '@/lib/kanban';
import { TASKS_QUERY_KEY, useAddTask, useDeleteTask, useTasks, useUpdateTask } from '@/lib/kanban';
import { cn } from '@/lib/utils';

export default function TasksKanbanPage() {
  const queryClient = useQueryClient();
  const { data: tasks, isLoading, error } = useTasks();
  const addTask = useAddTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleTaskUpdate = (id: string, updates: UpdateTaskInput) => {
    updateTask.mutate(updates);
  };

  const handleTaskDelete = (id: string) => {
    deleteTask.mutate(id);
  };

  const handleCreateTask = (data: AddTaskInput) => {
    addTask.mutate(data, {
      onSuccess: () => {
        setIsCreateModalOpen(false);
      },
    });
  };

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-[#050505]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <Skeleton className="h-7 w-32 bg-white/5" />
          <Skeleton className="h-9 w-32 bg-white/5" />
        </div>
        <div className="flex-1 flex gap-4 p-6 overflow-x-auto">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="min-w-[280px] max-w-[280px] space-y-3">
              <Skeleton className="h-10 w-full bg-white/5" />
              <Skeleton className="h-32 w-full bg-white/5" />
              <Skeleton className="h-32 w-full bg-white/5" />
              <Skeleton className="h-32 w-full bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-[#050505]">
        <div className="text-center space-y-4">
          <div className="text-red-400 text-sm font-mono">Error loading tasks</div>
          <p className="text-white/40 text-sm max-w-md">
            {error instanceof Error
              ? error.message
              : 'Failed to load tasks. Please check your connection.'}
          </p>
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })}
            variant="outline"
            className="border-white/10"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#050505]">
      {/* Floating action button */}
      <div className="absolute bottom-6 right-6 z-10">
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className={cn(
            'h-14 w-14 rounded-full shadow-2xl',
            'bg-amber-500 hover:bg-amber-600 text-black',
            'transition-all duration-200',
            'hover:scale-105'
          )}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Main board */}
      <Board tasks={tasks || []} onTaskUpdate={handleTaskUpdate} onTaskClick={setSelectedTask} />

      {/* Task details modal */}
      <TaskDetails
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
      />

      {/* Create task modal */}
      <TaskDetails
        task={null}
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateTask}
      />
    </div>
  );
}
