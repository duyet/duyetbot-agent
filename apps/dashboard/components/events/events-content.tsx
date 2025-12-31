'use client';

import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentEvents } from '@/lib/hooks/use-dashboard-data';

function formatTimestamp(ts: number | undefined): string {
  if (!ts) {
    return 'Unknown';
  }
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function getStatusVariant(
  status: string
): 'success' | 'warning' | 'destructive' | 'info' | 'secondary' {
  switch (status) {
    case 'success':
      return 'success';
    case 'running':
    case 'pending':
      return 'warning';
    case 'error':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'success':
      return 'Completed';
    case 'running':
      return 'Running';
    case 'pending':
      return 'Pending';
    case 'error':
      return 'Error';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

function EventItemSkeleton() {
  return (
    <div className="flex gap-4 border-l-2 border-border pl-4 relative">
      <Skeleton className="absolute -left-[5px] top-1 w-2 h-2 rounded-full" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-3 w-32 mt-1" />
        <Skeleton className="h-3 w-40 mt-2" />
      </div>
      <Skeleton className="h-5 w-20 shrink-0 self-start" />
    </div>
  );
}

export function EventsContent() {
  const { data: events, isLoading } = useRecentEvents(20);

  const hasData = events && events.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Timeline</CardTitle>
        <CardDescription>
          {isLoading
            ? 'Loading events...'
            : hasData
              ? `Showing ${events.length} recent agent execution steps`
              : 'No events yet. Events will appear here when agents process requests.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
            <>
              <EventItemSkeleton />
              <EventItemSkeleton />
              <EventItemSkeleton />
              <EventItemSkeleton />
              <EventItemSkeleton />
            </>
          ) : hasData ? (
            events.map((event) => (
              <div key={event.stepId} className="flex gap-4 border-l-2 border-border pl-4 relative">
                <div
                  className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full ${
                    event.status === 'success'
                      ? 'bg-green-500'
                      : event.status === 'error'
                        ? 'bg-red-500'
                        : event.status === 'running'
                          ? 'bg-yellow-500'
                          : 'bg-primary'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm font-medium truncate">
                      {event.agentName}
                      <span className="text-muted-foreground font-normal ml-1">
                        ({event.agentType})
                      </span>
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimestamp(event.completedAt || event.startedAt)}
                    {event.durationMs > 0 && ` • ${formatDuration(event.durationMs)}`}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    {(event.inputTokens > 0 || event.outputTokens > 0) && (
                      <span>{event.inputTokens + event.outputTokens} tokens</span>
                    )}
                    {event.toolCallsCount > 0 && (
                      <>
                        <span>•</span>
                        <span>{event.toolCallsCount} tool calls</span>
                      </>
                    )}
                    {event.model && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[150px]">{event.model}</span>
                      </>
                    )}
                  </div>
                  {event.errorMessage && (
                    <p className="text-xs text-destructive mt-2 line-clamp-2">
                      {event.errorMessage}
                    </p>
                  )}
                </div>
                <Badge variant={getStatusVariant(event.status)} className="shrink-0 self-start">
                  {getStatusLabel(event.status)}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No events available. Start a conversation to see agent execution events here.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
