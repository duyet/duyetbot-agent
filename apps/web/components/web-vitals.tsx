"use client";

import { useEffect } from "react";
import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

/**
 * Web Vitals Performance Monitoring Component
 *
 * Tracks Core Web Vitals metrics:
 * - LCP (Largest Contentful Paint): Measures loading performance
 * - FID/INP (First Input Delay / Interaction to Next Paint): Measures interactivity
 * - CLS (Cumulative Layout Shift): Measures visual stability
 * - FCP (First Contentful Paint): Time until first content is painted
 * - TTFB (Time to First Byte): Server response time
 *
 * Thresholds (good/needs-improvement/poor):
 * - LCP: 2500ms / 4000ms
 * - INP: 200ms / 500ms
 * - CLS: 0.1 / 0.25
 * - FCP: 1800ms / 3000ms
 * - TTFB: 800ms / 1800ms
 */

type VitalsMetric = {
	name: string;
	value: number;
	rating: "good" | "needs-improvement" | "poor";
	delta: number;
	id: string;
	navigationType: string;
};

function reportMetric(metric: Metric) {
	// Log to console in development
	if (process.env.NODE_ENV === "development") {
		const rating = metric.rating;
		const color =
			rating === "good"
				? "\x1b[32m" // green
				: rating === "needs-improvement"
					? "\x1b[33m" // yellow
					: "\x1b[31m"; // red
		const reset = "\x1b[0m";

		console.log(
			`${color}[Web Vitals]${reset} ${metric.name}: ${metric.value.toFixed(2)}ms (${rating})`,
		);
	}

	// Send to analytics endpoint if available
	// This can be extended to send to your analytics service
	const body: VitalsMetric = {
		name: metric.name,
		value: metric.value,
		rating: metric.rating,
		delta: metric.delta,
		id: metric.id,
		navigationType:
			metric.navigationType || ("unknown" as VitalsMetric["navigationType"]),
	};

	// Store in sessionStorage for debugging
	try {
		const existing = sessionStorage.getItem("web-vitals") || "[]";
		const metrics = JSON.parse(existing) as VitalsMetric[];
		metrics.push(body);
		// Keep only last 20 metrics
		if (metrics.length > 20) {
			metrics.shift();
		}
		sessionStorage.setItem("web-vitals", JSON.stringify(metrics));
	} catch {
		// Ignore storage errors
	}

	// Send to beacon API for production analytics (if endpoint configured)
	if (typeof navigator !== "undefined" && navigator.sendBeacon) {
		const analyticsEndpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
		if (analyticsEndpoint) {
			navigator.sendBeacon(analyticsEndpoint, JSON.stringify(body));
		}
	}
}

/**
 * Hook to get web vitals metrics from sessionStorage
 */
export function useWebVitals(): VitalsMetric[] {
	if (typeof window === "undefined") return [];

	try {
		const stored = sessionStorage.getItem("web-vitals");
		return stored ? (JSON.parse(stored) as VitalsMetric[]) : [];
	} catch {
		return [];
	}
}

/**
 * Get the latest value for each metric type
 */
export function getLatestVitals(): Record<string, VitalsMetric | undefined> {
	const metrics = useWebVitals();
	const latest: Record<string, VitalsMetric | undefined> = {};

	for (const metric of metrics) {
		latest[metric.name] = metric;
	}

	return latest;
}

/**
 * WebVitals component - renders nothing but tracks performance metrics
 * Include this in your app layout to start tracking
 */
export function WebVitals() {
	useEffect(() => {
		// Register all web vitals callbacks
		onCLS(reportMetric);
		onFCP(reportMetric);
		onINP(reportMetric);
		onLCP(reportMetric);
		onTTFB(reportMetric);
	}, []);

	// This component renders nothing
	return null;
}

/**
 * Performance summary for debugging
 * Can be displayed in development mode
 */
export function PerformanceSummary() {
	const metrics = useWebVitals();

	if (metrics.length === 0) {
		return null;
	}

	// Get latest of each metric type
	const latest = new Map<string, VitalsMetric>();
	for (const metric of metrics) {
		latest.set(metric.name, metric);
	}

	return (
		<div className="fixed right-4 bottom-4 z-50 rounded-lg border bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
			<div className="mb-2 font-semibold">Performance Metrics</div>
			<div className="space-y-1">
				{Array.from(latest.values()).map((metric) => (
					<div
						className="flex items-center justify-between gap-4"
						key={metric.name}
					>
						<span className="font-mono">{metric.name}</span>
						<span
							className={
								metric.rating === "good"
									? "text-green-500"
									: metric.rating === "needs-improvement"
										? "text-yellow-500"
										: "text-red-500"
							}
						>
							{metric.value.toFixed(0)}
							{metric.name === "CLS" ? "" : "ms"}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
