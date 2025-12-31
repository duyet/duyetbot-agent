"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MemoryEntry } from "@/lib/chat-memory";
import { getAllMemories } from "@/lib/chat-memory";
import type { SessionHistoryEntry } from "@/lib/session-persistence";
import { getSessionHistory } from "@/lib/session-persistence";
// Popover not used - removed import
import { cn } from "@/lib/utils";
import {
	CalendarIcon,
	ChevronDownIcon,
	FilterIcon,
	SearchIcon,
	TagIcon,
	XIcon,
} from "./icons";

/**
 * Calculate relevance score (0-1)
 * Pure function - moved outside component to avoid recreation on each render
 */
function calculateRelevance(text: string, query: string): number {
	const lowerText = text.toLowerCase();
	const lowerQuery = query.toLowerCase();

	// Exact match
	if (lowerText === lowerQuery) return 1;

	// Contains query
	if (lowerText.includes(lowerQuery)) {
		// Higher score if query appears at start
		if (lowerText.startsWith(lowerQuery)) return 0.9;
		return 0.7;
	}

	// Partial word matches
	const queryWords = lowerQuery.split(/\s+/);
	const matchedWords = queryWords.filter((word) => lowerText.includes(word));
	return matchedWords.length / queryWords.length;
}

/**
 * Search filters
 */
export interface SearchFilters {
	query: string;
	dateRange?: {
		from: Date;
		to: Date;
	};
	tags?: string[];
	minMessages?: number;
	hasMemory?: boolean;
}

/**
 * Search result type
 */
export interface SearchResult {
	type: "session" | "memory";
	session?: SessionHistoryEntry;
	memory?: MemoryEntry;
	relevance: number;
}

/**
 * Advanced chat search component
 *
 * Features:
 * - Full-text search across sessions and memories
 * - Filter by date, tags, message count
 * - Relevance-based ranking
 * - Preview of matched content
 */
export function AdvancedChatSearch() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [filters, setFilters] = useState<SearchFilters>({ query: "" });
	const [results, setResults] = useState<SearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [showFilters, setShowFilters] = useState(false);

	/**
	 * Perform search
	 */
	const performSearch = useCallback(
		async (searchQuery: string, searchFilters?: SearchFilters) => {
			if (!searchQuery.trim()) {
				setResults([]);
				return;
			}

			setIsSearching(true);
			const filtersToUse = searchFilters || filters;

			try {
				// Search sessions
				const sessions = getSessionHistory();
				const sessionResults: SearchResult[] = sessions
					.filter((session) => {
						// Filter by query
						const matchesQuery =
							!searchQuery ||
							session.title.toLowerCase().includes(searchQuery.toLowerCase());

						// Filter by tags
						const matchesTags =
							!filtersToUse.tags ||
							filtersToUse.tags.length === 0 ||
							filtersToUse.tags.some((tag) => session.tags?.includes(tag));

						// Filter by message count
						const matchesMessages =
							!filtersToUse.minMessages ||
							session.messageCount >= filtersToUse.minMessages;

						return matchesQuery && matchesTags && matchesMessages;
					})
					.map((session) => ({
						type: "session" as const,
						session,
						relevance: calculateRelevance(session.title, searchQuery),
					}));

				// Search memories
				const memories = getAllMemories();
				const memoryResults: SearchResult[] = memories
					.filter((memory) => {
						const matchesQuery =
							!searchQuery ||
							memory.content.toLowerCase().includes(searchQuery.toLowerCase());

						const matchesType =
							!filtersToUse.tags ||
							filtersToUse.tags.length === 0 ||
							filtersToUse.tags.includes(memory.type);

						return matchesQuery && matchesType;
					})
					.map((memory) => ({
						type: "memory" as const,
						memory,
						relevance: calculateRelevance(memory.content, searchQuery),
					}));

				// Combine and sort by relevance
				const combined = [...sessionResults, ...memoryResults].sort(
					(a, b) => b.relevance - a.relevance,
				);

				setResults(combined.slice(0, 50)); // Limit results
			} catch (error) {
				console.error("[AdvancedChatSearch] Search failed:", error);
			} finally {
				setIsSearching(false);
			}
		},
		[filters],
	);

	// Load query from URL
	useEffect(() => {
		const urlQuery = searchParams.get("q");
		if (urlQuery) {
			setQuery(urlQuery);
			setFilters({ query: urlQuery });
			performSearch(urlQuery);
		}
	}, [searchParams, performSearch]);

	/**
	 * Handle search input
	 */
	const handleSearchChange = useCallback(
		(value: string) => {
			setQuery(value);
			if (value.length >= 2 || value.length === 0) {
				performSearch(value);
			}
		},
		[performSearch],
	);

	/**
	 * Handle result click
	 */
	const handleResultClick = useCallback(
		(result: SearchResult) => {
			if (result.type === "session" && result.session) {
				router.push(`/chat/${result.session.chatId}`);
			} else if (result.type === "memory" && result.memory) {
				router.push(`/chat/${result.memory.chatId}`);
			}
			setIsOpen(false);
		},
		[router],
	);

	/**
	 * Clear filters
	 */
	const clearFilters = useCallback(() => {
		setFilters({ query });
		setQuery(query);
		performSearch(query);
	}, [query, performSearch]);

	return (
		<Dialog onOpenChange={setIsOpen} open={isOpen}>
			<DialogTrigger asChild>
				<Button size="icon" title="Search chats" variant="ghost">
					<SearchIcon size={18} />
				</Button>
			</DialogTrigger>

			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>Search Chats & Memories</DialogTitle>
					<DialogDescription>
						Search across all your conversations and saved memories
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Search input */}
					<div className="flex gap-2">
						<div className="relative flex-1">
							<SearchIcon
								className="-translate-y-1/2 absolute top-1/2 left-3 text-muted-foreground"
								size={16}
							/>
							<Input
								autoFocus
								className="pl-10"
								onChange={(e) => handleSearchChange(e.target.value)}
								placeholder="Search conversations, memories, code..."
								value={query}
							/>
						</div>
						<Button
							className={cn("gap-2", showFilters && "bg-accent")}
							onClick={() => setShowFilters(!showFilters)}
							variant="outline"
						>
							<FilterIcon size={14} />
							Filters
							{showFilters && <ChevronDownIcon size={14} />}
						</Button>
					</div>

					{/* Active filters */}
					{(filters.tags?.length || 0) > 0 && (
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-muted-foreground text-sm">
								Active filters:
							</span>
							{filters.tags?.map((tag) => (
								<Badge className="gap-1" key={tag} variant="secondary">
									{tag}
									<button
										className="cursor-pointer"
										onClick={() => {
											const updated = filters.tags?.filter((t) => t !== tag);
											setFilters({ ...filters, tags: updated });
										}}
										type="button"
									>
										<XIcon size={12} />
									</button>
								</Badge>
							))}
							<Button onClick={clearFilters} size="sm" variant="ghost">
								Clear all
							</Button>
						</div>
					)}

					{/* Results */}
					<div className="rounded-lg border">
						{isSearching ? (
							<div className="flex items-center justify-center py-12 text-muted-foreground">
								Searching...
							</div>
						) : results.length === 0 && query ? (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<SearchIcon
									className="mb-4 text-muted-foreground/50"
									size={48}
								/>
								<p className="text-muted-foreground">No results found</p>
								<p className="mt-2 text-muted-foreground text-sm">
									Try different keywords or clear filters
								</p>
							</div>
						) : results.length === 0 && !query ? (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<SearchIcon
									className="mb-4 text-muted-foreground/50"
									size={48}
								/>
								<p className="text-muted-foreground">Start typing to search</p>
								<p className="mt-2 text-muted-foreground text-sm">
									Search across conversations and memories
								</p>
							</div>
						) : (
							<ScrollArea className="h-[400px]">
								<div className="divide-y">
									{results.map((result, index) => (
										<SearchResultItem
											key={`${result.type}-${index}`}
											onClick={() => handleResultClick(result)}
											query={query}
											result={result}
										/>
									))}
								</div>
							</ScrollArea>
						)}
					</div>

					{/* Result count */}
					{results.length > 0 && (
						<div className="text-center text-muted-foreground text-sm">
							Found {results.length} result{results.length !== 1 ? "s" : ""}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Search result item component
 */
interface SearchResultItemProps {
	result: SearchResult;
	query: string;
	onClick: () => void;
}

function SearchResultItem({ result, query, onClick }: SearchResultItemProps) {
	const getIcon = () => {
		if (result.type === "memory") {
			return <TagIcon className="text-blue-500" size={16} />;
		}
		return <CalendarIcon className="text-muted-foreground" size={16} />;
	};

	const getTitle = () => {
		if (result.type === "session") {
			return result.session?.title || "Untitled";
		}
		return result.memory?.type || "Memory";
	};

	const getContent = () => {
		if (result.type === "session") {
			return `${result.session?.messageCount || 0} messages`;
		}
		return result.memory?.content || "";
	};

	const getTimestamp = () => {
		if (result.type === "session") {
			return result.session?.timestamp;
		}
		return result.memory?.timestamp;
	};

	const formatTimestamp = (timestamp: string) => {
		const date = new Date(timestamp);
		return date.toLocaleDateString();
	};

	return (
		<button
			className={cn(
				"flex w-full items-start gap-3 p-3 hover:bg-accent",
				"text-left transition-colors",
			)}
			onClick={onClick}
		>
			<div className="mt-1 flex-shrink-0">{getIcon()}</div>

			<div className="min-w-0 flex-1">
				<p className="truncate font-medium">
					{highlightText(getTitle(), query)}
				</p>
				<p className="truncate text-muted-foreground text-sm">
					{highlightText(getContent(), query)}
				</p>
				{(() => {
					const timestamp = getTimestamp();
					return timestamp ? (
						<p className="mt-1 text-muted-foreground text-xs">
							{formatTimestamp(timestamp)}
						</p>
					) : null;
				})()}
			</div>

			{/* Relevance indicator */}
			<div
				className={cn(
					"h-2 w-2 rounded-full transition-colors",
					result.relevance > 0.8
						? "bg-green-500"
						: result.relevance > 0.5
							? "bg-yellow-500"
							: "bg-gray-400",
				)}
			/>
		</button>
	);
}

/**
 * Highlight text matches
 */
function highlightText(text: string, query: string): string {
	if (!query) return text;

	const regex = new RegExp(
		`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
		"gi",
	);
	return text.replace(regex, "<mark>$1</mark>");
}
