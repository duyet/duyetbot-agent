import { AlertCircle, CheckCircle, MessageSquare, Zap } from 'lucide-react';
import React from 'react';
import { RecentEvent } from '../../types';

interface RecentEventsTableProps {
  events: RecentEvent[];
  loading?: boolean;
}

const eventTypeIcons: Record<string, React.FC<{ className: string }>> = {
  message: MessageSquare,
  error: AlertCircle,
  agent_run: Zap,
  task_completion: CheckCircle,
};

const statusColors: Record<string, string> = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

export const RecentEventsTable: React.FC<RecentEventsTableProps> = ({
  events,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Recent Events</h2>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded border border-gray-200 p-4 dark:border-gray-700"
            >
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Recent Events</h2>

      <div className="space-y-4">
        {events.map((event) => {
          const IconComponent = eventTypeIcons[event.type];
          const statusColor = statusColors[event.status];

          return (
            <div
              key={event.id}
              className="flex items-start gap-4 rounded border border-gray-100 p-4 dark:border-gray-700"
            >
              <div className="mt-1 flex-shrink-0">
                {IconComponent ? (
                  <IconComponent className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                ) : null}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{event.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    {event.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {event.agent && <span>•</span>}
                  {event.agent && <span>{event.agent}</span>}
                  {event.tokens && (
                    <>
                      <span>•</span>
                      <span>{event.tokens} tokens</span>
                    </>
                  )}
                  {event.duration && (
                    <>
                      <span>•</span>
                      <span>{event.duration}ms</span>
                    </>
                  )}
                </div>
              </div>

              <span
                className={`flex-shrink-0 rounded px-2 py-1 text-xs font-semibold ${statusColor}`}
              >
                {event.status === 'success' && 'Done'}
                {event.status === 'error' && 'Error'}
                {event.status === 'pending' && 'Pending'}
              </span>
            </div>
          );
        })}
      </div>

      {events.length === 0 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">No events yet</p>
      )}
    </div>
  );
};
