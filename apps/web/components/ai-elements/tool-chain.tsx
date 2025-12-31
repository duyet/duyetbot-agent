"use client";

import type { ToolUIPart } from "ai";
import {
	ArrowDownIcon,
	CheckCircle2Icon,
	CircleIcon,
	Loader2Icon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tool, ToolContent, ToolHeader, ToolInput } from "./tool";

export type ToolChainProps = ComponentProps<"div"> & {
	tools: ToolUIPart[];
};

/**
 * Groups tools by execution chains based on temporal proximity and state patterns
 * Tools that execute sequentially (input → output) are grouped into chains
 */
function groupToolsIntoChains(tools: ToolUIPart[]): ToolUIPart[][] {
	const chains: ToolUIPart[][] = [];
	let currentChain: ToolUIPart[] = [];

	for (let i = 0; i < tools.length; i++) {
		const tool = tools[i];

		// Start new chain if this is the first tool
		if (currentChain.length === 0) {
			currentChain.push(tool);
			continue;
		}

		const prevTool = currentChain[currentChain.length - 1];

		// Check if this tool should be part of the current chain:
		// 1. Previous tool has output (completed execution)
		// 2. Current tool is not already completed (still in progress or pending)
		const prevCompleted =
			prevTool.state === "output-available" ||
			prevTool.state === "output-error" ||
			prevTool.state === "output-denied";
		const currentInProgress =
			tool.state === "input-streaming" ||
			tool.state === "input-available" ||
			tool.state === "approval-requested" ||
			tool.state === "approval-responded";

		if (prevCompleted && currentInProgress) {
			// Continue the chain
			currentChain.push(tool);
		} else {
			// Start a new chain
			if (currentChain.length > 0) {
				chains.push(currentChain);
			}
			currentChain = [tool];
		}
	}

	// Don't forget the last chain
	if (currentChain.length > 0) {
		chains.push(currentChain);
	}

	return chains;
}

/**
 * Gets the appropriate icon and color for a tool's execution state
 */
function getStateIcon(state: ToolUIPart["state"]) {
	switch (state) {
		case "input-streaming":
			return <Loader2Icon className="size-4 animate-spin text-blue-500" />;
		case "input-available":
		case "approval-requested":
			return <Loader2Icon className="size-4 animate-pulse text-yellow-500" />;
		case "approval-responded":
			return <CircleIcon className="size-4 text-blue-500" />;
		case "output-available":
			return <CheckCircle2Icon className="size-4 text-green-500" />;
		case "output-error":
			return <CircleIcon className="size-4 text-red-500 fill-red-500" />;
		case "output-denied":
			return <CircleIcon className="size-4 text-orange-500 fill-orange-500" />;
		default:
			return <CircleIcon className="size-4 text-muted-foreground" />;
	}
}

/**
 * Gets the status label for a tool's execution state
 */
function getStateLabel(state: ToolUIPart["state"]): string {
	const labels: Record<ToolUIPart["state"], string> = {
		"input-streaming": "Starting...",
		"input-available": "Running",
		"approval-requested": "Awaiting approval",
		"approval-responded": "Approved",
		"output-available": "Complete",
		"output-error": "Error",
		"output-denied": "Denied",
	};
	return labels[state];
}

/**
 * Extracts a short description from tool input for the chain label
 */
function getToolDescription(tool: ToolUIPart): string {
	if (!tool.input) return tool.type.split("-").slice(1).join("-");

	// Extract meaningful info based on tool type
	switch (tool.type) {
		case "tool-web_search":
			return typeof tool.input === "object" && "query" in tool.input
				? `Search: ${String(tool.input.query).slice(0, 30)}...`
				: "Web Search";
		case "tool-url_fetch":
			return typeof tool.input === "object" && "url" in tool.input
				? `Fetch: ${String(tool.input.url).slice(0, 30)}...`
				: "URL Fetch";
		case "tool-getWeather":
			return typeof tool.input === "object" && "location" in tool.input
				? `Weather: ${String(tool.input.location)}`
				: "Weather Lookup";
		case "tool-plan":
			return "Plan Generation";
		case "tool-duyet_mcp":
			return typeof tool.input === "object" && "action" in tool.input
				? `MCP: ${String(tool.input.action)}`
				: "MCP Action";
		case "tool-scratchpad":
			return "Scratchpad";
		default:
			return tool.type.split("-").slice(1).join("-");
	}
}

/**
 * ToolChain - Visualizes tool execution chains with connecting lines
 *
 * This component groups related tools and displays them as a vertical timeline
 * with visual connectors, making it easy to understand the execution flow.
 *
 * IMPORTANT: Returns null for single completed tools to let specialized
 * visualizers (SearchResults, Weather, etc.) handle them. This component
 * is primarily for multi-step tool chains or in-progress tools.
 */
export const ToolChain = memo(
	({ className, tools, ...props }: ToolChainProps) => {
		// Filter out tools that should be handled by specialized visualizers
		// These are completed tools with custom UI components
		const toolsNeedingChain = useMemo(() => {
			return tools.filter((tool) => {
				// Skip tools that are completed and have specialized visualizers
				if (tool.state === "output-available") {
					// These tools have their own beautiful visualizers
					const specializedTools = [
						"tool-web_search", // SearchResults
						"tool-plan", // PlanVisualizer
						"tool-duyet_mcp", // DuyetMCPResults
						"tool-scratchpad", // ScratchpadViewer
						"tool-getWeather", // Weather
						"tool-url_fetch", // UrlFetchPreview
						"tool-createDocument", // DocumentPreview
						"tool-updateDocument", // DocumentPreview
						"tool-requestSuggestions", // DocumentToolResult
					];
					return !specializedTools.includes(tool.type);
				}
				return true;
			});
		}, [tools]);

		const chains = useMemo(
			() => groupToolsIntoChains(toolsNeedingChain),
			[toolsNeedingChain],
		);

		// If no tools need chain visualization, return null
		if (toolsNeedingChain.length === 0) {
			return null;
		}

		// If only one chain with one tool, render as simple tool
		if (chains.length === 1 && chains[0].length === 1) {
			const tool = chains[0][0];
			const widthClass = "w-[min(100%,600px)]";

			return (
				<div className={widthClass}>
					<Tool className="w-full" defaultOpen={true}>
						<ToolHeader state={tool.state} type={tool.type} />
						<ToolContent>
							{tool.state === "input-available" && (
								<ToolInput input={tool.input} />
							)}
						</ToolContent>
					</Tool>
				</div>
			);
		}

		return (
			<div className={cn("space-y-3", className)} {...props}>
				{chains.map((chain, chainIndex) => (
					<div key={`chain-${chainIndex}`} className="relative">
						{/* Chain label for multi-tool chains */}
						{chain.length > 1 && (
							<div className="mb-2 flex items-center gap-2 text-muted-foreground text-xs">
								<div className="h-px flex-1 bg-border" />
								<span className="font-medium uppercase tracking-wide">
									Tool Chain {chainIndex + 1}
								</span>
								<div className="h-px flex-1 bg-border" />
							</div>
						)}

						{/* Chain steps */}
						<div className="space-y-2">
							{chain.map((tool, stepIndex) => {
								const isLastStep = stepIndex === chain.length - 1;
								const isCompleted =
									tool.state === "output-available" ||
									tool.state === "output-error" ||
									tool.state === "output-denied";

								return (
									<div key={`tool-${tool.toolCallId}`} className="relative">
										{/* Vertical connector line */}
										{!isLastStep && (
											<div className="absolute left-[19px] top-8 h-full w-px bg-border" />
										)}

										{/* Tool step */}
										<div className="flex gap-3">
											{/* Status indicator */}
											<div className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-background border">
												{getStateIcon(tool.state)}
											</div>

											{/* Tool content */}
											<div className="min-w-0 flex-1">
												<div className="mb-1.5 flex items-center gap-2">
													<span className="font-medium text-sm">
														{getToolDescription(tool)}
													</span>
													{chain.length > 1 && (
														<Badge
															className="gap-1 text-xs"
															variant="secondary"
														>
															Step {stepIndex + 1} of {chain.length}
														</Badge>
													)}
												</div>

												{!isCompleted && (
													<Tool className="w-full" defaultOpen={true}>
														<ToolHeader
															state={tool.state}
															type={tool.type}
															title={getToolDescription(tool)}
														/>
														<ToolContent>
															{tool.state === "input-available" && (
																<ToolInput input={tool.input} />
															)}
														</ToolContent>
													</Tool>
												)}

												{/* Status text for completed tools */}
												{isCompleted && (
													<div className="text-muted-foreground text-xs">
														{getStateLabel(tool.state)}
													</div>
												)}
											</div>
										</div>

										{/* Arrow connector between steps */}
										{!isLastStep && (
											<div className="ml-[39px] mt-1">
												<ArrowDownIcon className="size-4 text-muted-foreground" />
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				))}
			</div>
		);
	},
);

ToolChain.displayName = "ToolChain";
