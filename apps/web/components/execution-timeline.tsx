"use client";

import type {
	Step,
	ToolCompleteStep,
	ToolErrorStep,
	ToolStartStep,
} from "@duyetbot/progress";
import { formatDuration } from "@duyetbot/progress";
import {
	AlertCircle,
	CheckCircle2,
	Clock,
	Loader2,
	Wrench,
} from "lucide-react";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ExecutionTimelineProps = ComponentProps<"div"> & {
	/** Steps to display in the timeline */
	steps: Step[];
	/** Whether to show detailed timing */
	showTiming?: boolean;
	/** Maximum number of items to display */
	maxItems?: number;
};

/**
 * Execution timeline component for visualizing tool execution history.
 * Shows a horizontal timeline with color-coded status indicators.
 */
export const ExecutionTimeline = ({
	steps,
	showTiming = true,
	maxItems = 10,
	className,
	...props
}: ExecutionTimelineProps) => {
	// Filter only tool-related steps and limit
	const toolSteps = useMemo(() => {
		return steps
			.filter(
				(step): step is ToolStartStep | ToolCompleteStep | ToolErrorStep =>
					step.type === "tool_start" ||
					step.type === "tool_complete" ||
					step.type === "tool_error",
			)
			.slice(-maxItems);
	}, [steps, maxItems]);

	// Group by tool name to track completion
	const toolStatus = useMemo(() => {
		const status: Record<
			string,
			{ status: "running" | "completed" | "error"; duration: number }
		> = {};

		for (const step of toolSteps) {
			const name = step.toolName;
			if (!status[name]) {
				status[name] = { status: "running", duration: 0 };
			}

			if (step.type === "tool_complete") {
				status[name].status = "completed";
				status[name].duration += step.durationMs;
			} else if (step.type === "tool_error") {
				status[name].status = "error";
				status[name].duration += step.durationMs;
			} else if (step.type === "tool_start") {
				status[name].status = "running";
			}
		}

		return status;
	}, [toolSteps]);

	const totalDuration = steps.reduce((acc, s) => acc + s.durationMs, 0);

	// Early return after all hooks
	if (toolSteps.length === 0) {
		return null;
	}

	return (
		<div className={cn("w-full overflow-hidden", className)} {...props}>
			{/* Header with stats */}
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Wrench className="size-4 text-muted-foreground" />
					<span className="font-medium text-sm">Tool Executions</span>
					<Badge variant="secondary" className="text-xs">
						{Object.keys(toolStatus).length} tools
					</Badge>
				</div>
				{showTiming && totalDuration > 0 && (
					<div className="flex items-center gap-1 text-muted-foreground text-xs">
						<Clock className="size-3" />
						<span>{formatDuration(totalDuration)}</span>
					</div>
				)}
			</div>

			{/* Timeline */}
			<TooltipProvider>
				<div className="flex items-center gap-1.5 overflow-x-auto pb-2">
					{Object.entries(toolStatus).map(([name, info]) => (
						<TimelineItem
							key={name}
							name={name}
							status={info.status}
							duration={info.duration}
							showTiming={showTiming}
						/>
					))}
				</div>
			</TooltipProvider>
		</div>
	);
};

type TimelineItemProps = {
	name: string;
	status: "running" | "completed" | "error";
	duration: number;
	showTiming: boolean;
};

const TimelineItem = ({
	name,
	status,
	duration,
	showTiming,
}: TimelineItemProps) => {
	const { icon, bgClass, textClass } = useMemo(() => {
		switch (status) {
			case "completed":
				return {
					icon: <CheckCircle2 className="size-3.5" />,
					bgClass: "bg-green-500/10 border-green-500/20",
					textClass: "text-green-600 dark:text-green-400",
				};
			case "error":
				return {
					icon: <AlertCircle className="size-3.5" />,
					bgClass: "bg-red-500/10 border-red-500/20",
					textClass: "text-red-600 dark:text-red-400",
				};
			default:
				return {
					icon: <Loader2 className="size-3.5 animate-spin" />,
					bgClass: "bg-yellow-500/10 border-yellow-500/20",
					textClass: "text-yellow-600 dark:text-yellow-400",
				};
		}
	}, [status]);

	// Shorten tool name for display
	const shortName = name.length > 15 ? `${name.slice(0, 12)}...` : name;

	return (
		<Tooltip delayDuration={300}>
			<TooltipTrigger asChild>
				<div
					className={cn(
						"flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs transition-colors",
						"hover:bg-accent cursor-help",
						bgClass,
					)}
				>
					<div className={cn("flex-shrink-0", textClass)}>{icon}</div>
					<span className="font-medium">{shortName}</span>
					{showTiming && duration > 0 && (
						<span className="text-muted-foreground text-xs">
							{formatDuration(duration)}
						</span>
					)}
				</div>
			</TooltipTrigger>
			<TooltipContent side="top" className="max-w-xs">
				<div className="space-y-1">
					<p className="font-medium text-sm">{name}</p>
					<p className="text-muted-foreground text-xs capitalize">
						Status: {status}
					</p>
					{showTiming && duration > 0 && (
						<p className="text-muted-foreground text-xs">
							Duration: {formatDuration(duration)}
						</p>
					)}
				</div>
			</TooltipContent>
		</Tooltip>
	);
};

/**
 * Compact version of the timeline for embedding in messages
 */
export type CompactExecutionTimelineProps = Omit<
	ExecutionTimelineProps,
	"className"
>;

export const CompactExecutionTimeline = ({
	steps,
	showTiming = false,
}: CompactExecutionTimelineProps) => {
	const toolSteps = useMemo(() => {
		return steps
			.filter(
				(step): step is ToolCompleteStep | ToolErrorStep =>
					step.type === "tool_complete" || step.type === "tool_error",
			)
			.slice(-5);
	}, [steps]);

	if (toolSteps.length === 0) {
		return null;
	}

	const completedCount = toolSteps.filter(
		(s) => s.type === "tool_complete",
	).length;
	const errorCount = toolSteps.filter((s) => s.type === "tool_error").length;

	return (
		<div className="flex items-center gap-2">
			<Badge variant="outline" className="gap-1 text-xs">
				<Wrench className="size-3" />
				{completedCount + errorCount} tools
			</Badge>
			{errorCount > 0 && (
				<Badge variant="destructive" className="text-xs">
					{errorCount} failed
				</Badge>
			)}
			{showTiming && (
				<span className="text-muted-foreground text-xs">
					{formatDuration(steps.reduce((acc, s) => acc + s.durationMs, 0))}
				</span>
			)}
		</div>
	);
};

export default ExecutionTimeline;
