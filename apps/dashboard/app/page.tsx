import { Shell } from '@/components/layout/shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Stats {
  totalMessages: number;
  totalSessions: number;
  totalUsers: number;
  totalTokens: number;
  platformBreakdown: { platform: string; count: number }[];
}

async function getStats(): Promise<Stats | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/stats`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return null;
    }
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

async function getRecentMessages() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/messages?limit=5`, {
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

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) {
    return 'Just now';
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function DashboardPage() {
  const [stats, messages] = await Promise.all([getStats(), getRecentMessages()]);

  const hasData = stats && stats.totalMessages > 0;

  return (
    <Shell
      title="Dashboard Overview"
      description="Welcome to duyetbot. Here is your system overview."
    >
      <div className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              {hasData && <Badge variant="secondary">Live</Badge>}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {hasData ? formatNumber(stats.totalMessages) : '—'}
              </div>
              <p className="text-xs text-muted-foreground">
                {hasData ? 'All time' : 'No data yet'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              {hasData && <Badge variant="success">Online</Badge>}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {hasData ? formatNumber(stats.totalSessions) : '—'}
              </div>
              <p className="text-xs text-muted-foreground">
                {hasData ? `${stats.totalUsers} unique users` : 'No sessions'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Token Usage</CardTitle>
              {hasData && <Badge variant="info">Active</Badge>}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {hasData ? formatNumber(stats.totalTokens) : '—'}
              </div>
              <p className="text-xs text-muted-foreground">
                {hasData ? 'Total tokens used' : 'No usage'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <Badge variant="success">Healthy</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">99.9%</div>
              <p className="text-xs text-muted-foreground">Uptime</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your most recent interactions and events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No messages yet. Start a conversation to see activity here.
                </p>
              ) : (
                messages.map((msg: any) => (
                  <div
                    key={msg.message_id || msg.id}
                    className="flex items-center justify-between border-b border-border last:border-0 pb-4 last:pb-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none truncate max-w-md">
                        {msg.content?.substring(0, 60)}
                        {msg.content?.length > 60 ? '...' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {msg.platform} • {formatTimestamp(msg.created_at)}
                      </p>
                    </div>
                    <Badge variant="outline">{msg.role}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Platform Distribution */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasData || stats.platformBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No platform data available
                </p>
              ) : (
                stats.platformBreakdown.map((p) => {
                  const percentage = Math.round((p.count / stats.totalMessages) * 100);
                  return (
                    <div key={p.platform}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium capitalize">{p.platform}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(p.count)} ({percentage}%)
                        </p>
                      </div>
                      <div className="h-2 w-full rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agents Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: 'Telegram Bot', status: 'online' },
                  { name: 'GitHub Bot', status: 'online' },
                  { name: 'Research Agent', status: 'online' },
                ].map((agent) => (
                  <div key={agent.name} className="flex items-center justify-between">
                    <p className="text-sm">{agent.name}</p>
                    <Badge variant={agent.status === 'online' ? 'success' : 'destructive'}>
                      {agent.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
