'use client';

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Database,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDailyAggregates, useStats, useTokenSummary } from '@/lib/hooks/use-dashboard-data';

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

function StatsCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-12 w-12 rounded-xl" />
      </div>
    </div>
  );
}

interface TokenStatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  accentColor: string;
  trend?: { value: number; positive: boolean };
}

function TokenStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor,
  trend,
}: TokenStatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-glow-sm">
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10 blur-3xl transition-opacity duration-300 group-hover:opacity-25"
        style={{ background: accentColor }}
      />

      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">{value}</span>
            {trend && (
              <span
                className={`flex items-center text-xs font-medium ${
                  trend.positive ? 'text-success' : 'text-destructive'
                }`}
              >
                {trend.positive ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
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

function TokenBreakdownBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{formatNumber(value)}</span>
          <span className="text-xs text-muted-foreground">({percentage}%)</span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function TokensPage() {
  const { data: tokenSummary, isLoading: summaryLoading } = useTokenSummary();
  const { isLoading: statsLoading } = useStats();

  // Get last 7 days of data
  const dateRange = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }, []);

  const { data: dailyAggregates, isLoading: aggregatesLoading } = useDailyAggregates(
    dateRange.from,
    dateRange.to,
    'platform_daily'
  );

  const isLoading = summaryLoading || statsLoading;
  const hasData = tokenSummary && tokenSummary.totalTokens > 0;

  // Calculate daily totals from aggregates
  const dailyTotals = useMemo(() => {
    if (!dailyAggregates) {
      return [];
    }
    const byDay = new Map<string, { date: string; input: number; output: number; total: number }>();

    dailyAggregates.forEach((agg) => {
      const date = new Date(agg.periodStart).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const existing = byDay.get(date) || { date, input: 0, output: 0, total: 0 };
      existing.input += agg.inputTokens;
      existing.output += agg.outputTokens;
      existing.total += agg.totalTokens;
      byDay.set(date, existing);
    });

    return Array.from(byDay.values()).slice(-7);
  }, [dailyAggregates]);

  // Calculate platform breakdown from aggregates
  const platformBreakdown = useMemo(() => {
    if (!dailyAggregates) {
      return [];
    }
    const byPlatform = new Map<string, number>();

    dailyAggregates.forEach((agg) => {
      const platform = agg.aggregateKey;
      byPlatform.set(platform, (byPlatform.get(platform) || 0) + agg.totalTokens);
    });

    const colors: Record<string, string> = {
      telegram: 'hsl(204, 88%, 53%)',
      github: 'hsl(258, 100%, 67%)',
      cli: 'hsl(160, 100%, 37%)',
      api: 'hsl(39, 100%, 56%)',
    };

    return Array.from(byPlatform.entries())
      .map(([platform, tokens]) => ({
        platform,
        tokens,
        color: colors[platform] || 'hsl(var(--muted-foreground))',
      }))
      .sort((a, b) => b.tokens - a.tokens);
  }, [dailyAggregates]);

  return (
    <Shell title="Token Usage" description="Monitor your API token consumption and analytics">
      <div className="space-y-8 animate-fade-in">
        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Tokens' }]} />

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <TokenStatCard
                title="Total Tokens"
                value={hasData ? formatNumber(tokenSummary.totalTokens) : '—'}
                subtitle="All time usage"
                icon={Zap}
                accentColor="hsl(204, 88%, 53%)"
              />
              <TokenStatCard
                title="Input Tokens"
                value={hasData ? formatNumber(tokenSummary.totalInputTokens) : '—'}
                subtitle="Prompts & context"
                icon={ArrowUpRight}
                accentColor="hsl(160, 100%, 37%)"
              />
              <TokenStatCard
                title="Output Tokens"
                value={hasData ? formatNumber(tokenSummary.totalOutputTokens) : '—'}
                subtitle="Generated responses"
                icon={ArrowDownRight}
                accentColor="hsl(258, 100%, 67%)"
              />
              <TokenStatCard
                title="Messages"
                value={hasData ? formatNumber(tokenSummary.messageCount) : '—'}
                subtitle={hasData ? `${tokenSummary.sessionCount} sessions` : 'No data'}
                icon={Activity}
                accentColor="hsl(39, 100%, 56%)"
              />
            </>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Token Breakdown - Takes 2 columns */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Token Distribution
                </CardTitle>
                <CardDescription>Breakdown by token type</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                  ))}
                </div>
              ) : hasData ? (
                <>
                  <TokenBreakdownBar
                    label="Input Tokens"
                    value={tokenSummary.totalInputTokens}
                    total={tokenSummary.totalTokens}
                    color="hsl(160, 100%, 37%)"
                  />
                  <TokenBreakdownBar
                    label="Output Tokens"
                    value={tokenSummary.totalOutputTokens}
                    total={tokenSummary.totalTokens}
                    color="hsl(258, 100%, 67%)"
                  />

                  {/* Efficiency Metrics */}
                  <div className="mt-8 rounded-xl border border-border bg-secondary/30 p-4">
                    <h4 className="mb-3 text-sm font-semibold">Efficiency Metrics</h4>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Avg Input/Message</p>
                        <p className="text-lg font-bold">
                          {tokenSummary.messageCount > 0
                            ? Math.round(tokenSummary.totalInputTokens / tokenSummary.messageCount)
                            : 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg Output/Message</p>
                        <p className="text-lg font-bold">
                          {tokenSummary.messageCount > 0
                            ? Math.round(tokenSummary.totalOutputTokens / tokenSummary.messageCount)
                            : 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Input/Output Ratio</p>
                        <p className="text-lg font-bold">
                          {tokenSummary.totalOutputTokens > 0
                            ? (
                                tokenSummary.totalInputTokens / tokenSummary.totalOutputTokens
                              ).toFixed(2)
                            : 0}
                          x
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                    <Zap className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No token data available</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Start using the agents to see token usage here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Platform Breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4 text-primary" />
                  By Platform
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {aggregatesLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-lg" />
                    ))}
                  </div>
                ) : platformBreakdown.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No platform data available
                  </p>
                ) : (
                  platformBreakdown.map((p) => (
                    <div
                      key={p.platform}
                      className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="text-sm font-medium capitalize">{p.platform}</span>
                      </div>
                      <span className="text-sm font-semibold">{formatNumber(p.tokens)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Daily Usage (Last 7 Days) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-primary" />
                  Last 7 Days
                </CardTitle>
              </CardHeader>
              <CardContent>
                {aggregatesLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : dailyTotals.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No daily data available
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dailyTotals.map((day, index) => {
                      const maxTotal = Math.max(...dailyTotals.map((d) => d.total));
                      const width = maxTotal > 0 ? (day.total / maxTotal) * 100 : 0;

                      return (
                        <div
                          key={day.date}
                          className="group flex items-center gap-3 rounded-lg py-1.5 transition-colors hover:bg-secondary/30"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <span className="w-12 text-xs text-muted-foreground">{day.date}</span>
                          <div className="flex-1">
                            <div className="h-4 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-chart-3 transition-all duration-500"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </div>
                          <span className="w-16 text-right text-xs font-medium">
                            {formatNumber(day.total)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Action */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Cost Analysis</p>
                    <p className="text-xs text-muted-foreground">View detailed cost breakdown</p>
                  </div>
                </div>
                <Link href="/tokens/cost">
                  <Button className="w-full gap-2">
                    <TrendingUp className="h-4 w-4" />
                    View Cost Analytics
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Summary Stats */}
        {hasData && (
          <Card className="border-dashed">
            <CardContent className="py-6">
              <div className="flex flex-wrap items-center justify-center gap-6 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Total Sessions</p>
                  <p className="text-2xl font-bold">{formatNumber(tokenSummary.sessionCount)}</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{formatNumber(tokenSummary.userCount)}</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Messages</p>
                  <p className="text-2xl font-bold">{formatNumber(tokenSummary.messageCount)}</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <p className="text-xs text-muted-foreground">Tokens/Session</p>
                  <p className="text-2xl font-bold">
                    {tokenSummary.sessionCount > 0
                      ? formatNumber(
                          Math.round(tokenSummary.totalTokens / tokenSummary.sessionCount)
                        )
                      : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Shell>
  );
}
