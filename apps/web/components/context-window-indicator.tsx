"use client";

/**
 * Context Window Indicator
 *
 * Shows how much of the model's context window is being used.
 * Helps users understand when they're approaching context limits.
 */

import { AlertCircle, MessageSquare } from "lucide-react";
import { useMemo } from "react";
import { getContextWindow } from "@/lib/ai/models";
import { estimateTokens, formatTokenCount } from "./token-usage-display";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

type ContextWindowIndicatorProps = {
	messages: ChatMessage[];
	modelId: string;
	className?: string;
	variant?: "compact" | "detailed";
};

// Estimate tokens for a message
function estimateMessageTokens(message: ChatMessage): number {
	let tokens = 0;

	for (const part of message.parts || []) {
		if (part.type === "text" && part.text) {
			tokens += estimateTokens(part.text);
		} else if (part.type === "reasoning" && part.text) {
			tokens += estimateTokens(part.text);
		}
	}

	// Add overhead for message structure
	tokens += 4; // Role, structure tokens

	return tokens;
}

export function ContextWindowIndicator({
	messages,
	modelId,
	className,
	variant = "compact",
}: ContextWindowIndicatorProps) {
	const contextWindow = getContextWindow(modelId);

	// Calculate total tokens used
	const { usedTokens, messageCount } = useMemo(() => {
		let tokens = 0;
		for (const msg of messages) {
			// Use actual usage if available, otherwise estimate
			if (msg.metadata?.usage?.totalTokens) {
				tokens += msg.metadata.usage.totalTokens;
			} else {
				tokens += estimateMessageTokens(msg);
			}
		}
		return { usedTokens: tokens, messageCount: messages.length };
	}, [messages]);

	const usagePercent = Math.min((usedTokens / contextWindow) * 100, 100);
	const isWarning = usagePercent > 75;
	const isCritical = usagePercent > 90;

	// Color based on usage level
	const getStatusColor = () => {
		if (isCritical) return "text-destructive";
		if (isWarning) return "text-amber-500";
		return "text-muted-foreground";
	};

	const getProgressColor = () => {
		if (isCritical) return "bg-destructive";
		if (isWarning) return "bg-amber-500";
		return "bg-primary";
	};

	if (variant === "compact") {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<div
							className={cn(
								"flex items-center gap-1.5 text-xs",
								getStatusColor(),
								className,
							)}
						>
							{isCritical ? (
								<AlertCircle className="h-3 w-3" />
							) : (
								<MessageSquare className="h-3 w-3" />
							)}
							<span className="font-mono">{Math.round(usagePercent)}%</span>
						</div>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<div className="space-y-1 text-xs">
							<p className="font-medium">Context Window Usage</p>
							<p>
								{formatTokenCount(usedTokens)} / {formatTokenCount(contextWindow)}{" "}
								tokens
							</p>
							<p className="text-muted-foreground">
								{messageCount} messages in conversation
							</p>
							{isCritical && (
								<p className="text-destructive">
									Context nearly full - consider starting a new chat
								</p>
							)}
							{isWarning && !isCritical && (
								<p className="text-amber-500">
									Context filling up - older messages may be truncated
								</p>
							)}
						</div>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	// Detailed variant
	return (
		<div className={cn("space-y-2", className)}>
			<div className="flex items-center justify-between text-xs">
				<div className="flex items-center gap-1.5">
					{isCritical ? (
						<AlertCircle className={cn("h-3 w-3", getStatusColor())} />
					) : (
						<MessageSquare className="h-3 w-3 text-muted-foreground" />
					)}
					<span className="text-muted-foreground">Context</span>
				</div>
				<span className={cn("font-mono", getStatusColor())}>
					{formatTokenCount(usedTokens)} / {formatTokenCount(contextWindow)}
				</span>
			</div>

			{/* Progress bar */}
			<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
				<div
					className={cn("h-full rounded-full transition-all", getProgressColor())}
					style={{ width: `${usagePercent}%` }}
				/>
			</div>

			{/* Warning messages */}
			{isCritical && (
				<p className="text-[10px] text-destructive">
					Context nearly full - start a new chat soon
				</p>
			)}
			{isWarning && !isCritical && (
				<p className="text-[10px] text-amber-500">
					Context filling up ({Math.round(usagePercent)}%)
				</p>
			)}
		</div>
	);
}
