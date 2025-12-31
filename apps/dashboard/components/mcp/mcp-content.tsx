'use client';

import { RefreshCw, Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMCPStatusWithRefresh } from '@/lib/hooks/use-mcp-status';
import { MCPServerCard } from './mcp-server-card';

const formatLastUpdated = (timestamp?: number) => {
  if (!timestamp) {
    return 'Never';
  }
  return new Date(timestamp).toLocaleTimeString();
};

function MCPServerCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div>
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MCPContent() {
  const { data, isLoading, isFetching, refresh } = useMCPStatusWithRefresh();

  const overallStatusVariant = data
    ? data.overallStatus === 'healthy'
      ? 'success'
      : data.overallStatus === 'degraded'
        ? 'warning'
        : 'destructive'
    : 'secondary';

  return (
    <>
      {/* Header with Status and Refresh */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Server Status</CardTitle>
                <CardDescription>
                  Last updated: {formatLastUpdated(data?.lastUpdated)}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={overallStatusVariant}>{data?.overallStatus || 'loading'}</Badge>
              <Button size="sm" variant="outline" onClick={refresh} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* MCP Servers Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <MCPServerCardSkeleton />
          <MCPServerCardSkeleton />
          <MCPServerCardSkeleton />
        </div>
      ) : data?.servers && data.servers.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.servers.map((server) => (
            <MCPServerCard key={server.name} server={server} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center py-8">
              No MCP servers configured. Configure servers to see their status here.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
