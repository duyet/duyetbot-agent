'use client';

import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Key,
  Server,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatResponseTime,
  getCardBorderClass,
  getServerStatusLabel,
  getStatusBadgeVariant,
  truncateUrl,
} from '@/lib/mcp';
import type { MCPServerStatus } from '@/lib/mcp/types';
import { cn } from '@/lib/utils';

interface MCPServerCardProps {
  server: MCPServerStatus;
}

export function MCPServerCard({ server }: MCPServerCardProps) {
  const [toolsExpanded, setToolsExpanded] = useState(false);

  // Determine status icon and colors (kept inline as it returns JSX)
  const getStatusIcon = () => {
    switch (server.status) {
      case 'online':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'offline':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'disabled':
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
      case 'checking':
        return <Clock className="h-5 w-5 text-warning animate-spin" />;
      default:
        return <Server className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Card
      className={cn('transition-all duration-200', getCardBorderClass(server.status, server.enabled))}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            {getStatusIcon()}
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">{server.displayName}</CardTitle>
            </div>
          </div>
          <Badge variant={getStatusBadgeVariant(server.status)}>{getServerStatusLabel(server.status)}</Badge>
        </div>
        <CardDescription>{truncateUrl(server.url)}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Server Description */}
        {server.description && (
          <p className="text-sm text-muted-foreground">{server.description}</p>
        )}

        {/* Metrics Row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Response Time */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {formatResponseTime(server.responseTime)}
            </span>
          </div>

          {/* Auth Status */}
          {server.authRequired && (
            <Badge
              variant={
                server.authStatus === 'valid'
                  ? 'success'
                  : server.authStatus === 'missing'
                    ? 'destructive'
                    : 'warning'
              }
              className="flex items-center gap-1.5"
            >
              <Key className="h-3 w-3" />
              {server.authStatus === 'valid' && 'Auth Valid'}
              {server.authStatus === 'invalid' && 'Auth Invalid'}
              {server.authStatus === 'missing' && 'Auth Missing'}
              {server.authStatus === 'not-required' && 'No Auth'}
            </Badge>
          )}
        </div>

        {/* Tools List */}
        {server.tools && server.tools.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setToolsExpanded(!toolsExpanded)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {toolsExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Tools ({server.toolCount || server.tools.length})
            </button>

            {toolsExpanded && (
              <div className="grid grid-cols-2 gap-2 pl-6">
                {server.tools.map((tool) => (
                  <div
                    key={tool}
                    className="text-xs bg-secondary/50 rounded px-2 py-1 text-muted-foreground truncate"
                  >
                    {tool}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {server.lastError && server.status === 'offline' && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
            <p className="text-sm text-destructive">{server.lastError}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
