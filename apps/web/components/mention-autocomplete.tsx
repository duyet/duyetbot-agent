"use client";

import { ClipboardList, Cloud, Globe, Link, List, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	completeMention,
	detectMentionTrigger,
	filterTools,
	MENTIONABLE_TOOLS,
	type MentionableTool,
	type MentionTrigger,
} from "@/lib/mention-parser";
import { cn } from "@/lib/utils";

/**
 * Get icon component for a tool
 */
function getToolIcon(iconName?: string) {
	switch (iconName) {
		case "search":
			return <Globe className="size-4" />;
		case "link":
			return <Link className="size-4" />;
		case "user":
			return <User className="size-4" />;
		case "list":
			return <List className="size-4" />;
		case "clipboard":
			return <ClipboardList className="size-4" />;
		case "cloud":
			return <Cloud className="size-4" />;
		default:
			return <Globe className="size-4" />;
	}
}

interface MentionAutocompleteProps {
	/** Current input text */
	inputValue: string;
	/** Current cursor position in the input */
	cursorPosition: number;
	/** Callback when a mention is selected */
	onSelect: (newText: string, newCursorPosition: number) => void;
	/** Callback when autocomplete is dismissed */
	onDismiss: () => void;
	/** CSS class for positioning */
	className?: string;
}

/**
 * Mention autocomplete dropdown component
 *
 * Displays a list of tools when user types @
 * Filters as user continues typing
 * Handles keyboard navigation and selection
 */
export function MentionAutocomplete({
	inputValue,
	cursorPosition,
	onSelect,
	onDismiss,
	className,
}: MentionAutocompleteProps) {
	const [trigger, setTrigger] = useState<MentionTrigger | null>(null);
	const [filteredTools, setFilteredTools] = useState<MentionableTool[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);

	// Detect mention trigger and filter tools
	useEffect(() => {
		const detected = detectMentionTrigger(inputValue, cursorPosition);

		if (detected.isActive) {
			const tools = filterTools(detected.query, MENTIONABLE_TOOLS);
			setTrigger(detected);
			setFilteredTools(tools);
			setSelectedIndex(0);
		} else {
			setTrigger(null);
			setFilteredTools([]);
		}
	}, [inputValue, cursorPosition]);

	// Handle tool selection
	const handleSelect = useCallback(
		(tool: MentionableTool) => {
			if (!trigger) return;

			const { newText, newCursorPosition } = completeMention(
				inputValue,
				trigger,
				tool,
			);
			onSelect(newText, newCursorPosition);
		},
		[trigger, inputValue, onSelect],
	);

	// Keyboard navigation
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (!trigger || filteredTools.length === 0) return;

			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setSelectedIndex((prev) =>
						prev < filteredTools.length - 1 ? prev + 1 : 0,
					);
					break;
				case "ArrowUp":
					e.preventDefault();
					setSelectedIndex((prev) =>
						prev > 0 ? prev - 1 : filteredTools.length - 1,
					);
					break;
				case "Enter":
				case "Tab":
					e.preventDefault();
					handleSelect(filteredTools[selectedIndex]);
					break;
				case "Escape":
					e.preventDefault();
					onDismiss();
					break;
			}
		},
		[trigger, filteredTools, selectedIndex, handleSelect, onDismiss],
	);

	// Register keyboard listener
	useEffect(() => {
		if (trigger && filteredTools.length > 0) {
			document.addEventListener("keydown", handleKeyDown);
			return () => document.removeEventListener("keydown", handleKeyDown);
		}
	}, [trigger, filteredTools, handleKeyDown]);

	// Don't render if not triggered or no matches
	if (!trigger || filteredTools.length === 0) {
		return null;
	}

	return (
		<div
			ref={containerRef}
			className={cn(
				"absolute bottom-full left-0 mb-2 w-64",
				"rounded-lg border bg-popover p-1 shadow-lg",
				"animate-in fade-in-0 zoom-in-95",
				className,
			)}
			role="listbox"
			aria-label="Tool suggestions"
		>
			<div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
				Tools
			</div>
			{filteredTools.map((tool, index) => (
				<button
					key={tool.id}
					type="button"
					role="option"
					aria-selected={index === selectedIndex}
					className={cn(
						"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
						"hover:bg-accent hover:text-accent-foreground",
						"focus:bg-accent focus:text-accent-foreground focus:outline-none",
						index === selectedIndex && "bg-accent text-accent-foreground",
					)}
					onClick={() => handleSelect(tool)}
					onMouseEnter={() => setSelectedIndex(index)}
				>
					<span className="flex size-6 items-center justify-center rounded-md bg-muted">
						{getToolIcon(tool.icon)}
					</span>
					<div className="flex flex-col items-start">
						<span className="font-medium">@{tool.id}</span>
						<span className="text-xs text-muted-foreground">
							{tool.description}
						</span>
					</div>
				</button>
			))}
			<div className="border-t mt-1 pt-1 px-2 py-1">
				<span className="text-xs text-muted-foreground">
					<kbd className="rounded bg-muted px-1">Tab</kbd> or{" "}
					<kbd className="rounded bg-muted px-1">Enter</kbd> to select
				</span>
			</div>
		</div>
	);
}

/**
 * Hook to manage mention autocomplete state
 */
export function useMentionAutocomplete() {
	const [cursorPosition, setCursorPosition] = useState(0);

	const updateCursorPosition = useCallback(
		(
			e:
				| React.ChangeEvent<HTMLTextAreaElement>
				| React.KeyboardEvent<HTMLTextAreaElement>,
		) => {
			const target = e.target as HTMLTextAreaElement;
			setCursorPosition(target.selectionStart ?? 0);
		},
		[],
	);

	return {
		cursorPosition,
		updateCursorPosition,
		setCursorPosition,
	};
}
