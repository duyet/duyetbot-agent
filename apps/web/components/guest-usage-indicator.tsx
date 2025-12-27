/**
 * Guest Usage Indicator Component
 *
 * Displays remaining messages for guest users.
 * Shows a compact indicator with remaining count and upgrade prompt.
 */

"use client";

import { AlertCircle, MessageSquare, Sparkles } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { formatResetTime, useRateLimitStatus } from "@/hooks/use-rate-limit";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

type GuestUsageIndicatorProps = {
	className?: string;
	variant?: "compact" | "full";
};

function PureGuestUsageIndicator({
	className,
	variant = "compact",
}: GuestUsageIndicatorProps) {
	const { status, isLoading } = useRateLimitStatus();

	// Don't show anything if:
	// - Still loading
	// - Error fetching status
	// - User is not a guest
	if (isLoading || !status || !status.isGuest) {
		return null;
	}

	const { remaining, limit, resetInSeconds } = status;
	const usagePercent = ((limit - remaining) / limit) * 100;

	// Determine urgency level
	const isLow = remaining <= 3;
	const isExhausted = remaining === 0;

	if (variant === "compact") {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<div
							className={cn(
								"flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors",
								isExhausted
									? "bg-destructive/10 text-destructive"
									: isLow
										? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
										: "bg-muted text-muted-foreground",
								className,
							)}
							data-testid="guest-usage-indicator"
						>
							{isExhausted ? (
								<AlertCircle className="size-3" />
							) : (
								<MessageSquare className="size-3" />
							)}
							<span>
								{remaining}/{limit}
							</span>
						</div>
					</TooltipTrigger>
					<TooltipContent className="max-w-[250px]" side="bottom">
						<div className="space-y-2">
							<p className="font-medium">
								{isExhausted
									? "Daily limit reached"
									: `${remaining} messages remaining`}
							</p>
							<p className="text-muted-foreground text-xs">
								{isExhausted
									? `Resets in ${formatResetTime(resetInSeconds)}`
									: `Guest users get ${limit} free messages per day`}
							</p>
							<Link
								className="mt-2 flex items-center gap-1 text-primary text-xs hover:underline"
								href="/register"
							>
								<Sparkles className="size-3" />
								Sign up for unlimited access
							</Link>
						</div>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	// Full variant - shows more detail
	return (
		<div
			className={cn(
				"rounded-lg border p-3",
				isExhausted
					? "border-destructive/50 bg-destructive/5"
					: isLow
						? "border-amber-500/50 bg-amber-500/5"
						: "border-border bg-muted/30",
				className,
			)}
			data-testid="guest-usage-indicator-full"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-1">
					<div className="flex items-center gap-1.5">
						{isExhausted ? (
							<AlertCircle className="size-4 text-destructive" />
						) : (
							<MessageSquare className="size-4 text-muted-foreground" />
						)}
						<span className="font-medium text-sm">
							{isExhausted ? "Daily limit reached" : "Guest Mode"}
						</span>
					</div>
					<p className="text-muted-foreground text-xs">
						{isExhausted
							? `Your messages will reset in ${formatResetTime(resetInSeconds)}`
							: `${remaining} of ${limit} messages remaining today`}
					</p>
				</div>
				<Button
					asChild
					className="h-7 gap-1 text-xs"
					size="sm"
					variant="default"
				>
					<Link href="/register">
						<Sparkles className="size-3" />
						Sign up
					</Link>
				</Button>
			</div>

			{/* Progress bar */}
			<div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
				<div
					className={cn(
						"h-full transition-all",
						isExhausted
							? "bg-destructive"
							: isLow
								? "bg-amber-500"
								: "bg-primary",
					)}
					style={{ width: `${usagePercent}%` }}
				/>
			</div>
		</div>
	);
}

export const GuestUsageIndicator = memo(PureGuestUsageIndicator);
