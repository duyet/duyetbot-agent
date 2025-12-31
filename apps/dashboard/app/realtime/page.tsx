'use client';

import { Activity, MessageSquare, Play, RefreshCw, Wifi, WifiOff, Zap } from 'lucide-react';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtime } from '@/lib/hooks/use-realtime';

export default function RealtimePage() {
  const { connected, messages, steps, events, error, connect, disconnect, clearEvents } =
    useRealtime({
      types: ['message', 'step'],
      maxEvents: 50,
      autoConnect: true,
    });

  // Calculate metrics
  const messagesPerMinute = messages.filter((m) => m.createdAt > Date.now() - 60000).length;

  const activeAgents = new Set(steps.filter((s) => s.status === 'running').map((s) => s.agentName))
    .size;

  const avgLatency =
    steps.length > 0
      ? Math.round(steps.reduce((sum, s) => sum + (s.durationMs || 0), 0) / steps.length)
      : 0;

  // Format relative time
  const formatTime = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) {
      return `${diff}s ago`;
    }
    if (diff < 3600) {
      return `${Math.floor(diff / 60)}m ago`;
    }
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <Shell
      title="Real-time Monitor"
      description="Live monitoring of system activities and agent status"
    >
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Real-time' }]} />

        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {connected ? (
              <div className="flex items-center gap-2 text-success">
                <Wifi className="h-5 w-5" />
                <span className="text-sm font-medium">Connected</span>
                <span className="status-dot status-online animate-pulse" />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <WifiOff className="h-5 w-5" />
                <span className="text-sm font-medium">Disconnected</span>
              </div>
            )}
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={clearEvents}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Clear
            </Button>
            {connected ? (
              <Button variant="destructive" size="sm" onClick={disconnect}>
                Disconnect
              </Button>
            ) : (
              <Button variant="default" size="sm" onClick={connect}>
                <Play className="mr-2 h-4 w-4" />
                Connect
              </Button>
            )}
          </div>
        </div>

        {/* Live Metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Messages/min
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{messagesPerMinute}</div>
              <div className="h-2 w-full rounded-full bg-secondary mt-3">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(messagesPerMinute * 5, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {messages.length} total messages received
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-success" />
                Active Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{activeAgents}</div>
              <div className="h-2 w-full rounded-full bg-secondary mt-3">
                <div
                  className="h-full rounded-full bg-success transition-all duration-300"
                  style={{ width: `${Math.min(activeAgents * 20, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {steps.length} agent steps tracked
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-warning" />
                Avg Latency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{avgLatency}ms</div>
              <div className="h-2 w-full rounded-full bg-secondary mt-3">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(avgLatency / 10, 100)}%`,
                    backgroundColor:
                      avgLatency < 500
                        ? 'hsl(var(--success))'
                        : avgLatency < 1000
                          ? 'hsl(var(--warning))'
                          : 'hsl(var(--destructive))',
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {avgLatency < 500 ? 'Excellent' : avgLatency < 1000 ? 'Good' : 'High latency'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Live Messages
            </CardTitle>
            <CardDescription>Real-time messages from all platforms</CardDescription>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Waiting for messages...</p>
                <p className="text-xs mt-1">Messages will appear here in real-time</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors animate-fadeIn"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {msg.platform}
                        </Badge>
                        <Badge
                          variant={msg.role === 'user' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {msg.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm truncate">{msg.content}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{msg.inputTokens + msg.outputTokens} tokens</span>
                        <span>User: {msg.userId}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agent Steps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Agent Activity
            </CardTitle>
            <CardDescription>Real-time agent execution steps</CardDescription>
          </CardHeader>
          <CardContent>
            {steps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Waiting for agent activity...</p>
                <p className="text-xs mt-1">Agent steps will appear here in real-time</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors animate-fadeIn"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`status-dot ${
                          step.status === 'running'
                            ? 'status-warning animate-pulse'
                            : step.status === 'success'
                              ? 'status-online'
                              : step.status === 'error'
                                ? 'status-error'
                                : 'status-offline'
                        }`}
                      />
                      <div>
                        <p className="font-medium text-sm">{step.agentName}</p>
                        <p className="text-xs text-muted-foreground">
                          {step.agentType} • {formatTime(step.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          step.status === 'success'
                            ? 'success'
                            : step.status === 'error'
                              ? 'destructive'
                              : step.status === 'running'
                                ? 'warning'
                                : 'secondary'
                        }
                      >
                        {step.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {step.durationMs}ms • {step.inputTokens + step.outputTokens} tokens
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Raw Events (Debug) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Event Stream (Debug)</CardTitle>
            <CardDescription>Raw events from SSE stream</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[200px] overflow-y-auto font-mono text-xs bg-secondary/50 rounded-lg p-3">
              {events.length === 0 ? (
                <p className="text-muted-foreground">No events yet...</p>
              ) : (
                events.slice(0, 20).map((event, i) => (
                  <div
                    key={`${event.type}-${event.timestamp}-${i}`}
                    className="py-1 border-b border-border/50 last:border-0"
                  >
                    <span className="text-primary">[{event.type}]</span>{' '}
                    <span className="text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    {event.id && <span className="text-success"> #{event.id.slice(0, 8)}</span>}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
