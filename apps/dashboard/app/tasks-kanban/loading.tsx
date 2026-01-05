/**
 * Tasks Kanban Loading State
 *
 * Skeleton loading for the Kanban board
 */

import { Skeleton } from '@/components/ui/skeleton';

export default function TasksKanbanLoading() {
  return (
    <div className="h-full flex flex-col bg-[#050505]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <Skeleton className="h-7 w-32 bg-white/5" />
        <Skeleton className="h-9 w-32 bg-white/5" />
      </div>
      <div className="flex-1 flex gap-4 p-6 overflow-x-auto">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="min-w-[280px] max-w-[280px] space-y-3">
            <Skeleton className="h-10 w-full bg-white/5 rounded-lg" />
            <Skeleton className="h-32 w-full bg-white/5 rounded-lg" />
            <Skeleton className="h-32 w-full bg-white/5 rounded-lg" />
            <Skeleton className="h-32 w-full bg-white/5 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
