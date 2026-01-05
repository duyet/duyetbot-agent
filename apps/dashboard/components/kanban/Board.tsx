/**
 * Board Component
 *
 * Main Kanban board with drag-and-drop functionality.
 * Manages task movement between columns and state updates.
 *
 * Design: Horizontal scrollable board with smooth animations
 */

'use client';

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useState } from 'react';
import type { ColumnId, TaskItem, UpdateTaskInput } from '@/lib/kanban';
import { COLUMNS } from '@/lib/kanban';
import { cn } from '@/lib/utils';
import { Column } from './Column';
import { TaskCard } from './TaskCard';

interface BoardProps {
  tasks: TaskItem[];
  onTaskUpdate?: (taskId: string, updates: UpdateTaskInput) => void;
  onTaskClick?: (task: TaskItem) => void;
}

// Map status to column
function getStatusColumn(status: TaskItem['status']): ColumnId {
  switch (status) {
    case 'pending':
    case 'blocked':
      return 'backlog';
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'done';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'backlog';
  }
}

// Map column to first status in that column
function getColumnStatus(columnId: ColumnId): TaskItem['status'] {
  const column = COLUMNS.find((c) => c.id === columnId);
  return column?.status[0] || 'pending';
}

export function Board({ tasks, onTaskUpdate, onTaskClick }: BoardProps) {
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);

  // Group tasks by column
  const tasksByColumn = COLUMNS.reduce(
    (acc, column) => {
      const columnTasks = tasks.filter((task) => column.status.includes(task.status));
      acc[column.id] = columnTasks;
      return acc;
    },
    {} as Record<ColumnId, TaskItem[]>
  );

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      return;
    }

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) {
      return;
    }

    const targetColumnId = over.id as ColumnId;
    const currentColumnId = getStatusColumn(activeTask.status);

    // Only update if moving to a different column
    if (targetColumnId !== currentColumnId) {
      const newStatus = getColumnStatus(targetColumnId);
      const updates: UpdateTaskInput = {
        id: activeTask.id,
        status: newStatus,
        completed_at: newStatus === 'completed' ? Date.now() : activeTask.completed_at || undefined,
      };
      onTaskUpdate?.(activeTask.id, updates);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Board header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div>
          <h1 className="text-xl font-semibold text-white">Tasks</h1>
          <p className="text-sm text-white/40 mt-1">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} across {COLUMNS.length} columns
          </p>
        </div>
      </div>

      {/* Kanban board - horizontally scrollable */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className={cn('flex gap-4 h-full p-6', 'snap-x snap-mandatory')}>
            {COLUMNS.map((column) => (
              <div key={column.id} className="snap-start">
                <Column
                  column={column}
                  tasks={tasksByColumn[column.id] || []}
                  onTaskClick={onTaskClick}
                />
              </div>
            ))}
          </div>

          {/* Drag overlay - shows what's being dragged */}
          <DragOverlay>
            {activeTask && (
              <div className="rotate-3 scale-105 shadow-2xl">
                <TaskCard task={activeTask} isDragging />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
