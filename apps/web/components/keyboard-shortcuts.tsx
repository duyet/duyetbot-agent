"use client";

import { useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Platform detection for keyboard shortcuts
 * Returns true if the user is on a Mac (Darwin) platform
 */
function isMacPlatform(): boolean {
	if (typeof window === "undefined") return false;
	return (
		navigator.platform.toUpperCase().indexOf("MAC") >= 0 ||
		navigator.userAgent.toUpperCase().indexOf("MAC") >= 0
	);
}

/**
 * Get the platform-appropriate modifier key label
 */
function getModifierKeyLabel(): string {
	return isMacPlatform() ? "⌘" : "Ctrl";
}

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
	key: string;
	description: string;
	category: string;
	ctrl?: boolean;
	shift?: boolean;
	alt?: boolean;
	meta?: boolean; // For Cmd key on Mac
	action?: () => void;
}

/**
 * Available keyboard shortcuts in the application
 */
export const APP_SHORTCUTS: KeyboardShortcut[] = [
	// Navigation
	{
		key: "n",
		ctrl: true,
		description: "New chat",
		category: "Navigation",
	},
	{
		key: "b",
		ctrl: true,
		description: "Toggle sidebar",
		category: "Navigation",
	},
	{
		key: "/",
		description: "Focus chat input",
		category: "Navigation",
	},

	// Chat Controls
	{
		key: "Enter",
		ctrl: true,
		description: "Send message",
		category: "Chat",
	},
	{
		key: "Escape",
		description: "Stop generation / Cancel",
		category: "Chat",
	},
	{
		key: "m",
		ctrl: true,
		description: "Open model selector",
		category: "Chat",
	},
	{
		key: "e",
		ctrl: true,
		description: "Edit last message",
		category: "Chat",
	},
	{
		key: "c",
		ctrl: true,
		shift: true,
		description: "Copy last response",
		category: "Chat",
	},

	// Artifacts
	{
		key: "d",
		ctrl: true,
		shift: true,
		description: "Download artifact",
		category: "Artifacts",
	},
	{
		key: "f",
		ctrl: true,
		shift: true,
		description: "Toggle fullscreen",
		category: "Artifacts",
	},
	{
		key: "p",
		ctrl: true,
		description: "Preview mode",
		category: "Artifacts",
	},
	{
		key: "s",
		ctrl: true,
		description: "Source mode",
		category: "Artifacts",
	},

	// Theme
	{
		key: "t",
		ctrl: true,
		shift: true,
		description: "Toggle dark/light mode",
		category: "Theme",
	},

	// Help
	{
		key: "?",
		description: "Show keyboard shortcuts",
		category: "Help",
	},
];

/**
 * Format keyboard shortcut for display
 * Uses platform-appropriate modifier key labels (⌘ for Mac, Ctrl for Windows/Linux)
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
	const parts: string[] = [];
	const isMac = isMacPlatform();

	// Handle cross-platform modifier keys
	if (shortcut.ctrl && !isMac) parts.push("Ctrl");
	if (shortcut.meta && isMac) parts.push("⌘");
	if (shortcut.meta && !isMac) parts.push("Ctrl");
	if (shortcut.ctrl && isMac) parts.push("⌃"); // Control key on Mac
	if (shortcut.shift) parts.push("Shift");
	if (shortcut.alt) parts.push(isMac ? "⌥" : "Alt");

	parts.push(shortcut.key.toUpperCase());

	return parts.join(isMac ? " " : " + ");
}

/**
 * Check if event matches shortcut
 * Handles cross-platform modifier key matching (meta/Cmd on Mac, ctrl on Windows)
 */
export function matchesShortcut(
	e: KeyboardEvent,
	shortcut: KeyboardShortcut,
): boolean {
	const isMac = isMacPlatform();

	// Match the key
	if (e.key.toLowerCase() !== shortcut.key.toLowerCase()) {
		return false;
	}

	// Handle cross-platform modifier key matching
	// On Mac: meta (Cmd) maps to ctrl in shortcut definitions
	// On Windows/Linux: ctrl maps directly
	const hasMetaOrCtrl = isMac ? e.metaKey : e.ctrlKey;
	const expectsMetaOrCtrl = isMac ? !!shortcut.meta : !!shortcut.ctrl;

	return (
		hasMetaOrCtrl === expectsMetaOrCtrl &&
		!!e.shiftKey === !!shortcut.shift &&
		!!e.altKey === !!shortcut.alt
	);
}

/**
 * Keyboard shortcuts dialog component
 */
export function KeyboardShortcutsDialog() {
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ignore if user is typing in an input/textarea
			const target = e.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.contentEditable === "true"
			) {
				return;
			}

			if (e.key === "?") {
				e.preventDefault();
				setIsOpen((prev) => !prev);
			}
			if (e.key === "Escape") {
				setIsOpen(false);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	// Group shortcuts by category
	const categories = Array.from(new Set(APP_SHORTCUTS.map((s) => s.category)));
	const modifierLabel = getModifierKeyLabel();

	return (
		<Dialog onOpenChange={setIsOpen} open={isOpen}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Keyboard Shortcuts</DialogTitle>
					<DialogDescription>
						Press ? to toggle this dialog. Press {modifierLabel} + key
						combinations to use shortcuts.
					</DialogDescription>
				</DialogHeader>

				<div className="max-h-[60vh] space-y-6 overflow-y-auto">
					{categories.map((category) => (
						<div key={category}>
							<h3 className="mb-3 font-semibold text-muted-foreground text-sm">
								{category}
							</h3>
							<div className="space-y-2">
								{APP_SHORTCUTS.filter((s) => s.category === category).map(
									(shortcut, i) => (
										<div
											className="flex items-center justify-between py-2"
											key={i}
										>
											<span className="text-sm">{shortcut.description}</span>
											<kbd
												className={cn(
													"px-2 py-1 font-semibold text-xs",
													"rounded-md bg-muted",
													"border border-border",
												)}
											>
												{formatShortcut(shortcut)}
											</kbd>
										</div>
									),
								)}
							</div>
						</div>
					))}
				</div>

				<div className="border-t pt-4 text-center text-muted-foreground text-xs">
					Shortcuts work when focus is not in an input field
				</div>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Hook to register custom keyboard shortcuts
 */
export function useKeyboardShortcuts(
	shortcuts: KeyboardShortcut[],
	enabled = true,
) {
	useEffect(() => {
		if (!enabled) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			// Ignore if user is typing in an input/textarea
			const target = e.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.contentEditable === "true"
			) {
				return;
			}

			for (const shortcut of shortcuts) {
				if (matchesShortcut(e, shortcut)) {
					e.preventDefault();
					shortcut.action?.();
					break;
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [shortcuts, enabled]);
}

/**
 * Floating keyboard shortcuts indicator
 */
export function KeyboardShortcutsIndicator() {
	return (
		<button
			className="fixed right-4 bottom-4 z-40 rounded-full border border-border bg-muted/80 px-3 py-1.5 text-muted-foreground text-xs backdrop-blur transition-colors hover:bg-muted hover:text-foreground"
			onClick={() => {
				// Trigger the shortcuts dialog by dispatching an event
				window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
			}}
			title="Press ? for keyboard shortcuts"
		>
			<kbd className="font-semibold">?</kbd> Shortcuts
		</button>
	);
}
