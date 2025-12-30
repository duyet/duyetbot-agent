"use client";

import type { TokenUsage } from "@duyetbot/progress";
import {
	formatCompactNumber,
	formatCost,
	formatDuration,
} from "@duyetbot/progress";
import { ChevronDown, ChevronUp, Coins, TrendingUp, Zap } from "lucide-react";
import type { ComponentProps } from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type TokenTrackerProps = ComponentProps<"div"> & {
	/** Token usage data */
	tokenUsage: TokenUsage;
	/** Model identifier */
	model?: string;
	/** Duration in milliseconds */
	durationMs?: number;
	/** Whether to show detailed breakdown */
	defaultOpen?: boolean;
	/** Optional custom cost display */
	customCost?: string;
};

/**
 * Token tracker component for displaying LLM token usage and cost information.
 * Shows input/output tokens, cached tokens, and estimated cost.
 */
export const TokenTracker = ({
	tokenUsage,
	model,
	durationMs,
	defaultOpen = false,
	customCost,
	className,
	...props
}: TokenTrackerProps) => {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	const {
		input,
		output,
		total,
		cached = 0,
		reasoning = 0,
		costUsd,
	} = tokenUsage;

	const hasCachedTokens = cached > 0;
	const hasReasoningTokens = reasoning > 0;
	const effectiveInput = input - cached - reasoning;

	return (
		<Collapsible
			open={isOpen}
			onOpenChange={setIsOpen}
			className={cn("w-full", className)}
			{...props}
		>
			<Card className="border-muted/50 bg-muted/30">
				<CollapsibleTrigger asChild>
					<CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Coins className="size-4 text-primary" />
								<CardTitle className="text-sm">Token Usage</CardTitle>
								{model && (
									<Badge variant="outline" className="text-xs">
										{model.split("/").pop()}
									</Badge>
								)}
							</div>
							<div className="flex items-center gap-3">
								<div className="text-right">
									<div className="font-semibold text-sm">
										{customCost ||
											(costUsd !== undefined ? formatCost(costUsd) : "-")}
									</div>
									{durationMs !== undefined && (
										<CardDescription className="text-xs">
											{formatDuration(durationMs)}
										</CardDescription>
									)}
								</div>
								<Button variant="ghost" size="sm" className="size-8 p-0">
									{isOpen ? (
										<ChevronUp className="size-4" />
									) : (
										<ChevronDown className="size-4" />
									)}
								</Button>
							</div>
						</div>
					</CardHeader>
				</CollapsibleTrigger>

				<CollapsibleContent>
					<CardContent className="space-y-4">
						{/* Total tokens badge */}
						<div className="flex items-center justify-center">
							<Badge className="gap-1.5 px-3 py-1 text-sm">
								<TrendingUp className="size-3.5" />
								<span className="font-semibold">
									{formatCompactNumber(total)} tokens
								</span>
							</Badge>
						</div>

						{/* Token breakdown */}
						<div className="grid grid-cols-2 gap-3">
							<TokenMetricCard
								label="Input"
								value={effectiveInput}
								color="text-blue-500"
								bgColor="bg-blue-500/10"
								icon={<Zap className="size-3" />}
							/>
							<TokenMetricCard
								label="Output"
								value={output}
								color="text-green-500"
								bgColor="bg-green-500/10"
								icon={<TrendingUp className="size-3" />}
							/>
						</div>

						{/* Special token types */}
						{(hasCachedTokens || hasReasoningTokens) && (
							<div className="space-y-2 pt-2 border-t">
								{hasCachedTokens && (
									<TokenMetricRow
										label="Cached"
										value={cached}
										color="text-purple-500"
										bgColor="bg-purple-500/10"
										description="Discounted input tokens"
									/>
								)}
								{hasReasoningTokens && (
									<TokenMetricRow
										label="Reasoning"
										value={reasoning}
										color="text-orange-500"
										bgColor="bg-orange-500/10"
										description="Extended thinking tokens"
									/>
								)}
							</div>
						)}

						{/* Cost breakdown tooltip */}
						{costUsd !== undefined && (
							<div className="pt-2 border-t">
								<p className="text-muted-foreground text-xs text-center">
									Estimated cost based on model pricing
								</p>
							</div>
						)}
					</CardContent>
				</CollapsibleContent>
			</Card>
		</Collapsible>
	);
};

type TokenMetricCardProps = {
	label: string;
	value: number;
	color: string;
	bgColor: string;
	icon: React.ReactNode;
};

const TokenMetricCard = ({
	label,
	value,
	color,
	bgColor,
	icon,
}: TokenMetricCardProps) => (
	<div
		className={cn(
			"flex flex-col items-center justify-center rounded-lg border p-3",
			bgColor,
		)}
	>
		<div className={cn("flex items-center gap-1.5", color)}>
			{icon}
			<span className="font-medium text-xs">{label}</span>
		</div>
		<span className={cn("mt-1 text-2xl font-bold", color)}>
			{formatCompactNumber(value)}
		</span>
	</div>
);

type TokenMetricRowProps = {
	label: string;
	value: number;
	color: string;
	bgColor: string;
	description?: string;
};

const TokenMetricRow = ({
	label,
	value,
	color,
	bgColor,
	description,
}: TokenMetricRowProps) => (
	<div
		className={cn(
			"flex items-center justify-between rounded-md px-3 py-2",
			bgColor,
		)}
	>
		<div className="flex flex-col">
			<div className={cn("flex items-center gap-2", color)}>
				<span className="font-medium text-xs">{label}</span>
				<span className="font-semibold text-sm">
					{formatCompactNumber(value)}
				</span>
			</div>
			{description && (
				<p className="text-muted-foreground text-xs">{description}</p>
			)}
		</div>
	</div>
);

export default TokenTracker;
