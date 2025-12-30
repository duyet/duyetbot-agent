"use client";

import type React from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Dashboard Skeleton - Loading skeleton for dashboard page
 * Shows metrics cards, charts, and activity feed placeholders
 */
export function DashboardSkeleton() {
	return (
		<div className="flex h-dvh min-w-0 flex-col bg-background">
			{/* Header skeleton */}
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 px-4 py-3 backdrop-blur md:px-6">
				<Skeleton className="h-8 w-8 rounded-md" />
				<Skeleton className="h-7 w-32" />
				<div className="ml-auto flex items-center gap-2">
					<Skeleton className="h-8 w-24 rounded-md" />
					<Skeleton className="h-8 w-8 rounded-full" />
				</div>
			</header>

			{/* Main content */}
			<main className="flex-1 overflow-auto p-4 md:p-6">
				<div className="mx-auto max-w-7xl space-y-6">
					{/* Metrics cards grid */}
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								key={`metric-${i}`}
								className="animate-stagger-fade-in"
								style={
									{
										"--stagger-index": i,
										animationDelay: `${i * 75}ms`,
									} as React.CSSProperties
								}
							>
								<MetricCardSkeleton />
							</div>
						))}
					</div>

					{/* Charts section */}
					<div className="grid gap-6 lg:grid-cols-2">
						<div
							className="animate-stagger-fade-in"
							style={{ animationDelay: "300ms" } as React.CSSProperties}
						>
							<ChartSkeleton title="Usage Over Time" />
						</div>
						<div
							className="animate-stagger-fade-in"
							style={{ animationDelay: "350ms" } as React.CSSProperties}
						>
							<ChartSkeleton title="Token Distribution" />
						</div>
					</div>

					{/* Activity feed */}
					<div
						className="animate-stagger-fade-in"
						style={{ animationDelay: "400ms" } as React.CSSProperties}
					>
						<ActivityFeedSkeleton />
					</div>
				</div>
			</main>
		</div>
	);
}

/**
 * Metric Card Skeleton - Individual metric card placeholder
 */
function MetricCardSkeleton() {
	return (
		<div className="rounded-lg border bg-card p-6">
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-8 w-20" />
					<Skeleton className="h-3 w-16" />
				</div>
				<Skeleton className="h-10 w-10 rounded-full" />
			</div>
		</div>
	);
}

/**
 * Chart Skeleton - Placeholder for chart components
 */
function ChartSkeleton({ title }: { title?: string }) {
	return (
		<div className="rounded-lg border bg-card p-6">
			{title && <Skeleton className="mb-4 h-5 w-32" />}
			<div className="space-y-3">
				{/* Chart bars */}
				{Array.from({ length: 6 }).map((_, i) => (
					<div key={`bar-${i}`} className="flex items-center gap-2">
						<Skeleton className="h-4 w-12 shrink-0" />
						<Skeleton
							className="h-8 w-full"
							style={{ width: `${40 + Math.random() * 60}%` }}
						/>
					</div>
				))}
			</div>
		</div>
	);
}

/**
 * Activity Feed Skeleton - Recent activity list placeholder
 */
function ActivityFeedSkeleton() {
	return (
		<div className="rounded-lg border bg-card p-6">
			<Skeleton className="mb-4 h-5 w-32" />
			<div className="space-y-4">
				{Array.from({ length: 5 }).map((_, i) => (
					<div
						key={`activity-${i}`}
						className="flex items-start gap-3"
						style={
							{
								animationDelay: `${i * 50}ms`,
							} as React.CSSProperties
						}
					>
						<Skeleton className="h-8 w-8 shrink-0 rounded-full" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-3 w-1/2" />
						</div>
						<Skeleton className="h-4 w-16 shrink-0" />
					</div>
				))}
			</div>
		</div>
	);
}

/**
 * Sessions List Skeleton - For sessions page
 */
export function SessionsListSkeleton() {
	return (
		<div className="flex h-dvh min-w-0 flex-col bg-background">
			{/* Header */}
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 px-4 py-3 backdrop-blur md:px-6">
				<Skeleton className="h-8 w-8 rounded-md" />
				<Skeleton className="h-7 w-32" />
				<div className="ml-auto flex items-center gap-2">
					<Skeleton className="h-8 w-24 rounded-md" />
					<Skeleton className="h-8 w-8 rounded-full" />
				</div>
			</header>

			{/* Main content */}
			<main className="flex-1 overflow-auto p-4 md:p-6">
				<div className="mx-auto max-w-7xl space-y-4">
					{/* Search and filters */}
					<div className="flex flex-wrap items-center gap-3">
						<Skeleton className="h-10 w-64 rounded-md" />
						<Skeleton className="h-10 w-32 rounded-md" />
						<Skeleton className="h-10 w-32 rounded-md" />
						<div className="ml-auto">
							<Skeleton className="h-10 w-24 rounded-md" />
						</div>
					</div>

					{/* Session cards */}
					{Array.from({ length: 8 }).map((_, i) => (
						<div
							key={`session-${i}`}
							className="animate-stagger-fade-in"
							style={
								{
									animationDelay: `${i * 50}ms`,
								} as React.CSSProperties
							}
						>
							<SessionCardSkeleton />
						</div>
					))}
				</div>
			</main>
		</div>
	);
}

/**
 * Session Card Skeleton - Individual session card placeholder
 */
function SessionCardSkeleton() {
	return (
		<div className="rounded-lg border bg-card p-4">
			<div className="flex items-start gap-3">
				<Skeleton className="h-10 w-10 shrink-0 rounded-full" />
				<div className="flex-1 space-y-2">
					<Skeleton className="h-5 w-48" />
					<Skeleton className="h-4 w-full max-w-md" />
					<div className="flex items-center gap-4">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-3 w-20" />
					</div>
				</div>
				<Skeleton className="h-8 w-20 rounded-md" />
			</div>
		</div>
	);
}

/**
 * Settings Page Skeleton
 */
export function SettingsSkeleton() {
	return (
		<div className="flex h-dvh min-w-0 flex-col bg-background">
			{/* Header */}
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 px-4 py-3 backdrop-blur md:px-6">
				<Skeleton className="h-8 w-8 rounded-md" />
				<Skeleton className="h-7 w-32" />
			</header>

			{/* Main content */}
			<main className="flex-1 overflow-auto">
				<div className="mx-auto max-w-4xl p-4 md:p-6">
					<div className="space-y-6">
						{/* Settings sections */}
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								key={`section-${i}`}
								className="animate-stagger-fade-in rounded-lg border bg-card p-6"
								style={
									{
										animationDelay: `${i * 75}ms`,
									} as React.CSSProperties
								}
							>
								<Skeleton className="mb-4 h-6 w-40" />
								<div className="space-y-4">
									{Array.from({ length: 3 }).map((_, j) => (
										<SettingsItemSkeleton key={`item-${j}`} />
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			</main>
		</div>
	);
}

/**
 * Settings Item Skeleton - Individual settings item placeholder
 */
function SettingsItemSkeleton() {
	return (
		<div className="flex items-center justify-between">
			<div className="space-y-1">
				<Skeleton className="h-4 w-40" />
				<Skeleton className="h-3 w-64" />
			</div>
			<Skeleton className="h-6 w-12 rounded-md" />
		</div>
	);
}

/**
 * Analytics Page Skeleton
 */
export function AnalyticsSkeleton() {
	return (
		<div className="flex h-dvh min-w-0 flex-col bg-background">
			{/* Header */}
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 px-4 py-3 backdrop-blur md:px-6">
				<Skeleton className="h-8 w-8 rounded-md" />
				<Skeleton className="h-7 w-32" />
				<div className="ml-auto flex items-center gap-2">
					<Skeleton className="h-8 w-24 rounded-md" />
					<Skeleton className="h-8 w-8 rounded-md" />
				</div>
			</header>

			{/* Main content */}
			<main className="flex-1 overflow-auto p-4 md:p-6">
				<div className="mx-auto max-w-7xl space-y-6">
					{/* Time period selector */}
					<div className="flex items-center justify-between">
						<Skeleton className="h-7 w-40" />
						<div className="flex gap-2">
							{Array.from({ length: 4 }).map((_, i) => (
								<Skeleton key={`period-${i}`} className="h-8 w-20 rounded-md" />
							))}
						</div>
					</div>

					{/* Summary metrics */}
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								key={`summary-${i}`}
								className="animate-stagger-fade-in"
								style={
									{
										animationDelay: `${i * 50}ms`,
									} as React.CSSProperties
								}
							>
								<MetricCardSkeleton />
							</div>
						))}
					</div>

					{/* Main chart */}
					<div
						className="animate-stagger-fade-in"
						style={{ animationDelay: "250ms" } as React.CSSProperties}
					>
						<LargeChartSkeleton />
					</div>

					{/* Secondary charts */}
					<div className="grid gap-6 lg:grid-cols-2">
						<div
							className="animate-stagger-fade-in"
							style={{ animationDelay: "300ms" } as React.CSSProperties}
						>
							<ChartSkeleton title="Top Models" />
						</div>
						<div
							className="animate-stagger-fade-in"
							style={{ animationDelay: "350ms" } as React.CSSProperties}
						>
							<ChartSkeleton title="Tool Usage" />
						</div>
					</div>

					{/* Table */}
					<div
						className="animate-stagger-fade-in"
						style={{ animationDelay: "400ms" } as React.CSSProperties}
					>
						<TableSkeleton />
					</div>
				</div>
			</main>
		</div>
	);
}

/**
 * Large Chart Skeleton - Main analytics chart placeholder
 */
function LargeChartSkeleton() {
	return (
		<div className="rounded-lg border bg-card p-6">
			<Skeleton className="mb-6 h-6 w-48" />
			{/* Chart area */}
			<div className="flex h-64 items-end gap-2">
				{Array.from({ length: 12 }).map((_, i) => (
					<Skeleton
						key={`bar-${i}`}
						className="flex-1"
						style={
							{
								height: `${30 + Math.random() * 70}%`,
								animationDelay: `${i * 30}ms`,
							} as React.CSSProperties
						}
					/>
				))}
			</div>
			{/* X-axis labels */}
			<div className="mt-4 flex justify-between">
				{Array.from({ length: 6 }).map((_, i) => (
					<Skeleton key={`label-${i}`} className="h-3 w-12" />
				))}
			</div>
		</div>
	);
}

/**
 * Table Skeleton - Data table placeholder
 */
function TableSkeleton() {
	return (
		<div className="rounded-lg border bg-card p-6">
			<Skeleton className="mb-4 h-6 w-32" />
			{/* Table header */}
			<div className="mb-4 flex items-center gap-4 border-b pb-2">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={`th-${i}`} className="h-4 w-20" />
				))}
			</div>
			{/* Table rows */}
			<div className="space-y-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<div key={`row-${i}`} className="flex items-center gap-4">
						{Array.from({ length: 4 }).map((_, j) => (
							<Skeleton
								key={`cell-${j}`}
								className="h-4"
								style={{ width: `${15 + Math.random() * 25}%` }}
							/>
						))}
					</div>
				))}
			</div>
		</div>
	);
}
