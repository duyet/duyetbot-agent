"use client";

import type { StepCollection } from "@duyetbot/progress";
import {
	Bug,
	ChevronDown,
	ChevronUp,
	Copy,
	Download,
	EyeOff,
} from "lucide-react";
import type { ComponentProps } from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ExecutionTimeline } from "./execution-timeline";
import { ProgressTracker } from "./progress-tracker";
import TokenTracker from "./token-tracker";

export type DebugFooterProps = ComponentProps<"div"> & {
	/** Step collection to display */
	stepCollection: StepCollection;
	/** Whether to show debug info by default */
	defaultOpen?: boolean;
	/** Custom title */
	title?: string;
	/** Whether to show copy button */
	showCopy?: boolean;
	/** Callback when copy is clicked */
	onCopy?: () => void;
};

/**
 * Debug footer component for displaying agent execution details.
 * Toggleable panel showing progress, tokens, and timeline.
 */
export const DebugFooter = ({
	stepCollection,
	defaultOpen = false,
	title = "Debug Information",
	showCopy = true,
	onCopy,
	className,
	...props
}: DebugFooterProps) => {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	const { steps, tokenUsage, model, durationMs, traceId } = stepCollection;

	const handleCopy = () => {
		const debugText = JSON.stringify(stepCollection, null, 2);
		navigator.clipboard.writeText(debugText);
		onCopy?.();
	};

	const handleExport = () => {
		const blob = new Blob([JSON.stringify(stepCollection, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `debug-${traceId || Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<Collapsible
			open={isOpen}
			onOpenChange={setIsOpen}
			className={cn("w-full", className)}
			{...props}
		>
			<Card className="border-dashed border-muted-foreground/25 bg-muted/20">
				<CollapsibleTrigger asChild>
					<CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Bug className="size-4 text-muted-foreground" />
								<CardTitle className="text-sm">{title}</CardTitle>
								<Badge variant="outline" className="text-xs">
									{steps.length} steps
								</Badge>
								{traceId && (
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Badge
													variant="secondary"
													className="max-w-[100px] truncate cursor-help font-mono text-xs"
												>
													{traceId.slice(0, 8)}
												</Badge>
											</TooltipTrigger>
											<TooltipContent>
												<p className="font-mono text-xs">{traceId}</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								)}
							</div>
							<div className="flex items-center gap-2">
								{showCopy && (
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="size-8 p-0"
													onClick={(e) => {
														e.stopPropagation();
														handleCopy();
													}}
												>
													<Copy className="size-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p className="text-xs">Copy debug info</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								)}
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="size-8 p-0"
												onClick={(e) => {
													e.stopPropagation();
													handleExport();
												}}
											>
												<Download className="size-4" />
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											<p className="text-xs">Export debug info</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
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
					<CardContent className="space-y-4 pt-0">
						{/* Token Usage */}
						{tokenUsage && (
							<TokenTracker
								tokenUsage={tokenUsage}
								model={model}
								durationMs={durationMs}
								defaultOpen={false}
							/>
						)}

						<Separator />

						{/* Execution Timeline */}
						<ExecutionTimeline steps={steps} showTiming />

						<Separator />

						{/* Progress Tracker */}
						<ProgressTracker steps={steps} showTiming maxSteps={15} />

						{/* Model and timing info */}
						{(model || durationMs) && (
							<>
								<Separator />
								<div className="flex items-center justify-between text-muted-foreground text-xs">
									<div className="flex items-center gap-2">
										{model && (
											<span>
												Model: <span className="font-mono">{model}</span>
											</span>
										)}
									</div>
									{durationMs && (
										<span>
											Duration:{" "}
											<span className="font-mono">{durationMs}ms</span>
										</span>
									)}
								</div>
							</>
						)}
					</CardContent>
				</CollapsibleContent>
			</Card>
		</Collapsible>
	);
};

/**
 * Toggle button for showing/hiding debug footer
 */
export type DebugFooterToggleProps = {
	isOpen: boolean;
	onToggle: () => void;
	stepCount?: number;
	hasErrors?: boolean;
};

export const DebugFooterToggle = ({
	isOpen,
	onToggle,
	stepCount = 0,
	hasErrors = false,
}: DebugFooterToggleProps) => {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						onClick={onToggle}
						className={cn(
							"gap-2 transition-colors",
							isOpen && "bg-accent",
							hasErrors && "text-destructive hover:text-destructive",
						)}
					>
						{isOpen ? (
							<EyeOff className="size-4" />
						) : (
							<Bug className="size-4" />
						)}
						<span className="text-xs">{isOpen ? "Hide" : "Show"} Debug</span>
						{stepCount > 0 && (
							<Badge variant="secondary" className="text-xs">
								{stepCount}
							</Badge>
						)}
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p className="text-xs">
						{isOpen ? "Hide" : "Show"} execution details
					</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};

/**
 * Minimal debug indicator for inline display
 */
export type DebugIndicatorProps = {
	stepCount: number;
	durationMs?: number;
	hasErrors?: boolean;
	onClick?: () => void;
};

export const DebugIndicator = ({
	stepCount,
	durationMs,
	hasErrors,
	onClick,
}: DebugIndicatorProps) => {
	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={onClick}
			className="h-7 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
		>
			<Bug className="size-3" />
			<span className="text-xs">{stepCount} steps</span>
			{durationMs !== undefined && (
				<span className="text-muted-foreground text-xs">({durationMs}ms)</span>
			)}
			{hasErrors && (
				<Badge variant="destructive" className="ml-1 text-xs">
					!
				</Badge>
			)}
		</Button>
	);
};

export default DebugFooter;
