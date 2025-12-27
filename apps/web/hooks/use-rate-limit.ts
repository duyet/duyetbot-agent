/**
 * Rate Limit Status Hook
 *
 * Provides real-time rate limit information for the current user.
 * Automatically refetches after each message and on window focus.
 */

"use client";

import useSWR from "swr";
import { getStoredToken } from "@/lib/auth/token-storage";

export type RateLimitStatus = {
	isGuest: boolean;
	limit: number;
	remaining: number;
	resetAt: string;
	windowDescription: string;
	resetInSeconds: number;
};

type RateLimitResponse = RateLimitStatus | { error: string; message: string };

const fetcher = async (url: string): Promise<RateLimitStatus | null> => {
	const token = getStoredToken();
	const headers: HeadersInit = {};
	if (token) {
		headers["Authorization"] = `Bearer ${token}`;
	}

	const response = await fetch(url, { headers });

	if (!response.ok) {
		// Return null for errors - don't show usage indicator
		return null;
	}

	const data: RateLimitResponse = await response.json();

	if ("error" in data) {
		return null;
	}

	return data;
};

/**
 * Hook to get current rate limit status
 *
 * Returns null while loading or if rate limiting is not configured.
 * Automatically refreshes on window focus and after mutations.
 */
export function useRateLimitStatus() {
	const { data, error, isLoading, mutate } = useSWR<RateLimitStatus | null>(
		"/api/rate-limit/status",
		fetcher,
		{
			// Refresh on focus
			revalidateOnFocus: true,
			// Refresh every 30 seconds for guests (to update countdown)
			refreshInterval: (data) => (data?.isGuest ? 30_000 : 0),
			// Don't retry on error (rate limiting might not be configured)
			shouldRetryOnError: false,
			// Keep stale data while refreshing
			revalidateIfStale: true,
		},
	);

	return {
		status: data ?? null,
		isLoading,
		error,
		/**
		 * Call this after sending a message to update the remaining count
		 */
		refresh: () => mutate(),
	};
}

/**
 * Format reset time as human-readable string
 */
export function formatResetTime(resetInSeconds: number): string {
	if (resetInSeconds <= 0) {
		return "now";
	}

	if (resetInSeconds < 60) {
		return `${resetInSeconds}s`;
	}

	if (resetInSeconds < 3600) {
		const minutes = Math.ceil(resetInSeconds / 60);
		return `${minutes}m`;
	}

	const hours = Math.floor(resetInSeconds / 3600);
	const minutes = Math.ceil((resetInSeconds % 3600) / 60);

	if (minutes === 0) {
		return `${hours}h`;
	}

	return `${hours}h ${minutes}m`;
}
