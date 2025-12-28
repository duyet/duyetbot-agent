"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useKeyboardShortcuts } from "@/components/keyboard-shortcuts";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";

interface Command {
	id: string;
	label: string;
	shortcut: string;
	icon?: string;
	action: () => void;
}

/**
 * Command Palette Component
 *
 * Provides quick access to common actions via keyboard shortcut (Cmd/Ctrl + K)
 *
 * Features:
 * - Cross-platform keyboard shortcut (Cmd+K on Mac, Ctrl+K on Windows/Linux)
 * - Fuzzy search through commands
 * - Keyboard navigation (arrow keys, Enter to select, Escape to close)
 */
export function CommandPalette() {
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);

	// Define available commands
	const commands: Command[] = [
		{
			id: "new-chat",
			label: "New Chat",
			shortcut: "N",
			icon: "💬",
			action: () => {
				router.push("/");
				setIsOpen(false);
			},
		},
		{
			id: "toggle-sidebar",
			label: "Toggle Sidebar",
			shortcut: "B",
			icon: "☰",
			action: () => {
				// Trigger sidebar toggle via keyboard
				const sidebarToggle = document.querySelector("[data-sidebar-toggle]");
				if (sidebarToggle instanceof HTMLButtonElement) {
					sidebarToggle.click();
				}
				setIsOpen(false);
			},
		},
		{
			id: "theme-toggle",
			label: "Toggle Theme",
			shortcut: "⇧ ⌘ T",
			icon: "🌓",
			action: () => {
				const themeToggle = document.querySelector("[data-theme-toggle]");
				if (themeToggle instanceof HTMLButtonElement) {
					themeToggle.click();
				}
				setIsOpen(false);
			},
		},
		{
			id: "shortcuts",
			label: "Keyboard Shortcuts",
			shortcut: "?",
			icon: "⌨️",
			action: () => {
				// Trigger keyboard shortcuts dialog
				window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
				setIsOpen(false);
			},
		},
	];

	// Register Cmd/Ctrl+K shortcut to open command palette
	useKeyboardShortcuts(
		[
			{
				key: "k",
				meta: true, // Cmd on Mac, Ctrl on Windows
				description: "Open command palette",
				category: "Navigation",
				action: () => setIsOpen(true),
			},
		],
		true,
	);

	return (
		<CommandDialog open={isOpen} onOpenChange={setIsOpen}>
			<CommandInput placeholder="Type a command or search..." />
			<CommandList>
				<CommandEmpty>No commands found.</CommandEmpty>
				<CommandGroup heading="Actions">
					{commands.map((command) => (
						<CommandItem
							key={command.id}
							onSelect={() => command.action()}
							className="cursor-pointer"
						>
							<span className="mr-2 text-lg">{command.icon}</span>
							<span>{command.label}</span>
							<span className="ml-auto text-muted-foreground text-xs">
								{command.shortcut}
							</span>
						</CommandItem>
					))}
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
}
