import Link from 'next/link';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Session {
  conversation_id: string;
  user_id: string;
  platform: string;
  title?: string;
  visibility: string;
  is_archived: number;
  message_count: number;
  session_count: number;
  total_tokens: number;
  first_message_at?: number;
  last_message_at?: number;
  created_at: number;
  updated_at: number;
}

async function getSessions(): Promise<Session[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/sessions?limit=20`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

async function getStats(): Promise<{
  totalSessions: number;
  totalMessages: number;
  totalUsers: number;
} | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/stats`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return {
      totalSessions: json.data?.totalSessions || 0,
      totalMessages: json.data?.totalMessages || 0,
      totalUsers: json.data?.totalUsers || 0,
    };
  } catch {
    return null;
  }
}

function formatTimestamp(ts: number | undefined): string {
  if (!ts) return 'Unknown';
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export default async function SessionsPage() {
  const [sessions, stats] = await Promise.all([getSessions(), getStats()]);

  const hasData = sessions.length > 0;

  return (
    <Shell title="Sessions" description="Monitor active and historical user sessions">
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Sessions' }]} />

        {/* Session Statistics */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats ? formatNumber(stats.totalSessions) : '—'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats ? 'All time' : 'No data yet'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats ? formatNumber(stats.totalMessages) : '—'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats ? 'Across all sessions' : 'No data yet'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats ? formatNumber(stats.totalUsers) : '—'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats ? 'Unique users' : 'No data yet'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sessions List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
            <CardDescription>
              {hasData
                ? `Showing ${sessions.length} most recent sessions`
                : 'No sessions yet. Start a conversation to see sessions here.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {hasData ? (
                sessions.map((session) => (
                  <div
                    key={session.conversation_id}
                    className="flex items-center justify-between border-b border-border last:border-0 pb-4 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">
                          {session.title || `Session ${session.conversation_id.slice(0, 8)}...`}
                        </p>
                        <Badge variant="outline" className="text-xs capitalize">
                          {session.platform}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{session.message_count} messages</span>
                        <span>•</span>
                        <span>{formatNumber(session.total_tokens)} tokens</span>
                        <span>•</span>
                        <span>{formatTimestamp(session.last_message_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={session.visibility === 'public' ? 'success' : 'secondary'}
                        className="shrink-0"
                      >
                        {session.visibility}
                      </Badge>
                      <Link href={`/sessions/${session.conversation_id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No sessions available. Sessions will appear here once users start conversations.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
