/**
 * TaskForm Component
 *
 * Form for creating or editing tasks.
 * Minimalist design with clear visual hierarchy.
 *
 * Design: Industrial form with sharp inputs and amber accents
 */

'use client';

import { format } from 'date-fns';
import { Calendar, Plus, Tag, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AddTaskInput, TaskItem } from '@/lib/kanban';
import { cn } from '@/lib/utils';

interface TaskFormProps {
  onSubmit: (data: AddTaskInput) => void;
  onCancel?: () => void;
  initialTask?: TaskItem;
  isLoading?: boolean;
}

export function TaskForm({ onSubmit, onCancel, initialTask, isLoading }: TaskFormProps) {
  const [description, setDescription] = useState(initialTask?.description || '');
  const [priority, setPriority] = useState(initialTask?.priority || 5);
  const [dueDate, setDueDate] = useState(
    initialTask?.due_date ? format(new Date(initialTask.due_date), 'yyyy-MM-dd') : ''
  );
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(initialTask?.tags || []);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      return;
    }

    onSubmit({
      description: description.trim(),
      priority,
      due_date: dueDate ? new Date(dueDate).getTime() : undefined,
      tags,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What needs to be done?"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          autoFocus
          required
        />
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <Label htmlFor="priority">Priority (1-10)</Label>
        <div className="flex items-center gap-3">
          <Input
            id="priority"
            type="number"
            min="1"
            max="10"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-20 bg-white/5 border-white/10 text-white"
          />
          <div className="flex-1 flex gap-1">
            {[1, 3, 5, 8, 10].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={cn(
                  'flex-1 py-1.5 text-xs font-mono rounded-sm transition-colors',
                  'border border-white/5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
                  priority === p
                    ? 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Due Date */}
      <div className="space-y-2">
        <Label htmlFor="dueDate">Due Date</Label>
        <div className="relative">
          <Input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-white/5 border-white/10 text-white pl-10"
          />
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor="tags">Tags</Label>
        <div className="flex gap-2">
          <Input
            id="tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            placeholder="Add a tag..."
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
          <Button
            type="button"
            onClick={handleAddTag}
            variant="outline"
            className="shrink-0 border-white/10 hover:bg-white/5"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {tags.map((tag, index) => (
              <span
                key={`${tag}-${index}`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-mono bg-white/5 border border-white/10 text-white/60"
              >
                <Tag className="h-3 w-3" />
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  aria-label={`Remove tag: ${tag}`}
                  className="hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 rounded-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-white/5">
        <Button
          type="submit"
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-medium"
          disabled={isLoading || !description.trim()}
        >
          {isLoading ? 'Saving...' : initialTask ? 'Update Task' : 'Create Task'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-white/10 hover:bg-white/5"
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
