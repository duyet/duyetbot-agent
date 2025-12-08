import { Clock } from 'lucide-react';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AgentStep {
  step_id: string;
  event_id: string;
  message_id?: string;
  parent_step_id?: string;
  agent_name: string;
  agent_type: 'agent' | 'worker';
  sequence: number;
  started_at?: number;
  completed_at?: number;
  duration_ms: number;
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  reasoning_tokens: number;
  model?: string;
  tools_used?: string;
  tool_calls_count: number;
  error_type?: string;
  error_message?: string;
  created_at: number;
}

async function getEvents(): Promise<AgentStep[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/events?limit=20`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

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

export default async function EventsPage() {
  const events = await getEvents();
  const hasData = events.length > 0;

  return (
    <Shell title="Events" description="Real-time event timeline and system activities">
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Events' }]} />

        {/* Events Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Event Timeline</CardTitle>
            <CardDescription>
              {hasData
                ? `Showing ${events.length} recent agent execution steps`
                : 'No events yet. Events will appear here when agents process requests.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {hasData ? (
                events.map((event) => (
                  <div
                    key={event.step_id}
                    className="flex gap-4 border-l-2 border-border pl-4 relative"
                  >
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
                          {event.agent_name}
                          <span className="text-muted-foreground font-normal ml-1">
                            ({event.agent_type})
                          </span>
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimestamp(event.completed_at || event.started_at)}
                        {event.duration_ms > 0 && ` • ${formatDuration(event.duration_ms)}`}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        {(event.input_tokens > 0 || event.output_tokens > 0) && (
                          <span>{event.input_tokens + event.output_tokens} tokens</span>
                        )}
                        {event.tool_calls_count > 0 && (
                          <>
                            <span>•</span>
                            <span>{event.tool_calls_count} tool calls</span>
                          </>
                        )}
                        {event.model && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[150px]">{event.model}</span>
                          </>
                        )}
                      </div>
                      {event.error_message && (
                        <p className="text-xs text-destructive mt-2 line-clamp-2">
                          {event.error_message}
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
      </div>
    </Shell>
  );
}
