"use client";

import { Clock, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SearchResult } from "@/lib/chat-search";
import { cn } from "@/lib/utils";

type ChatSearchBarProps = {
	userId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function ChatSearchBar({
	userId: _userId,
	open,
	onOpenChange,
}: ChatSearchBarProps) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const router = useRouter();

	const searchChats = async (searchQuery: string) => {
		if (!searchQuery.trim()) {
			setResults([]);
			return;
		}

		setIsSearching(true);
		try {
			const response = await fetch(
				`/api/search?q=${encodeURIComponent(searchQuery)}`,
			);
			if (!response.ok) {
				throw new Error("Search failed");
			}
			const searchResults = (await response.json()) as SearchResult[];
			setResults(searchResults);
			setSelectedIndex(0);
		} catch (error) {
			console.error("Search error:", error);
		} finally {
			setIsSearching(false);
		}
	};

	// Debounced search
	useEffect(() => {
		const timeout = setTimeout(() => {
			if (query) {
				searchChats(query);
			} else {
				setResults([]);
			}
		}, 300);

		return () => clearTimeout(timeout);
	}, [query, searchChats]);

	// Keyboard navigation
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (results.length === 0) {
				return;
			}

			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((prev) => (prev + 1) % results.length);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex(
					(prev) => (prev - 1 + results.length) % results.length,
				);
			} else if (e.key === "Enter" && results[selectedIndex]) {
				e.preventDefault();
				router.push(`/chat/${results[selectedIndex].id}`);
				onOpenChange(false);
				setQuery("");
				setResults([]);
			}
		},
		[results, selectedIndex, router, onOpenChange],
	);

	const handleResultClick = (chatId: string) => {
		router.push(`/chat/${chatId}`);
		onOpenChange(false);
		setQuery("");
		setResults([]);
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Search Chats</DialogTitle>
					<DialogDescription>
						Search through your conversations by title or content
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="relative">
						<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
						<Input
							autoFocus
							className="pr-10 pl-10"
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Search chats..."
							value={query}
						/>
						{query && (
							<button
								className="-translate-y-1/2 absolute top-1/2 right-3"
								onClick={() => {
									setQuery("");
									setResults([]);
								}}
							>
								<X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
							</button>
						)}
					</div>

					<div className="max-h-96 overflow-y-auto">
						{isSearching ? (
							<div className="flex items-center justify-center py-8">
								<div className="text-muted-foreground">Searching...</div>
							</div>
						) : results.length > 0 ? (
							<div className="space-y-2">
								{results.map((result, index) => (
									<button
										className={cn(
											"w-full rounded-lg border p-3 text-left transition-all hover:bg-accent",
											selectedIndex === index &&
												"bg-accent ring-1 ring-foreground",
										)}
										key={result.id}
										onClick={() => handleResultClick(result.id)}
									>
										<div className="flex items-start justify-between gap-2">
											<div className="flex-1 space-y-1">
												<div className="flex items-center gap-2">
													<h4 className="font-medium">{result.title}</h4>
													<div className="flex gap-1">
														{result.tags.map((tag) => (
															<span
																className="rounded px-1.5 py-0.5 text-xs"
																key={tag.id}
																style={{
																	backgroundColor: `${tag.color}20`,
																	color: tag.color,
																}}
															>
																{tag.name}
															</span>
														))}
													</div>
												</div>
												{result.snippet && (
													<p className="line-clamp-2 text-muted-foreground text-sm">
														{result.snippet}
													</p>
												)}
												<div className="flex items-center gap-2 text-muted-foreground text-xs">
													<Clock className="h-3 w-3" />
													<span>
														{new Date(result.createdAt).toLocaleDateString()}
													</span>
													{result.matchedMessages > 0 && (
														<>
															<span>•</span>
															<span>
																{result.matchedMessages} matching messages
															</span>
														</>
													)}
												</div>
											</div>
										</div>
									</button>
								))}
							</div>
						) : query ? (
							<div className="py-8 text-center text-muted-foreground">
								No results found for "{query}"
							</div>
						) : (
							<div className="py-8 text-center text-muted-foreground">
								Start typing to search your chats
							</div>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
