'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

/**
 * DashboardSkeleton - Loading state for the main dashboard page
 * Displays placeholder elements that match the dashboard layout
 */
export function DashboardSkeleton() {
	return (
		<div className="space-y-8 pb-10">
			{/* Hero Section Skeleton */}
			<div className="bg-black text-white pt-10 pb-16 -mt-6 -mx-6 px-10 mb-[-60px]">
				<Skeleton className="h-8 w-48 mb-2 bg-white/20" />
				<Skeleton className="h-4 w-64 bg-white/10" />
			</div>

			<div className="px-4 md:px-6 space-y-6">
				{/* Main Snapshot Card Skeleton */}
				<Card className="bg-card border-border overflow-hidden">
					<div className="p-6 border-b border-border flex justify-between items-center">
						<Skeleton className="h-5 w-56" />
						<div className="flex items-center gap-2">
							<Skeleton className="h-4 w-4 rounded-full" />
							<Skeleton className="h-3 w-24" />
						</div>
					</div>

					<div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
						{/* Left: Key Metrics Skeleton */}
						<div className="p-8 flex flex-col gap-8">
							<div className="flex gap-8 items-start">
								{/* Primary Metric Skeleton */}
								<div className="bg-background rounded-lg border border-border p-4 w-48 shrink-0 space-y-2">
									<Skeleton className="h-3 w-20" />
									<Skeleton className="h-8 w-24" />
									<div className="flex items-center gap-1">
										<Skeleton className="h-3 w-3" />
										<Skeleton className="h-3 w-12" />
									</div>
								</div>

								{/* Secondary Metrics Skeleton */}
								<div className="flex gap-8">
									<div className="flex flex-col gap-2">
										<Skeleton className="h-10 w-10 rounded-full" />
										<Skeleton className="h-4 w-16" />
										<Skeleton className="h-3 w-20" />
									</div>
									<div className="flex flex-col gap-2">
										<Skeleton className="h-10 w-10 rounded-full" />
										<Skeleton className="h-4 w-16" />
										<Skeleton className="h-3 w-20" />
									</div>
								</div>
							</div>

							{/* Separator Skeleton */}
							<div className="h-px bg-border" />

							{/* Stats Rows Skeleton */}
							<div className="space-y-3">
								<div className="flex justify-between">
									<Skeleton className="h-4 w-40" />
									<Skeleton className="h-4 w-16" />
								</div>
								<div className="flex justify-between">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-4 w-20" />
								</div>
							</div>
						</div>

						{/* Right: Chart Visual Skeleton */}
						<div className="p-8 flex flex-col justify-end">
							<div className="h-32 flex items-end justify-center gap-2 mb-4">
								{Array.from({ length: 12 }).map((_, i) => (
									<Skeleton
										key={i}
										className="w-4 rounded-t-sm"
										style={{ height: `${30 + Math.random() * 60}%` }}
									/>
								))}
							</div>
							<div className="h-px bg-border mb-4" />
							<div className="space-y-2">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-3 w-40" />
							</div>
						</div>
					</div>
				</Card>

				{/* Cost Distribution Card Skeleton */}
				<Card className="bg-card border-border p-6">
					<div className="flex justify-between items-center mb-6">
						<Skeleton className="h-5 w-40" />
						<Skeleton className="h-8 w-24" />
					</div>
					<div className="space-y-3">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="flex items-center gap-4">
								<Skeleton className="h-4 w-24 shrink-0" />
								<div className="flex-1 h-8 bg-muted rounded-md overflow-hidden">
									<Skeleton className="h-full w-full" />
								</div>
								<Skeleton className="h-4 w-16 shrink-0" />
							</div>
						))}
					</div>
				</Card>

				{/* Quick Links Grid Skeleton */}
				<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
					{Array.from({ length: 6 }).map((_, i) => (
						<Card key={i} className="bg-card border-border p-6">
							<div className="flex items-start gap-4">
								<Skeleton className="h-10 w-10 rounded-lg" />
								<div className="flex-1 space-y-2">
									<Skeleton className="h-5 w-32" />
									<Skeleton className="h-4 w-full" />
								</div>
							</div>
						</Card>
					))}
				</div>
			</div>
		</div>
	);
}
