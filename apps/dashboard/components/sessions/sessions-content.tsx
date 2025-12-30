'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentSessions, useStats } from '@/lib/hooks/use-dashboard-data';
import { formatSessionNumber, formatSessionTimestamp } from './session-utils';

function StatsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

function SessionItemSkeleton() {
  return (
    <div className="flex items-center justify-between border-b border-border last:border-0 pb-4 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-8 w-14" />
      </div>
    </div>
  );
}

export function SessionsContent() {
  const { data: sessions, isLoading: sessionsLoading } = useRecentSessions(20);
  const { data: stats, isLoading: statsLoading } = useStats();

  const hasData = sessions && sessions.length > 0;

  return (
    <>
      {/* Session Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        {statsLoading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Total Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats ? formatSessionNumber(stats.totalSessions) : '—'}
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
                  {stats ? formatSessionNumber(stats.totalMessages) : '—'}
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
                  {stats ? formatSessionNumber(stats.totalUsers) : '—'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats ? 'Unique users' : 'No data yet'}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
          <CardDescription>
            {sessionsLoading
              ? 'Loading sessions...'
              : hasData
                ? `Showing ${sessions.length} most recent sessions`
                : 'No sessions yet. Start a conversation to see sessions here.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sessionsLoading ? (
              <>
                <SessionItemSkeleton />
                <SessionItemSkeleton />
                <SessionItemSkeleton />
                <SessionItemSkeleton />
                <SessionItemSkeleton />
              </>
            ) : hasData ? (
              sessions.map((session, index) => (
                <div
                  key={session.conversationId || `session-${index}`}
                  className="flex items-center justify-between border-b border-border last:border-0 pb-4 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">
                        {session.title ||
                          (session.conversationId
                            ? `Session ${session.conversationId.slice(0, 8)}...`
                            : `Session #${index + 1}`)}
                      </p>
                      <Badge variant="outline" className="text-xs capitalize">
                        {session.platform}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{session.messageCount} messages</span>
                      <span>•</span>
                      <span>{formatSessionNumber(session.totalTokens)} tokens</span>
                      <span>•</span>
                      <span>{formatSessionTimestamp(session.lastMessageAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={session.visibility === 'public' ? 'success' : 'secondary'}
                      className="shrink-0"
                    >
                      {session.visibility}
                    </Badge>
                    {session.conversationId && (
                      <Link href={`/sessions/${session.conversationId}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    )}
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
    </>
  );
}
