"use client";

import { ExternalLinkIcon, FileTextIcon, LinkIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type UrlFetchData = {
	url: string;
	title: string;
	content: string;
	contentLength: number;
	truncated: boolean;
};

export interface UrlFetchPreviewProps extends ComponentProps<"div"> {
	data: UrlFetchData;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractDomain(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

export function UrlFetchPreview({
	data,
	className,
	...props
}: UrlFetchPreviewProps) {
	const { url, title, content, contentLength, truncated } = data;
	const domain = extractDomain(url);

	return (
		<div className={cn("w-full", className)} {...props}>
			<Card className="border-border/50 shadow-sm">
				<CardHeader className="space-y-2">
					<div className="flex items-start justify-between gap-4">
						<div className="flex-1 space-y-1">
							<CardTitle className="flex items-center gap-2 font-semibold text-base">
								<FileTextIcon className="size-4" />
								{title || "Fetched Content"}
							</CardTitle>
							<CardDescription className="flex items-center gap-2 text-xs">
								<LinkIcon className="size-3" />
								<span className="truncate">{domain}</span>
							</CardDescription>
						</div>
						<Button asChild className="shrink-0" size="sm" variant="outline">
							<a href={url} rel="noopener noreferrer" target="_blank">
								<ExternalLinkIcon className="mr-1 size-3" />
								Open
							</a>
						</Button>
					</div>

					<div className="flex items-center gap-3 text-xs">
						<Badge variant="secondary">{formatBytes(contentLength)}</Badge>
						{truncated && (
							<Badge
								className="border-yellow-500/20 text-yellow-600 dark:text-yellow-400"
								variant="outline"
							>
								Truncated
							</Badge>
						)}
					</div>
				</CardHeader>

				<CardContent>
					<ScrollArea className="h-[300px]">
						<div className="space-y-4">
							{/* Content preview */}
							<div className="rounded-lg border border-border/50 bg-muted/30 p-4">
								<p className="whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
									{content}
								</p>
							</div>

							{truncated && (
								<p className="text-center text-muted-foreground text-xs">
									Content was truncated. Original size:{" "}
									{formatBytes(contentLength)}
								</p>
							)}
						</div>
					</ScrollArea>
				</CardContent>
			</Card>
		</div>
	);
}
