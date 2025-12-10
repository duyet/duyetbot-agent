'use client';

import { ArrowRight, Server } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMCPStatus } from '@/lib/hooks/use-mcp-status';

/**
 * MCP Status Card
 * Displays the status of all MCP servers with tool counts and connection status
 */
export function MCPStatusCard() {
  const { data, isLoading } = useMCPStatus();

  if (isLoading) {
    return <MCPStatusCardSkeleton />;
  }

  const servers = data?.servers ?? [];

  return (
    <Card>
      <CardHeader className="pb-3 flex items-center justify-between">
        <div className="flex-1">
          <CardTitle className="text-base">MCP Servers</CardTitle>
        </div>
        <Link href="/mcp">
          <Button variant="ghost" size="sm" className="gap-1">
            Details
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {servers.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">No MCP servers configured</p>
            </div>
          ) : (
            servers.map((server) => {
              const statusClass =
                server.status === 'online'
                  ? 'status-online'
                  : server.status === 'offline'
                    ? 'status-offline'
                    : 'status-offline';

              const statusTextClass =
                server.status === 'online'
                  ? 'text-success'
                  : server.status === 'offline'
                    ? 'text-destructive'
                    : 'text-muted-foreground';

              return (
                <div
                  key={server.name}
                  className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2.5 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Server className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{server.displayName}</p>
                      {server.toolCount !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          {server.toolCount} tool{server.toolCount !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className={`status-dot ${statusClass}`} />
                    <span className={`text-xs font-medium ${statusTextClass}`}>
                      {server.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for MCP Status Card
 */
function MCPStatusCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3 flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-20" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {['skeleton-1', 'skeleton-2', 'skeleton-3'].map((key) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2.5"
            >
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-4 w-4" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20 mt-1" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
