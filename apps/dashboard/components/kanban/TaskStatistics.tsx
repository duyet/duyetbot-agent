/**
 * TaskStatistics Component
 *
 * Displays task statistics with summary cards, priority distribution chart,
 * and completion rate percentage.
 *
 * Design: Neo-industrial stats with amber accents
 */

'use client';

import { AlertCircle, CheckCircle2, Clock, ListTodo } from 'lucide-react';
import { PieChart } from '@/components/charts';
import type { TaskItem } from '@/lib/kanban';
import { cn } from '@/lib/utils';

interface TaskStatisticsProps {
  tasks: TaskItem[];
  className?: string;
}

export function TaskStatistics({ tasks, className }: TaskStatisticsProps) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const overdueTasks = tasks.filter(
    (t) => t.due_date && t.due_date < Date.now() && t.status !== 'completed'
  ).length;

  const statusBreakdown = tasks.reduce(
    (acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const priorityDistribution = [
    { name: 'High', value: tasks.filter((t) => t.priority >= 8).length },
    { name: 'Medium', value: tasks.filter((t) => t.priority >= 5 && t.priority < 8).length },
    { name: 'Low', value: tasks.filter((t) => t.priority < 5).length },
  ];

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const statsCards = [
    {
      label: 'Total Tasks',
      value: totalTasks,
      icon: ListTodo,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Completed',
      value: completedTasks,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Overdue',
      value: overdueTasks,
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      label: 'Completion Rate',
      value: `${completionRate}%`,
      icon: Clock,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
  ];

  const statusChartData = [
    { name: 'Pending', value: statusBreakdown.pending || 0 },
    { name: 'In Progress', value: statusBreakdown.in_progress || 0 },
    { name: 'Blocked', value: statusBreakdown.blocked || 0 },
    { name: 'Completed', value: statusBreakdown.completed || 0 },
    { name: 'Cancelled', value: statusBreakdown.cancelled || 0 },
  ].filter((item) => item.value > 0);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={cn(
                'relative p-4 rounded-lg border border-white/5',
                'bg-black/40 backdrop-blur-sm',
                'hover:border-white/10 transition-colors'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-white/40 font-mono uppercase tracking-wider">
                  {stat.label}
                </span>
                <div
                  className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center',
                    stat.bgColor
                  )}
                >
                  <Icon className={cn('h-4 w-4', stat.color)} />
                </div>
              </div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Distribution */}
        {statusChartData.length > 0 && (
          <div className="p-4 rounded-lg border border-white/5 bg-black/40 backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-white/60 mb-4">Status Distribution</h3>
            <div className="space-y-2">
              {statusChartData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span className="text-sm text-white/60">{item.name}</span>
                  <span className="text-sm font-mono text-white font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Priority Distribution */}
        {priorityDistribution.some((p) => p.value > 0) && (
          <div className="p-4 rounded-lg border border-white/5 bg-black/40 backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-white/60 mb-4">Priority Distribution</h3>
            <PieChart
              data={priorityDistribution.filter((p) => p.value > 0)}
              dataKey="value"
              nameKey="name"
              height={200}
              colors={['#ef4444', '#3b82f6', '#6b7280']}
              showLegend={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
