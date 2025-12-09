'use client';

import {
  Activity,
  ArrowRight,
  Bot,
  Clock,
  MessageSquare,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentMessages, useStats } from '@/lib/hooks/use-dashboard-data';

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

function StatsCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-12 w-12 rounded-xl" />
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex items-start gap-4 rounded-xl border border-border/50 bg-secondary/30 p-4"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  accentColor: string;
  glowColor: string;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accentColor,
  glowColor,
}: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-glow-sm">
      {/* Background gradient glow */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-3xl transition-opacity duration-300 group-hover:opacity-40"
        style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)` }}
      />

      <div className="relative flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight">{value}</span>
            {trend && (
              <span
                className={`flex items-center text-sm font-medium ${
                  trend.positive ? 'text-success' : 'text-destructive'
                }`}
              >
                <TrendingUp className={`mr-0.5 h-3 w-3 ${!trend.positive && 'rotate-180'}`} />
                {trend.value}%
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: `${accentColor}20` }}
        >
          <Icon className="h-6 w-6" style={{ color: accentColor }} />
        </div>
      </div>
    </div>
  );
}

export function DashboardContent() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: messages, isLoading: messagesLoading } = useRecentMessages(5);

  const hasData = stats && stats.totalMessages > 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Messages"
              value={hasData ? formatNumber(stats.totalMessages) : '—'}
              subtitle={hasData ? 'All time interactions' : 'No data yet'}
              icon={MessageSquare}
              accentColor="hsl(204, 88%, 53%)"
              glowColor="hsl(204, 88%, 53%)"
            />
            <StatCard
              title="Active Sessions"
              value={hasData ? formatNumber(stats.totalSessions) : '—'}
              subtitle={hasData ? `${stats.totalUsers} unique users` : 'No sessions'}
              icon={Users}
              accentColor="hsl(160, 100%, 37%)"
              glowColor="hsl(160, 100%, 37%)"
            />
            <StatCard
              title="Token Usage"
              value={hasData ? formatNumber(stats.totalTokens) : '—'}
              subtitle={
                hasData
                  ? `${formatNumber(stats.totalInputTokens)} in / ${formatNumber(stats.totalOutputTokens)} out`
                  : 'No usage'
              }
              icon={Zap}
              accentColor="hsl(258, 100%, 67%)"
              glowColor="hsl(258, 100%, 67%)"
            />
            <StatCard
              title="Avg Response"
              value={
                hasData && stats.totalMessages > 0
                  ? `${Math.round(stats.totalOutputTokens / Math.max(stats.totalMessages / 2, 1))}`
                  : '—'
              }
              subtitle={hasData ? 'Tokens per response' : 'No data'}
              icon={Activity}
              accentColor="hsl(39, 100%, 56%)"
              glowColor="hsl(39, 100%, 56%)"
            />
          </>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity - Takes 2 columns */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest interactions across all platforms</CardDescription>
            </div>
            <Link href="/messages">
              <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary">
                View All
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {messagesLoading ? (
              <ActivitySkeleton />
            ) : !messages || messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">No messages yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Start a conversation to see activity here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, index) => (
                  <div
                    key={msg.messageId || msg.id}
                    className="group flex items-start gap-4 rounded-xl border border-transparent bg-secondary/30 p-4 transition-all duration-200 hover:border-border hover:bg-secondary/50"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        msg.role === 'user'
                          ? 'bg-primary/10 text-primary'
                          : msg.role === 'assistant'
                            ? 'bg-success/10 text-success'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        <Bot className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            msg.role === 'user'
                              ? 'border-primary/30 text-primary'
                              : 'border-success/30 text-success'
                          }`}
                        >
                          {msg.role}
                        </Badge>
                        <span className="text-xs capitalize text-muted-foreground">
                          {msg.platform}
                        </span>
                        {msg.username && (
                          <span className="text-xs text-muted-foreground">@{msg.username}</span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm">{msg.content}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatTimestamp(msg.createdAt)}</span>
                        {(msg.inputTokens > 0 || msg.outputTokens > 0) && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {msg.inputTokens + msg.outputTokens} tokens
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={msg.visibility === 'public' ? 'success' : 'secondary'}
                      className="shrink-0 text-xs"
                    >
                      {msg.visibility}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Platform Distribution */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Platform Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {statsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i}>
                      <div className="mb-2 flex items-center justify-between">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              ) : !hasData || !stats.platformBreakdown || stats.platformBreakdown.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No platform data available
                </p>
              ) : (
                stats.platformBreakdown.map((p) => {
                  const percentage = Math.round((p.count / stats.totalMessages) * 100);
                  const colors: Record<string, string> = {
                    telegram: 'hsl(204, 88%, 53%)',
                    github: 'hsl(258, 100%, 67%)',
                    cli: 'hsl(160, 100%, 37%)',
                    api: 'hsl(39, 100%, 56%)',
                  };
                  const color = colors[p.platform] || 'hsl(var(--primary))';
                  return (
                    <div key={p.platform}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium capitalize">{p.platform}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(p.count)} ({percentage}%)
                        </p>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Agents Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Agents Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: 'Telegram Bot', status: 'online', icon: MessageSquare },
                  { name: 'GitHub Bot', status: 'online', icon: Activity },
                  { name: 'Router Agent', status: 'online', icon: Bot },
                ].map((agent) => (
                  <div
                    key={agent.name}
                    className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2.5 transition-colors hover:bg-secondary/50"
                  >
                    <div className="flex items-center gap-3">
                      <agent.icon className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">{agent.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`status-dot ${
                          agent.status === 'online' ? 'status-online' : 'status-offline'
                        }`}
                      />
                      <span
                        className={`text-xs font-medium ${
                          agent.status === 'online' ? 'text-success' : 'text-muted-foreground'
                        }`}
                      >
                        {agent.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Quick Actions</p>
                  <p className="text-xs text-muted-foreground">Jump to key features</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/messages">
                  <Button variant="secondary" size="sm" className="w-full justify-start gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Messages
                  </Button>
                </Link>
                <Link href="/sessions">
                  <Button variant="secondary" size="sm" className="w-full justify-start gap-2">
                    <Users className="h-4 w-4" />
                    Sessions
                  </Button>
                </Link>
                <Link href="/tokens">
                  <Button variant="secondary" size="sm" className="w-full justify-start gap-2">
                    <Activity className="h-4 w-4" />
                    Tokens
                  </Button>
                </Link>
                <Link href="/realtime">
                  <Button variant="secondary" size="sm" className="w-full justify-start gap-2">
                    <div className="relative">
                      <Zap className="h-4 w-4" />
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-success" />
                    </div>
                    Real-time
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
