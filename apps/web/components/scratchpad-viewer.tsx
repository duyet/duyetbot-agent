"use client";

import {
	CheckIcon,
	ClipboardIcon,
	FileTextIcon,
	ListIcon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type ScratchpadData = {
	action: "stored" | "retrieved" | "listed" | "cleared" | "exported";
	// For store
	key?: string;
	size?: number;
	storage?: string;
	// For retrieve
	value?: string;
	createdAt?: string;
	// For list
	count?: number;
	notes?: Array<{ key: string; value: string; createdAt: string }>;
	// For clear
	all?: boolean;
	// For export
	format?: string;
	data?: string;
};

export interface ScratchpadViewerProps extends ComponentProps<"div"> {
	data: ScratchpadData;
}

const actionIcons: Record<string, React.ReactNode> = {
	stored: <PlusIcon className="size-4" />,
	retrieved: <FileTextIcon className="size-4" />,
	listed: <ListIcon className="size-4" />,
	cleared: <TrashIcon className="size-4" />,
	exported: <ClipboardIcon className="size-4" />,
};

const actionTitles: Record<string, string> = {
	stored: "Note Stored",
	retrieved: "Note Retrieved",
	listed: "Notes List",
	cleared: "Notes Cleared",
	exported: "Notes Exported",
};

const actionColors: Record<string, string> = {
	stored: "border-green-500/20 bg-green-500/10",
	retrieved: "border-blue-500/20 bg-blue-500/10",
	listed: "border-gray-500/20 bg-gray-500/10",
	cleared: "border-orange-500/20 bg-orange-500/10",
	exported: "border-purple-500/20 bg-purple-500/10",
};

export function ScratchpadViewer({
	data,
	className,
	...props
}: ScratchpadViewerProps) {
	const { action } = data;
	const icon = actionIcons[action] || <FileTextIcon className="size-4" />;
	const title = actionTitles[action] || "Scratchpad";
	const colorClass = actionColors[action] || "";

	return (
		<div className={cn("w-full", className)} {...props}>
			<Card className="border-border/50 shadow-sm">
				<CardHeader className="space-y-2">
					<div className="flex items-center justify-between gap-4">
						<CardTitle className="flex items-center gap-2 font-semibold text-base">
							{icon}
							{title}
						</CardTitle>
						<Badge className="shrink-0" variant="outline">
							{data.storage || "memory"}
						</Badge>
					</div>
					{data.key && (
						<CardDescription className="font-mono text-xs">
							Key: {data.key}
						</CardDescription>
					)}
				</CardHeader>

				<CardContent>
					{/* Stored */}
					{action === "stored" && (
						<div className={cn("rounded-lg p-4", colorClass)}>
							<div className="flex items-center gap-2">
								<CheckIcon className="size-4 text-green-600 dark:text-green-400" />
								<span className="text-sm">
									Stored {data.size} characters under key "{data.key}"
								</span>
							</div>
						</div>
					)}

					{/* Retrieved */}
					{action === "retrieved" && (
						<div className="space-y-3">
							<div className={cn("rounded-lg p-4", colorClass)}>
								<p className="whitespace-pre-wrap text-sm">{data.value}</p>
							</div>
							{data.createdAt && (
								<p className="text-muted-foreground text-xs">
									Created: {new Date(data.createdAt).toLocaleString()}
								</p>
							)}
						</div>
					)}

					{/* Listed */}
					{action === "listed" && (
						<div className="space-y-3">
							<div className="text-muted-foreground text-sm">
								{data.count === 0
									? "No notes stored"
									: `${data.count} note${data.count === 1 ? "" : "s"} stored`}
							</div>
							{data.notes && data.notes.length > 0 && (
								<ScrollArea className="max-h-[300px]">
									<div className="space-y-2">
										{data.notes.map((note, i) => (
											<div
												className="rounded-lg border border-border/50 bg-muted/30 p-3"
												key={i}
											>
												<div className="flex items-center justify-between gap-2">
													<span className="font-medium font-mono text-foreground text-xs">
														{note.key}
													</span>
													<span className="text-muted-foreground text-xs">
														{new Date(note.createdAt).toLocaleDateString()}
													</span>
												</div>
												<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
													{note.value}
												</p>
											</div>
										))}
									</div>
								</ScrollArea>
							)}
						</div>
					)}

					{/* Cleared */}
					{action === "cleared" && (
						<div className={cn("rounded-lg p-4", colorClass)}>
							<div className="flex items-center gap-2">
								<TrashIcon className="size-4 text-orange-600 dark:text-orange-400" />
								<span className="text-sm">
									{data.all ? "All notes cleared" : `Cleared key "${data.key}"`}
								</span>
							</div>
						</div>
					)}

					{/* Exported */}
					{action === "exported" && (
						<div className="space-y-3">
							<div className={cn("rounded-lg p-4", colorClass)}>
								<span className="text-sm">
									Exported {data.count} note{data.count === 1 ? "" : "s"} as{" "}
									{data.format}
								</span>
							</div>
							{data.data && (
								<pre className="overflow-auto rounded-lg bg-muted p-4 font-mono text-xs">
									{data.data}
								</pre>
							)}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
