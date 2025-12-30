"use client";

import { AlertOctagon, AlertTriangle, RefreshCw, X } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Button } from "./ui/button";

export type ErrorSeverity = "error" | "warning" | "info";

interface ErrorWithRetryProps {
	/** Error message to display */
	error: string;
	/** Severity level for visual styling */
	severity?: ErrorSeverity;
	/** Whether retry is in progress */
	isRetrying?: boolean;
	/** Optional callback for retry action */
	onRetry?: () => void | Promise<void>;
	/** Optional callback to dismiss the error */
	onDismiss?: () => void;
	/** Optional custom retry button text */
	retryText?: string;
	/** Optional custom icon */
	icon?: ReactNode;
	/** Size variant */
	size?: "sm" | "md" | "lg";
	/** Additional CSS classes */
	className?: string;
}

/**
 * Reusable error display component with optional retry functionality.
 * Supports different severity levels and sizes for various UI contexts.
 */
export function ErrorWithRetry({
	error,
	severity = "error",
	isRetrying = false,
	onRetry,
	onDismiss,
	retryText = "Retry",
	icon,
	size = "md",
	className,
}: ErrorWithRetryProps) {
	const sizeClasses = {
		sm: "p-2 text-xs gap-2",
		md: "p-3 text-sm gap-3",
		lg: "p-4 text-base gap-4",
	};

	const iconSize = {
		sm: 14,
		md: 16,
		lg: 20,
	};

	const buttonSize = {
		sm: "sm" as const,
		md: "sm" as const,
		lg: "default" as const,
	};

	const severityClasses = {
		error: "border-destructive/50 bg-destructive/10 text-destructive",
		warning:
			"border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400",
		info: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400",
	};

	const DefaultIcon = severity === "error" ? AlertOctagon : AlertTriangle;

	return (
		<div
			className={`flex items-start ${sizeClasses[size]} ${severityClasses[severity]} rounded-lg border ${className || ""}`}
		>
			{icon ? (
				icon
			) : (
				<DefaultIcon
					className="shrink-0"
					size={iconSize[size]}
					aria-hidden="true"
				/>
			)}

			<span className="flex-1">{error}</span>

			<div className="flex shrink-0 items-center gap-2">
				{onRetry && (
					<Button
						disabled={isRetrying}
						onClick={onRetry}
						size={buttonSize[size]}
						variant="ghost"
						className="h-auto px-2 py-1"
					>
						<RefreshCw
							className={`size-3 ${isRetrying ? "animate-spin" : ""}`}
							aria-hidden="true"
						/>
						<span className="ml-1">
							{isRetrying ? "Retrying..." : retryText}
						</span>
					</Button>
				)}

				{onDismiss && (
					<Button
						disabled={isRetrying}
						onClick={onDismiss}
						size={buttonSize[size]}
						variant="ghost"
						className="h-auto px-2 py-1"
						aria-label="Dismiss error"
					>
						<X className="size-3" aria-hidden="true" />
					</Button>
				)}
			</div>
		</div>
	);
}

/**
 * Props for hook-based error state with retry functionality
 */
export interface ErrorWithRetryState {
	error: string | null;
	isRetrying: boolean;
	setError: (error: string | null) => void;
	setRetrying: (isRetrying: boolean) => void;
	retry: () => void | Promise<void>;
}

/**
 * Hook to manage error state with retry functionality
 *
 * @example
 * ```tsx
 * const errorState = useErrorWithRetryState(async () => {
 *   await fetchData();
 * });
 *
 * {errorState.error && (
 *   <ErrorWithRetry
 *     error={errorState.error}
 *     isRetrying={errorState.isRetrying}
 *     onRetry={errorState.retry}
 *     onDismiss={() => errorState.setError(null)}
 *   />
 * )}
 * ```
 */
export function useErrorWithRetryState(
	retryCallback: () => void | Promise<void>,
): ErrorWithRetryState {
	const [error, setError] = useState<string | null>(null);
	const [isRetrying, setRetrying] = useState(false);

	const retry = useCallback(async () => {
		setRetrying(true);
		try {
			await retryCallback();
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "An error occurred");
		} finally {
			setRetrying(false);
		}
	}, [retryCallback]);

	return {
		error,
		isRetrying,
		setError,
		setRetrying,
		retry,
	};
}
