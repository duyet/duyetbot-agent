/**
 * TaskCard Component
 *
 * Individual task card for the Kanban board.
 * Features drag handle, priority indicator, tags, and metadata display.
 *
 * Design: Neo-industrial with sharp corners, amber accents, high contrast
 */

'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Calendar, CheckCircle2, GripVertical, Hash, ListTree } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TaskItem } from '@/lib/kanban';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: TaskItem;
  isDragging?: boolean;
  onClick?: () => void;
}

const priorityColors = {
  high: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  medium: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  low: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

const statusIcons = {
  blocked: AlertCircle,
  pending: Hash,
  in_progress: Calendar,
  completed: CheckCircle2,
  cancelled: AlertCircle,
};

export function TaskCard({ task, isDragging, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSorting,
  } = useSortable({
    id: task.id,
    disabled: false,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityLevel = task.priority >= 8 ? 'high' : task.priority >= 5 ? 'medium' : 'low';
  const StatusIcon = statusIcons[task.status];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        // Base styles - neo-industrial aesthetic
        'group relative bg-[#0A0A0A] border border-white/5 rounded-lg',
        'p-4 cursor-grab active:cursor-grabbing',
        'transition-all duration-200',
        // Hover state
        'hover:border-white/10 hover:bg-[#0F0F0F]',
        // Dragging state
        (isDragging || isSorting) && 'opacity-50 scale-95 shadow-2xl',
        // Focus state
        'focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:border-amber-500/30'
      )}
      onClick={onClick}
      {...attributes}
    >
      {/* Drag handle - subtle, appears on hover */}
      <div
        {...listeners}
        className={cn(
          'absolute top-3 right-3 opacity-0 group-hover:opacity-100',
          'transition-opacity duration-150',
          'text-white/20 hover:text-white/40'
        )}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Header: Status icon + title */}
      <div className="flex items-start gap-3 mb-3 pr-6">
        <StatusIcon
          className={cn(
            'h-4 w-4 mt-0.5 shrink-0',
            task.status === 'blocked' && 'text-red-500',
            task.status === 'completed' && 'text-emerald-500',
            task.status === 'in_progress' && 'text-blue-500',
            task.status === 'pending' && 'text-amber-500',
            task.status === 'cancelled' && 'text-slate-500'
          )}
        />
        <h3
          className={cn(
            'font-medium text-sm leading-snug',
            'text-white/90',
            task.status === 'completed' && 'line-through text-white/40'
          )}
        >
          {task.description}
        </h3>
      </div>

      {/* Priority badge */}
      <div className="flex items-center gap-2 mb-3">
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-1.5 py-0 font-mono uppercase tracking-wider',
            priorityColors[priorityLevel]
          )}
        >
          P{task.priority}
        </Badge>

        {/* Subtasks count */}
        {task.parent_task_id && (
          <div className="flex items-center gap-1 text-[10px] text-white/30 font-mono">
            <ListTree className="h-3 w-3" />
            <span>Subtask</span>
          </div>
        )}
      </div>

      {/* Tags row */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded-sm font-mono bg-white/5 text-white/40 border border-white/5"
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-sm font-mono text-white/30">
              +{task.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer: Due date */}
      {task.due_date && (
        <div
          className={cn(
            'flex items-center gap-1.5 text-[11px] font-mono',
            task.due_date < Date.now() && !task.completed_at ? 'text-red-400' : 'text-white/30'
          )}
        >
          <Calendar className="h-3 w-3" />
          <span>{formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}</span>
        </div>
      )}

      {/* Completed timestamp */}
      {task.completed_at && (
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-500/50">
          <CheckCircle2 className="h-3 w-3" />
          <span>{formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}</span>
        </div>
      )}

      {/* Bottom accent line - priority indicator */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 h-0.5',
          priorityLevel === 'high' && 'bg-amber-500/50',
          priorityLevel === 'medium' && 'bg-blue-500/30',
          priorityLevel === 'low' && 'bg-slate-500/20'
        )}
      />
    </div>
  );
}
