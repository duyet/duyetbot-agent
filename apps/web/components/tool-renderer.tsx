"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { ToolUIPart } from "ai";
import {
	AlertCircle,
	CheckCircle2,
	Clock,
	Loader2,
	XCircle,
} from "lucide-react";
import { useMemo } from "react";
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@/components/ai-elements/tool";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ToolRendererProps = {
	addToolApprovalResponse: UseChatHelpers<any>["addToolApprovalResponse"];
	part: ToolUIPart;
	/** Show execution timing information */
	showTiming?: boolean;
	/** Execution duration in milliseconds */
	durationMs?: number;
};

/**
 * Enhanced tool renderer with status indicators and additional metadata
 * Handles all tool-* part types with type-safe rendering
 */
export function ToolRenderer({
	addToolApprovalResponse,
	part,
	showTiming = false,
	durationMs,
}: ToolRendererProps) {
	const { toolCallId, state, type, input, output, errorText } = part;
	const approvalId = (part as { approval?: { id: string } }).approval?.id;
	const isDenied =
		state === "output-denied" ||
		(state === "approval-responded" &&
			(part as { approval?: { approved?: boolean } }).approval?.approved ===
				false);

	// Extract tool name from type (e.g., "tool-webSearch" -> "webSearch")
	const toolName = type.replace("tool-", "");

	// Get status information for enhanced display
	const statusInfo = useMemo(() => {
		switch (state) {
			case "input-streaming":
				return {
					icon: (
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					),
					label: "Pending",
					color: "text-muted-foreground",
					bgColor: "bg-muted/50",
				};
			case "input-available":
				return {
					icon: <Clock className="size-4 animate-pulse text-yellow-600" />,
					label: "Running",
					color: "text-yellow-600",
					bgColor: "bg-yellow-500/10",
				};
			case "approval-requested":
				return {
					icon: <Clock className="size-4 text-orange-600" />,
					label: "Awaiting Approval",
					color: "text-orange-600",
					bgColor: "bg-orange-500/10",
				};
			case "approval-responded":
				return {
					icon: isDenied ? (
						<XCircle className="size-4 text-red-600" />
					) : (
						<CheckCircle2 className="size-4 text-blue-600" />
					),
					label: isDenied ? "Denied" : "Approved",
					color: isDenied ? "text-red-600" : "text-blue-600",
					bgColor: isDenied ? "bg-red-500/10" : "bg-blue-500/10",
				};
			case "output-available":
				return {
					icon: <CheckCircle2 className="size-4 text-green-600" />,
					label: "Completed",
					color: "text-green-600",
					bgColor: "bg-green-500/10",
				};
			case "output-error":
				return {
					icon: <AlertCircle className="size-4 text-red-600" />,
					label: "Error",
					color: "text-red-600",
					bgColor: "bg-red-500/10",
				};
			case "output-denied":
				return {
					icon: <XCircle className="size-4 text-orange-600" />,
					label: "Denied",
					color: "text-orange-600",
					bgColor: "bg-orange-500/10",
				};
			default:
				return {
					icon: (
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					),
					label: "Unknown",
					color: "text-muted-foreground",
					bgColor: "bg-muted/50",
				};
		}
	}, [state, isDenied]);

	// Format duration for display
	const formattedDuration = useMemo(() => {
		if (!durationMs || !showTiming) return null;
		if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
		if (durationMs < 60000) return `${(durationMs / 1000).toFixed(2)}s`;
		const minutes = Math.floor(durationMs / 60000);
		const seconds = Math.round((durationMs % 60000) / 1000);
		return `${minutes}m ${seconds}s`;
	}, [durationMs, showTiming]);

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="w-[min(100%,450px)]">
						<Tool defaultOpen={true}>
							<ToolHeader state={state} type={type} />
							<ToolContent>
								{/* Show input when available */}
								{(state === "input-available" ||
									state === "approval-requested" ||
									state === "approval-responded") && (
									<ToolInput input={input} />
								)}

								{/* Show approval buttons when requested */}
								{state === "approval-requested" && approvalId && (
									<div className="flex items-center justify-end gap-2 border-t px-4 py-3">
										<button
											className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
											onClick={() => {
												addToolApprovalResponse({
													id: approvalId,
													approved: false,
													reason: `User denied ${toolName}`,
												});
											}}
											type="button"
										>
											Deny
										</button>
										<button
											className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
											onClick={() => {
												addToolApprovalResponse({
													id: approvalId,
													approved: true,
												});
											}}
											type="button"
										>
											Allow
										</button>
									</div>
								)}

								{/* Show output when available */}
								{state === "output-available" && !isDenied && (
									<ToolOutput errorText={errorText} output={output} />
								)}

								{/* Show denied message */}
								{isDenied && (
									<div className="px-4 py-3 text-muted-foreground text-sm">
										{toolName} was denied.
									</div>
								)}

								{/* Footer with status and timing */}
								<div
									className={cn(
										"flex items-center justify-between border-t px-4 py-2",
										statusInfo.bgColor,
									)}
								>
									<div className="flex items-center gap-2">
										{statusInfo.icon}
										<span
											className={cn("font-medium text-xs", statusInfo.color)}
										>
											{statusInfo.label}
										</span>
									</div>
									{formattedDuration && (
										<Badge variant="secondary" className="text-xs">
											{formattedDuration}
										</Badge>
									)}
								</div>
							</ToolContent>
						</Tool>
					</div>
				</TooltipTrigger>
				<TooltipContent side="top" className="max-w-xs">
					<div className="space-y-1">
						<p className="font-medium text-sm">{toolName}</p>
						<p className="text-muted-foreground text-xs capitalize">
							Status: {statusInfo.label}
						</p>
						{formattedDuration && (
							<p className="text-muted-foreground text-xs">
								Duration: {formattedDuration}
							</p>
						)}
						{toolCallId && (
							<p className="text-muted-foreground text-xs font-mono">
								ID: {toolCallId.slice(0, 8)}...
							</p>
						)}
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/**
 * Compact tool status badge for inline display
 */
export type ToolStatusBadgeProps = {
	state: ToolUIPart["state"];
	toolName: string;
	durationMs?: number;
};

export function ToolStatusBadge({
	state,
	toolName,
	durationMs,
}: ToolStatusBadgeProps) {
	const statusInfo = useMemo(() => {
		switch (state) {
			case "input-streaming":
			case "input-available":
				return {
					icon: <Loader2 className="size-3 animate-spin" />,
					variant: "secondary" as const,
				};
			case "approval-requested":
				return {
					icon: <Clock className="size-3" />,
					variant: "secondary" as const,
				};
			case "approval-responded":
			case "output-denied":
				return {
					icon: <XCircle className="size-3" />,
					variant: "destructive" as const,
				};
			case "output-available":
				return {
					icon: <CheckCircle2 className="size-3" />,
					variant: "secondary" as const,
				};
			case "output-error":
				return {
					icon: <AlertCircle className="size-3" />,
					variant: "destructive" as const,
				};
			default:
				return {
					icon: <Loader2 className="size-3 animate-spin" />,
					variant: "secondary" as const,
				};
		}
	}, [state]);

	const formattedDuration = durationMs
		? durationMs < 1000
			? `${Math.round(durationMs)}ms`
			: `${(durationMs / 1000).toFixed(1)}s`
		: null;

	return (
		<Badge variant={statusInfo.variant} className="gap-1.5 text-xs">
			{statusInfo.icon}
			<span>{toolName}</span>
			{formattedDuration && <span>({formattedDuration})</span>}
		</Badge>
	);
}
