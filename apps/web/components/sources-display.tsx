"use client";

import { BookOpenIcon, ExternalLinkIcon, GlobeIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { memo } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * Sources display component for tool-web_search parts.
 *
 * Displays web search results as clickable source links with metadata.
 *
 * Features:
 * - Collapsible view to save space
 * - Source type indicators (web, article, etc.)
 * - Direct links to sources
 * - Source count badge
 * - Streaming support
 */

export type Source = {
	id: string;
	title: string;
	url: string;
	snippet?: string;
	type?: "web" | "article" | "paper" | "documentation";
	publishedDate?: string;
	author?: string;
};

export type SourcesDisplayProps = ComponentProps<typeof Collapsible> & {
	sources: Source[];
	isStreaming?: boolean;
	defaultOpen?: boolean;
};

const sourceTypeIcons = {
	web: GlobeIcon,
	article: BookOpenIcon,
	paper: BookOpenIcon,
	documentation: BookOpenIcon,
};

const sourceTypeLabels = {
	web: "Website",
	article: "Article",
	paper: "Paper",
	documentation: "Docs",
};

export const SourcesDisplay = memo(
	({
		sources,
		isStreaming = false,
		defaultOpen = false,
		className,
		...props
	}: SourcesDisplayProps) => {
		if (sources.length === 0) {
			return null;
		}

		return (
			<Collapsible
				defaultOpen={defaultOpen}
				className={cn("not-prose mb-4", className)}
				data-testid="sources-display"
				{...props}
			>
				<CollapsibleTrigger className="flex items-center gap-2 text-primary text-xs font-medium hover:underline transition-colors">
					<BookOpenIcon className="size-3.5" />
					<span>
						Used {sources.length} source{sources.length !== 1 ? "s" : ""}
					</span>
				</CollapsibleTrigger>
				<CollapsibleContent
					className={cn(
						"mt-2 space-y-2",
						"data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
					)}
				>
					<div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/30 p-2">
						{sources.map((source) => {
							const Icon = sourceTypeIcons[source.type || "web"] || GlobeIcon;
							const typeLabel = sourceTypeLabels[source.type || "web"];

							return (
								<a
									key={source.id}
									href={source.url}
									target="_blank"
									rel="noreferrer noopener"
									className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent hover:text-accent-foreground"
								>
									<Icon className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
									<div className="flex-1 min-w-0">
										<div className="flex items-start justify-between gap-2">
											<div className="flex-1">
												<div className="font-medium text-[11px] leading-tight group-hover:underline">
													{source.title}
												</div>
												{source.snippet && (
													<div className="text-muted-foreground text-[10px] line-clamp-2 mt-0.5">
														{source.snippet}
													</div>
												)}
												<div className="flex items-center gap-2 mt-1">
													{source.type && (
														<span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 bg-muted px-1 rounded">
															{typeLabel}
														</span>
													)}
													{source.publishedDate && (
														<span className="text-[9px] text-muted-foreground/70">
															{source.publishedDate}
														</span>
													)}
												</div>
											</div>
											<ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
										</div>
									</div>
								</a>
							);
						})}
					</div>
				</CollapsibleContent>
			</Collapsible>
		);
	},
);

SourcesDisplay.displayName = "SourcesDisplay";
