'use client';

import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading skeleton for the dashboard home page
 * Matches the layout of DashboardContent for smooth loading transition
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8 pb-10">
      {/* Hero Section Skeleton */}
      <div className="bg-black text-white pt-10 pb-16 -mt-6 -mx-6 px-10 mb-[-60px]">
        <Skeleton className="h-8 w-48 bg-white/20" />
        <Skeleton className="h-4 w-64 mt-2 bg-white/10" />
      </div>

      <div className="px-4 md:px-6 space-y-6">
        {/* Main Snapshot Card Skeleton */}
        <Card className="bg-card border-border overflow-hidden">
          {/* Card Header Skeleton */}
          <div className="p-6 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <Skeleton className="h-5 w-56" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Left: Key Metrics Skeleton */}
            <div className="p-8 flex flex-col gap-8">
              <div className="flex gap-8 items-start">
                {/* Primary Metric Skeleton */}
                <Skeleton className="h-28 w-48 rounded-lg" />

                {/* Secondary Metrics Skeleton */}
                <div className="flex gap-8">
                  <div className="flex flex-col gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="flex flex-col gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </div>

            {/* Right: Activity Chart Visual Skeleton */}
            <div className="p-8 flex flex-col justify-end">
              <div className="h-32 flex items-end justify-center gap-2 mb-4">
                {Array.from({ length: 12 }, (_, i) => `chart-bar-${i}`).map((key) => (
                  <Skeleton
                    key={key}
                    className="w-4 rounded-t-sm"
                    style={{ height: `${30 + Math.random() * 60}%` }}
                  />
                ))}
              </div>
              <Separator className="mb-4" />
              <div>
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </div>
        </Card>

        {/* Cost Distribution Card Skeleton */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <div className="p-6">
            <Skeleton className="h-64 w-full" />
          </div>
        </Card>

        {/* Quick Links Grid Skeleton */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 7 }, (_, i) => `quick-link-${i}`).map((key) => (
            <Card key={key} className="p-6">
              <div className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
