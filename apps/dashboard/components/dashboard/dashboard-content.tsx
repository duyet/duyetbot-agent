'use client';

import {
  Activity,
  Brain,
  Calendar,
  Clock,
  Database,
  DollarSign,
  FileText,
  Server,
  Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatNumber } from '@/lib/chart-theme';
import { useStats } from '@/lib/hooks/use-dashboard-data';
import { CostDistributionCard } from './CostDistributionCard';
import { DashboardSkeleton } from './dashboard-skeleton';
import { QuickLinkCard } from './quick-link-card';

export function DashboardContent() {
  const { data: stats, isLoading } = useStats();
  const currentDate = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Show skeleton while loading
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Fallback defaults
  const totalMessages = stats?.totalMessages ?? 0;
  const totalSessions = stats?.totalSessions ?? 0;
  const totalTokens = stats?.totalTokens ?? 0;

  return (
    <div className="space-y-8 pb-10">
      {/* Hero Section */}
      <div className="bg-black text-white pt-10 pb-16 -mt-6 -mx-6 px-10 mb-[-60px]">
        <h1 className="text-3xl font-semibold mb-2">System Overview</h1>
        <p className="text-gray-400">Monitoring and management for Duyetbot</p>
      </div>

      <div className="px-4 md:px-6 space-y-6">
        {/* Main Snapshot Card */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="p-6 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-base font-semibold">Activity Snapshot for {currentDate}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="text-xs text-muted-foreground font-medium">System Online</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Left: Key Metrics */}
            <div className="p-8 flex flex-col gap-8">
              <div className="flex gap-8 items-start">
                {/* Primary Metric */}
                <div className="bg-background rounded-lg border border-border p-4 w-48 shrink-0">
                  <p className="text-xs font-semibold mb-1 text-muted-foreground">Total Messages</p>
                  <p className="text-3xl font-bold mb-1">{formatNumber(totalMessages)}</p>
                  <div className="flex items-center gap-1 text-[10px] text-green-500 font-medium">
                    <Activity className="h-3 w-3" />
                    <span>Active</span>
                  </div>
                </div>

                {/* Secondary Metrics */}
                <div className="flex gap-8">
                  <div className="flex flex-col gap-1">
                    <div className="h-10 w-10 rounded-full bg-secondary/50 flex items-center justify-center mb-1">
                      <Clock className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold">Sessions</p>
                    <p className="text-xs text-muted-foreground">{totalSessions} active</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="h-10 w-10 rounded-full bg-secondary/50 flex items-center justify-center mb-1">
                      <Database className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold">Memory</p>
                    <p className="text-xs text-muted-foreground">Healthy</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-muted-foreground">Tokens Processed</span>
                  <span>{formatNumber(totalTokens)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-muted-foreground">Last Activity</span>
                  <span>Just now</span>
                </div>
              </div>
            </div>

            {/* Right: Activity Chart Visual */}
            <div className="p-8 flex flex-col justify-end">
              <div className="h-32 flex items-end justify-center gap-2 mb-4 opacity-80">
                {/* Bar chart visual */}
                <div className="w-4 bg-foreground/80 rounded-t-sm" style={{ height: '35%' }} />
                <div className="w-4 bg-foreground/80 rounded-t-sm" style={{ height: '60%' }} />
                <div className="w-4 bg-foreground/80 rounded-t-sm" style={{ height: '45%' }} />
                <div className="w-4 bg-foreground/80 rounded-t-sm" style={{ height: '80%' }} />
                <div className="w-4 bg-foreground/80 rounded-t-sm" style={{ height: '50%' }} />
                <div className="w-4 bg-foreground/80 rounded-t-sm" style={{ height: '65%' }} />
                <div className="w-4 bg-foreground/80 rounded-t-sm" style={{ height: '40%' }} />
                <div className="w-4 bg-foreground/80 rounded-t-sm" style={{ height: '70%' }} />
                <div className="w-4 bg-foreground/80 rounded-t-sm" style={{ height: '55%' }} />
                <div className="w-4 bg-foreground/80 rounded-t-sm" style={{ height: '90%' }} />
                <div className="w-4 bg-foreground/80 rounded-t-sm" style={{ height: '45%' }} />
                <div className="w-4 bg-foreground/80 rounded-t-sm" style={{ height: '60%' }} />
              </div>
              <Separator className="mb-4" />
              <div>
                <h3 className="font-semibold text-sm">Token Usage Trend</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Estimated cost <span className="text-foreground font-medium">Coming soon</span>
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Cost Distribution Card */}
        <CostDistributionCard />

        {/* Quick Links Grid - Focused on Management & Monitoring */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickLinkCard
            title="Bot Activity"
            description="Monitor detailed logs and messages"
            icon={Activity}
            href="/messages"
          />
          <QuickLinkCard
            title="Cost Analysis"
            description="View detailed cost breakdown"
            icon={DollarSign}
            href="/tokens/cost"
          />
          <QuickLinkCard
            title="Analytics"
            description="Token usage and cost analysis"
            icon={Zap}
            href="/tokens"
          />
          <QuickLinkCard
            title="System Prompts"
            description="Manage agent personas and rules"
            icon={FileText}
            href="/prompts"
          />
          <QuickLinkCard
            title="Tasks & Schedule"
            description="View cron jobs and scheduled tasks"
            icon={Calendar}
            href="/tasks"
          />
          <QuickLinkCard
            title="Memory Store"
            description="Explore vector database knowledge"
            icon={Brain}
            href="/memory"
          />
          <QuickLinkCard
            title="MCP Servers"
            description="Manage tool integrations"
            icon={Server}
            href="/mcp"
          />
        </div>
      </div>
    </div>
  );
}
