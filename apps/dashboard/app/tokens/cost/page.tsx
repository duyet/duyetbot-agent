'use client';

import {
  ArrowLeft,
  Calculator,
  CircleDollarSign,
  Clock,
  Database,
  DollarSign,
  Info,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/chart-theme';
import { useDailyAggregates, useTokenSummary } from '@/lib/hooks/use-dashboard-data';

// Model pricing per 1M tokens (approximate pricing)
const MODEL_PRICING: Record<string, { input: number; output: number; name: string }> = {
  'claude-3-opus': { input: 15.0, output: 75.0, name: 'Claude 3 Opus' },
  'claude-3-sonnet': { input: 3.0, output: 15.0, name: 'Claude 3 Sonnet' },
  'claude-3-haiku': { input: 0.25, output: 1.25, name: 'Claude 3 Haiku' },
  'claude-3-5-sonnet': { input: 3.0, output: 15.0, name: 'Claude 3.5 Sonnet' },
  'claude-3-5-haiku': { input: 0.8, output: 4.0, name: 'Claude 3.5 Haiku' },
  'gpt-4': { input: 30.0, output: 60.0, name: 'GPT-4' },
  'gpt-4-turbo': { input: 10.0, output: 30.0, name: 'GPT-4 Turbo' },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5, name: 'GPT-3.5 Turbo' },
  default: { input: 3.0, output: 15.0, name: 'Default' },
};

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(2)}K`;
  }
  if (amount >= 1) {
    return `$${amount.toFixed(2)}`;
  }
  if (amount >= 0.01) {
    return `$${amount.toFixed(3)}`;
  }
  return `$${amount.toFixed(4)}`;
}

function StatsCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

interface CostCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  accentColor: string;
  highlight?: boolean;
}

function CostCard({ title, value, subtitle, icon: Icon, accentColor, highlight }: CostCardProps) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 hover:shadow-glow-sm ${
        highlight
          ? 'border-success/50 bg-success/5'
          : 'border-border bg-card hover:border-primary/50'
      }`}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10 blur-3xl transition-opacity duration-300 group-hover:opacity-25"
        style={{ background: accentColor }}
      />

      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
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

export default function CostPage() {
  const { data: tokenSummary, isLoading: summaryLoading } = useTokenSummary();

  // Get last 30 days of data
  const dateRange = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }, []);

  const { data: modelAggregates, isLoading: modelLoading } = useDailyAggregates(
    dateRange.from,
    dateRange.to,
    'model_daily'
  );

  const { data: platformAggregates, isLoading: platformLoading } = useDailyAggregates(
    dateRange.from,
    dateRange.to,
    'platform_daily'
  );

  const isLoading = summaryLoading || modelLoading || platformLoading;
  const hasData = tokenSummary && tokenSummary.totalTokens > 0;

  // Calculate estimated cost from token summary
  const estimatedCost = useMemo(() => {
    if (!tokenSummary) {
      return { input: 0, output: 0, total: 0 };
    }
    // Use default pricing (Claude 3.5 Sonnet-like pricing)
    const pricing = MODEL_PRICING.default;
    const inputCost = (tokenSummary.totalInputTokens / 1000000) * pricing.input;
    const outputCost = (tokenSummary.totalOutputTokens / 1000000) * pricing.output;
    return {
      input: inputCost,
      output: outputCost,
      total: inputCost + outputCost,
    };
  }, [tokenSummary]);

  // Calculate cost by model
  const costByModel = useMemo(() => {
    if (!modelAggregates) {
      return [];
    }
    const byModel = new Map<
      string,
      { model: string; input: number; output: number; total: number; cost: number }
    >();

    modelAggregates.forEach((agg) => {
      const modelKey = agg.aggregateKey || 'unknown';
      const existing = byModel.get(modelKey) || {
        model: modelKey,
        input: 0,
        output: 0,
        total: 0,
        cost: 0,
      };

      existing.input += agg.inputTokens;
      existing.output += agg.outputTokens;
      existing.total += agg.totalTokens;

      // Calculate cost using model-specific pricing
      const pricing = MODEL_PRICING[modelKey] || MODEL_PRICING.default;
      existing.cost +=
        (agg.inputTokens / 1000000) * pricing.input + (agg.outputTokens / 1000000) * pricing.output;

      byModel.set(modelKey, existing);
    });

    return Array.from(byModel.values()).sort((a, b) => b.cost - a.cost);
  }, [modelAggregates]);

  // Calculate cost by platform
  const costByPlatform = useMemo(() => {
    if (!platformAggregates) {
      return [];
    }
    const byPlatform = new Map<
      string,
      { platform: string; tokens: number; cost: number; messages: number }
    >();

    platformAggregates.forEach((agg) => {
      const platform = agg.aggregateKey;
      const existing = byPlatform.get(platform) || {
        platform,
        tokens: 0,
        cost: 0,
        messages: 0,
      };

      existing.tokens += agg.totalTokens;
      existing.messages += agg.messageCount;

      // Use default pricing for platform breakdown
      const pricing = MODEL_PRICING.default;
      existing.cost +=
        (agg.inputTokens / 1000000) * pricing.input + (agg.outputTokens / 1000000) * pricing.output;

      byPlatform.set(platform, existing);
    });

    const colors: Record<string, string> = {
      telegram: 'hsl(204, 88%, 53%)',
      github: 'hsl(258, 100%, 67%)',
      cli: 'hsl(160, 100%, 37%)',
      api: 'hsl(39, 100%, 56%)',
    };

    return Array.from(byPlatform.values())
      .map((p) => ({
        ...p,
        color: colors[p.platform] || 'hsl(var(--muted-foreground))',
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [platformAggregates]);

  // Calculate daily costs
  const dailyCosts = useMemo(() => {
    if (!platformAggregates) {
      return [];
    }
    const byDay = new Map<string, { date: string; cost: number; tokens: number }>();

    platformAggregates.forEach((agg) => {
      const date = new Date(agg.periodStart).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const existing = byDay.get(date) || { date, cost: 0, tokens: 0 };

      const pricing = MODEL_PRICING.default;
      existing.cost +=
        (agg.inputTokens / 1000000) * pricing.input + (agg.outputTokens / 1000000) * pricing.output;
      existing.tokens += agg.totalTokens;

      byDay.set(date, existing);
    });

    return Array.from(byDay.values()).slice(-14);
  }, [platformAggregates]);

  // Calculate average daily cost
  const avgDailyCost = useMemo(() => {
    if (dailyCosts.length === 0) {
      return 0;
    }
    return dailyCosts.reduce((sum, d) => sum + d.cost, 0) / dailyCosts.length;
  }, [dailyCosts]);

  return (
    <Shell title="Cost Analysis" description="Track and analyze your API spending">
      <div className="space-y-8 animate-fade-in">
        {/* Breadcrumbs */}
        <div className="flex items-center justify-between">
          <Breadcrumbs
            items={[
              { label: 'Dashboard', href: '/' },
              { label: 'Tokens', href: '/tokens' },
              { label: 'Cost' },
            ]}
          />
          <Link href="/tokens">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Back to Tokens
            </Button>
          </Link>
        </div>

        {/* Cost Overview */}
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
              <CostCard
                title="Estimated Total Cost"
                value={hasData ? formatCurrency(estimatedCost.total) : '—'}
                subtitle="All time (estimated)"
                icon={DollarSign}
                accentColor="hsl(160, 100%, 37%)"
                highlight
              />
              <CostCard
                title="Input Cost"
                value={hasData ? formatCurrency(estimatedCost.input) : '—'}
                subtitle={
                  hasData ? `${formatNumber(tokenSummary.totalInputTokens)} tokens` : 'No data'
                }
                icon={TrendingUp}
                accentColor="hsl(204, 88%, 53%)"
              />
              <CostCard
                title="Output Cost"
                value={hasData ? formatCurrency(estimatedCost.output) : '—'}
                subtitle={
                  hasData ? `${formatNumber(tokenSummary.totalOutputTokens)} tokens` : 'No data'
                }
                icon={TrendingDown}
                accentColor="hsl(258, 100%, 67%)"
              />
              <CostCard
                title="Avg Daily Cost"
                value={avgDailyCost > 0 ? formatCurrency(avgDailyCost) : '—'}
                subtitle="Last 14 days average"
                icon={Calculator}
                accentColor="hsl(39, 100%, 56%)"
              />
            </>
          )}
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-3 rounded-xl border border-info/30 bg-info/5 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" />
          <div className="text-sm">
            <p className="font-medium text-info">Cost estimates are approximate</p>
            <p className="mt-1 text-muted-foreground">
              Actual costs may vary based on your API provider, pricing tier, and any discounts or
              credits applied to your account. These estimates use publicly available pricing as of
              December 2024.
            </p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Cost by Model */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Cost by Model
                </CardTitle>
                <CardDescription>Breakdown of estimated costs per AI model</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {modelLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : costByModel.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                    <Sparkles className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No model data available</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cost breakdown by model will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {costByModel.map((model, index) => {
                    const totalCost = costByModel.reduce((sum, m) => sum + m.cost, 0);
                    const percentage = totalCost > 0 ? (model.cost / totalCost) * 100 : 0;
                    const pricing = MODEL_PRICING[model.model] || MODEL_PRICING.default;

                    return (
                      <div
                        key={model.model}
                        className="rounded-xl border border-border bg-secondary/20 p-4 transition-colors hover:bg-secondary/40"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{pricing.name}</p>
                              <Badge variant="outline" className="text-xs">
                                {percentage.toFixed(1)}%
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatNumber(model.input)} in / {formatNumber(model.output)} out
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-success">
                              {formatCurrency(model.cost)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatNumber(model.total)} tokens
                            </p>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-success to-primary transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Cost by Platform */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4 text-primary" />
                  Cost by Platform
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {platformLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))}
                  </div>
                ) : costByPlatform.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No platform data available
                  </p>
                ) : (
                  costByPlatform.map((p) => (
                    <div
                      key={p.platform}
                      className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <div>
                          <span className="text-sm font-medium capitalize">{p.platform}</span>
                          <p className="text-xs text-muted-foreground">
                            {formatNumber(p.messages)} messages
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-success">
                        {formatCurrency(p.cost)}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Daily Cost Trend */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" />
                  Daily Cost Trend
                </CardTitle>
                <CardDescription>Last 14 days</CardDescription>
              </CardHeader>
              <CardContent>
                {platformLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-6 w-full" />
                    ))}
                  </div>
                ) : dailyCosts.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No daily data available
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {dailyCosts.map((day, index) => {
                      const maxCost = Math.max(...dailyCosts.map((d) => d.cost));
                      const width = maxCost > 0 ? (day.cost / maxCost) * 100 : 0;

                      return (
                        <div
                          key={day.date}
                          className="group flex items-center gap-2 rounded py-1 transition-colors hover:bg-secondary/30"
                          style={{ animationDelay: `${index * 30}ms` }}
                        >
                          <span className="w-12 text-xs text-muted-foreground">{day.date}</span>
                          <div className="flex-1">
                            <div className="h-3 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-success/80 to-success transition-all duration-500"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </div>
                          <span className="w-14 text-right text-xs font-medium">
                            {formatCurrency(day.cost)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pricing Reference */}
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CircleDollarSign className="h-4 w-4 text-primary" />
                  Pricing Reference
                </CardTitle>
                <CardDescription>Per 1M tokens</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs">
                  {Object.entries(MODEL_PRICING)
                    .filter(([key]) => key !== 'default')
                    .slice(0, 5)
                    .map(([key, pricing]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-lg bg-secondary/20 px-2 py-1.5"
                      >
                        <span className="text-muted-foreground">{pricing.name}</span>
                        <div className="flex gap-2">
                          <span className="text-success">${pricing.input} in</span>
                          <span className="text-chart-3">${pricing.output} out</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Shell>
  );
}
