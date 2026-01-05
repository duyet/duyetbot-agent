/**
 * TaskDetails Component
 *
 * Modal dialog for viewing and editing task details.
 * Displays full task information with edit functionality.
 *
 * Design: Clean modal with subtle animations
 */

'use client';

import { formatDistanceToNow } from 'date-fns';
import { Calendar, Clock, Edit2, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AddTaskInput, TaskItem, UpdateTaskInput } from '@/lib/kanban';
import { cn } from '@/lib/utils';
import { TaskForm } from './TaskForm';

interface TaskDetailsProps {
  task: TaskItem | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: (id: string, updates: UpdateTaskInput) => void;
  onCreate?: (data: AddTaskInput) => void;
  onDelete?: (id: string) => void;
}

const statusColors = {
  pending: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  in_progress: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  blocked: 'text-red-500 bg-red-500/10 border-red-500/20',
  completed: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  cancelled: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

export function TaskDetails({
  task,
  open,
  onClose,
  onUpdate,
  onCreate,
  onDelete,
}: TaskDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // For creating new tasks, task is null - show form directly
  const isCreating = task === null;

  const handleSubmit = (data: AddTaskInput) => {
    if (isCreating) {
      onCreate?.(data);
    } else if (task) {
      // Convert AddTaskInput to UpdateTaskInput
      onUpdate?.(task.id, { id: task.id, ...data });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (task && confirm('Are you sure you want to delete this task?')) {
      setIsDeleting(true);
      onDelete?.(task.id);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        {/* Creating new task - show form directly */}
        {isCreating ? (
          <>
            <DialogHeader>
              <DialogTitle>Create Task</DialogTitle>
              <DialogDescription>Fill in the details for the new task.</DialogDescription>
            </DialogHeader>
            <TaskForm onSubmit={handleSubmit} onCancel={onClose} />
          </>
        ) : (
          <>
            {/* Viewing/editing existing task */}
            {isEditing ? (
              <>
                <DialogHeader>
                  <DialogTitle>Edit Task</DialogTitle>
                  <DialogDescription>Update task details below.</DialogDescription>
                </DialogHeader>
                <TaskForm
                  initialTask={task}
                  onSubmit={handleSubmit}
                  onCancel={() => setIsEditing(false)}
                />
              </>
            ) : (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <DialogTitle className="text-lg">{task.description}</DialogTitle>
                      <DialogDescription className="mt-2">
                        Task ID:{' '}
                        <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded font-mono">
                          {task.id}
                        </code>
                      </DialogDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setIsEditing(true)}
                      className="shrink-0 border-white/10 hover:bg-white/5"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/40">Status</span>
                    <Badge variant="outline" className={statusColors[task.status]}>
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>

                  {/* Priority */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/40">Priority</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'font-mono',
                        task.priority >= 8
                          ? 'border-amber-500/20 bg-amber-500/10 text-amber-500'
                          : task.priority >= 5
                            ? 'border-blue-500/20 bg-blue-500/10 text-blue-500'
                            : 'border-slate-500/20 bg-slate-500/10 text-slate-400'
                      )}
                    >
                      P{task.priority}
                    </Badge>
                  </div>

                  {/* Due Date */}
                  {task.due_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/40">Due Date</span>
                      <span
                        className={cn(
                          'text-sm flex items-center gap-1.5',
                          task.due_date < Date.now() && !task.completed_at
                            ? 'text-red-400'
                            : 'text-white/60'
                        )}
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(task.due_date).toLocaleDateString()}
                        <span className="text-white/30">
                          ({formatDistanceToNow(new Date(task.due_date), { addSuffix: true })})
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Completed Date */}
                  {task.completed_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/40">Completed</span>
                      <span className="text-sm text-emerald-500/60 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}
                      </span>
                    </div>
                  )}

                  {/* Tags */}
                  {task.tags.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-sm text-white/40">Tags</span>
                      <div className="flex flex-wrap gap-2">
                        {task.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-mono bg-white/5 border border-white/10 text-white/60"
                          >
                            <Tag className="h-3 w-3" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Created Date */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-sm text-white/40">Created</span>
                    <span className="text-sm text-white/30">
                      {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  {onDelete && (
                    <Button
                      variant="outline"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/30"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}
                  <Button onClick={onClose}>Close</Button>
                </DialogFooter>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
