/**
 * Column Component
 *
 * Kanban column that displays tasks for a specific status.
 * Acts as a drop zone for drag-and-drop operations.
 *
 * Design: Minimalist column with subtle gradient header
 */

'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Column as ColumnType, TaskItem } from '@/lib/kanban';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';

interface ColumnProps {
  column: ColumnType;
  tasks: TaskItem[];
  onTaskClick?: (task: TaskItem) => void;
}

const columnColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  amber: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/10',
    text: 'text-amber-500',
    glow: 'shadow-amber-500/10',
  },
  blue: {
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/10',
    text: 'text-blue-500',
    glow: 'shadow-blue-500/10',
  },
  emerald: {
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/10',
    text: 'text-emerald-500',
    glow: 'shadow-emerald-500/10',
  },
  slate: {
    bg: 'bg-slate-500/5',
    border: 'border-slate-500/10',
    text: 'text-slate-400',
    glow: 'shadow-slate-500/10',
  },
};

export function Column({ column, tasks, onTaskClick }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const colors = columnColors[column.color];

  return (
    <div
      className={cn(
        'flex flex-col h-full min-w-[280px] max-w-[280px]',
        'bg-black/40 backdrop-blur-sm rounded-xl',
        'border border-white/5',
        'overflow-hidden'
      )}
    >
      {/* Column header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3',
          'border-b border-white/5',
          colors.bg,
          isOver && colors.glow
        )}
      >
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full', colors.bg.replace('/5', '/100'))} />
          <h2 className={cn('text-sm font-semibold tracking-tight', colors.text)}>
            {column.title}
          </h2>
        </div>
        <span
          className={cn('text-xs font-mono px-2 py-0.5 rounded-sm', 'bg-white/5 text-white/40')}
        >
          {tasks.length}
        </span>
      </div>

      {/* Tasks container - drop zone */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            'flex-1 p-3 space-y-3 overflow-y-auto',
            'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10',
            'hover:scrollbar-thumb-white/20',
            // Drag over state
            isOver && 'bg-white/[0.02]'
          )}
        >
          {tasks.length === 0 ? (
            <div className={cn('h-32 flex items-center justify-center', 'text-white/20 text-sm')}>
              Drop tasks here
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard key={task.id} task={task} onClick={() => onTaskClick?.(task)} />
            ))
          )}
        </div>
      </SortableContext>

      {/* Bottom gradient fade */}
      <div
        className={cn('h-12 bg-gradient-to-t from-black/80 to-transparent pointer-events-none')}
      />
    </div>
  );
}
