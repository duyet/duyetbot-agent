/**
 * Unit tests for keyboard-shortcuts component
 *
 * Test Categories:
 * 1. Platform detection (isMacPlatform, getModifierKeyLabel)
 * 2. formatShortcut function
 * 3. matchesShortcut function
 * 4. KeyboardShortcutsDialog component
 * 5. useKeyboardShortcuts hook
 * 6. KeyboardShortcutsIndicator component
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	APP_SHORTCUTS,
	formatShortcut,
	type KeyboardShortcut,
	KeyboardShortcutsDialog,
	KeyboardShortcutsIndicator,
	matchesShortcut,
	useKeyboardShortcuts,
} from "./keyboard-shortcuts";

// Mock shadcn/ui dialog components
vi.mock("@/components/ui/dialog", () => ({
	Dialog: ({ open, onOpenChange, children }: any) => (
		<div data-open={open} data-testid="dialog">
			{open && children}
		</div>
	),
	DialogContent: ({ children, className }: any) => (
		<div className={className} data-testid="dialog-content">
			{children}
		</div>
	),
	DialogDescription: ({ children }: any) => <p>{children}</p>,
	DialogHeader: ({ children }: any) => <div>{children}</div>,
	DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

describe("keyboard-shortcuts - Platform Detection", () => {
	// Note: isMacPlatform and getModifierKeyLabel are internal functions
	// We test platform behavior indirectly through formatShortcut matchesShortcut

	const originalPlatform = Object.getOwnPropertyDescriptor(
		navigator,
		"platform",
	);

	afterEach(() => {
		// Restore original navigator values
		if (originalPlatform)
			Object.defineProperty(navigator, "platform", originalPlatform);
	});

	it("formats differently for Mac vs Windows platforms", () => {
		// Test on Mac
		Object.defineProperty(navigator, "platform", {
			value: "MacIntel",
			writable: true,
		});
		const macFormat = formatShortcut({
			key: "n",
			ctrl: true,
			description: "New",
			category: "Test",
		});
		expect(macFormat).toContain("⌃");

		// Test on Windows
		Object.defineProperty(navigator, "platform", {
			value: "Win32",
			writable: true,
		});
		const windowsFormat = formatShortcut({
			key: "n",
			ctrl: true,
			description: "New",
			category: "Test",
		});
		expect(windowsFormat).toContain("Ctrl");
	});
});

describe("keyboard-shortcuts - formatShortcut", () => {
	const originalPlatform = Object.getOwnPropertyDescriptor(
		navigator,
		"platform",
	);

	afterEach(() => {
		if (originalPlatform)
			Object.defineProperty(navigator, "platform", originalPlatform);
	});

	describe("on Mac platform", () => {
		beforeEach(() => {
			Object.defineProperty(navigator, "platform", {
				value: "MacIntel",
				writable: true,
			});
		});

		it("formats simple key without modifiers", () => {
			const shortcut: KeyboardShortcut = {
				key: "/",
				description: "test",
				category: "Test",
			};
			expect(formatShortcut(shortcut)).toBe("/");
		});

		it("formats Ctrl+key as ⌃ (Control) on Mac", () => {
			const shortcut: KeyboardShortcut = {
				key: "n",
				ctrl: true,
				description: "New",
				category: "Test",
			};
			expect(formatShortcut(shortcut)).toBe("⌃ N");
		});

		it("formats meta (Cmd) key as ⌘ on Mac", () => {
			const shortcut: KeyboardShortcut = {
				key: "n",
				meta: true,
				description: "New",
				category: "Test",
			};
			expect(formatShortcut(shortcut)).toBe("⌘ N");
		});

		it("formats Shift modifier", () => {
			const shortcut: KeyboardShortcut = {
				key: "d",
				ctrl: true,
				shift: true,
				description: "Download",
				category: "Test",
			};
			expect(formatShortcut(shortcut)).toBe("⌃ Shift D");
		});

		it("formats Alt key as ⌥ on Mac", () => {
			const shortcut: KeyboardShortcut = {
				key: "t",
				alt: true,
				description: "Test",
				category: "Test",
			};
			expect(formatShortcut(shortcut)).toBe("⌥ T");
		});

		it("formats all modifiers together", () => {
			const shortcut: KeyboardShortcut = {
				key: "c",
				ctrl: true,
				shift: true,
				alt: true,
				description: "Test",
				category: "Test",
			};
			expect(formatShortcut(shortcut)).toBe("⌃ Shift ⌥ C");
		});
	});

	describe("on Windows/Linux platform", () => {
		beforeEach(() => {
			Object.defineProperty(navigator, "platform", {
				value: "Win32",
				writable: true,
			});
		});

		it("formats simple key without modifiers", () => {
			const shortcut: KeyboardShortcut = {
				key: "/",
				description: "test",
				category: "Test",
			};
			expect(formatShortcut(shortcut)).toBe("/");
		});

		it("formats Ctrl+key on Windows", () => {
			const shortcut: KeyboardShortcut = {
				key: "n",
				ctrl: true,
				description: "New",
				category: "Test",
			};
			expect(formatShortcut(shortcut)).toBe("Ctrl + N");
		});

		it("formats meta as Ctrl on Windows", () => {
			const shortcut: KeyboardShortcut = {
				key: "n",
				meta: true,
				description: "New",
				category: "Test",
			};
			expect(formatShortcut(shortcut)).toBe("Ctrl + N");
		});

		it("formats Shift modifier", () => {
			const shortcut: KeyboardShortcut = {
				key: "d",
				ctrl: true,
				shift: true,
				description: "Download",
				category: "Test",
			};
			expect(formatShortcut(shortcut)).toBe("Ctrl + Shift + D");
		});

		it("formats Alt key", () => {
			const shortcut: KeyboardShortcut = {
				key: "t",
				alt: true,
				description: "Test",
				category: "Test",
			};
			expect(formatShortcut(shortcut)).toBe("Alt + T");
		});
	});
});

describe("keyboard-shortcuts - matchesShortcut", () => {
	const originalPlatform = Object.getOwnPropertyDescriptor(
		navigator,
		"platform",
	);

	afterEach(() => {
		if (originalPlatform)
			Object.defineProperty(navigator, "platform", originalPlatform);
	});

	describe("on Mac platform", () => {
		beforeEach(() => {
			Object.defineProperty(navigator, "platform", {
				value: "MacIntel",
				writable: true,
			});
		});

		it("matches Cmd+N shortcut (meta on Mac)", () => {
			const event = new KeyboardEvent("keydown", { key: "n", metaKey: true });
			const shortcut: KeyboardShortcut = {
				key: "n",
				meta: true, // On Mac, use meta: true
				description: "New",
				category: "Test",
			};
			expect(matchesShortcut(event, shortcut)).toBe(true);
		});

		it("does not match Ctrl+N when meta is expected on Mac", () => {
			const event = new KeyboardEvent("keydown", { key: "n", ctrlKey: true });
			const shortcut: KeyboardShortcut = {
				key: "n",
				meta: true, // On Mac, use meta: true
				description: "New",
				category: "Test",
			};
			expect(matchesShortcut(event, shortcut)).toBe(false);
		});

		it("matches Shift+Meta+N on Mac", () => {
			const event = new KeyboardEvent("keydown", {
				key: "n",
				metaKey: true,
				shiftKey: true,
			});
			const shortcut: KeyboardShortcut = {
				key: "n",
				meta: true, // On Mac, use meta: true
				shift: true,
				description: "Download",
				category: "Test",
			};
			expect(matchesShortcut(event, shortcut)).toBe(true);
		});

		it("matches Alt+key", () => {
			const event = new KeyboardEvent("keydown", { key: "t", altKey: true });
			const shortcut: KeyboardShortcut = {
				key: "t",
				alt: true,
				description: "Test",
				category: "Test",
			};
			expect(matchesShortcut(event, shortcut)).toBe(true);
		});
	});

	describe("on Windows/Linux platform", () => {
		beforeEach(() => {
			Object.defineProperty(navigator, "platform", {
				value: "Win32",
				writable: true,
			});
		});

		it("matches Ctrl+N shortcut", () => {
			const event = new KeyboardEvent("keydown", { key: "n", ctrlKey: true });
			const shortcut: KeyboardShortcut = {
				key: "n",
				ctrl: true,
				description: "New",
				category: "Test",
			};
			expect(matchesShortcut(event, shortcut)).toBe(true);
		});

		it("does not match without required modifier", () => {
			const event = new KeyboardEvent("keydown", { key: "n" });
			const shortcut: KeyboardShortcut = {
				key: "n",
				ctrl: true,
				description: "New",
				category: "Test",
			};
			expect(matchesShortcut(event, shortcut)).toBe(false);
		});

		it("matches Shift+Ctrl+N", () => {
			const event = new KeyboardEvent("keydown", {
				key: "n",
				ctrlKey: true,
				shiftKey: true,
			});
			const shortcut: KeyboardShortcut = {
				key: "n",
				ctrl: true,
				shift: true,
				description: "Download",
				category: "Test",
			};
			expect(matchesShortcut(event, shortcut)).toBe(true);
		});
	});

	it("is case-insensitive for key matching", () => {
		const event = new KeyboardEvent("keydown", { key: "N", ctrlKey: true });
		const shortcut: KeyboardShortcut = {
			key: "n",
			ctrl: true,
			description: "New",
			category: "Test",
		};
		expect(matchesShortcut(event, shortcut)).toBe(true);
	});
});

describe("keyboard-shortcuts - KeyboardShortcutsDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders closed dialog initially", () => {
		render(<KeyboardShortcutsDialog />);
		const dialog = screen.getByTestId("dialog");
		expect(dialog.getAttribute("data-open")).toBe("false");
	});

	it("opens on ? key press", () => {
		render(<KeyboardShortcutsDialog />);
		fireEvent.keyDown(window, { key: "?" });
		const dialog = screen.getByTestId("dialog");
		expect(dialog.getAttribute("data-open")).toBe("true");
	});

	it("closes on Escape key press", () => {
		render(<KeyboardShortcutsDialog />);

		// Open first
		fireEvent.keyDown(window, { key: "?" });
		expect(screen.getByTestId("dialog").getAttribute("data-open")).toBe("true");

		// Close with Escape
		fireEvent.keyDown(window, { key: "Escape" });
		expect(screen.getByTestId("dialog").getAttribute("data-open")).toBe(
			"false",
		);
	});

	it("toggles dialog on repeated ? key press", () => {
		render(<KeyboardShortcutsDialog />);

		// Open
		fireEvent.keyDown(window, { key: "?" });
		expect(screen.getByTestId("dialog").getAttribute("data-open")).toBe("true");

		// Close
		fireEvent.keyDown(window, { key: "?" });
		expect(screen.getByTestId("dialog").getAttribute("data-open")).toBe(
			"false",
		);
	});

	it("does not trigger when typing in input", () => {
		render(
			<>
				<input type="text" data-testid="test-input" />
				<KeyboardShortcutsDialog />
			</>,
		);

		const input = screen.getByTestId("test-input");
		input.focus();
		fireEvent.keyDown(input, { key: "?" });

		// Dialog should remain closed
		expect(screen.getByTestId("dialog").getAttribute("data-open")).toBe(
			"false",
		);
	});

	it("does not trigger when typing in textarea", () => {
		render(
			<>
				<textarea data-testid="test-textarea" />
				<KeyboardShortcutsDialog />
			</>,
		);

		const textarea = screen.getByTestId("test-textarea");
		textarea.focus();
		fireEvent.keyDown(textarea, { key: "?" });

		expect(screen.getByTestId("dialog").getAttribute("data-open")).toBe(
			"false",
		);
	});

	it("groups shortcuts by category when open", () => {
		render(<KeyboardShortcutsDialog />);
		fireEvent.keyDown(window, { key: "?" });

		// Check that all categories are present
		expect(screen.getByText("Navigation")).toBeInTheDocument();
		expect(screen.getByText("Chat")).toBeInTheDocument();
		expect(screen.getByText("Artifacts")).toBeInTheDocument();
		expect(screen.getByText("Theme")).toBeInTheDocument();
		expect(screen.getByText("Help")).toBeInTheDocument();
	});

	it("displays shortcut descriptions", () => {
		render(<KeyboardShortcutsDialog />);
		fireEvent.keyDown(window, { key: "?" });

		// Check some shortcut descriptions are displayed
		expect(screen.getByText("New chat")).toBeInTheDocument();
		expect(screen.getByText("Send message")).toBeInTheDocument();
		expect(screen.getByText("Download artifact")).toBeInTheDocument();
	});

	it("shows platform-specific modifier key label", () => {
		render(<KeyboardShortcutsDialog />);
		fireEvent.keyDown(window, { key: "?" });

		// The dialog description should mention Ctrl/Cmd + key combinations
		// (depending on platform, but we'll just check that the text exists)
		expect(
			screen.getByText(/Press \w+ \+ key combinations/),
		).toBeInTheDocument();
	});

	it("shows hint about shortcuts not working in inputs", () => {
		render(<KeyboardShortcutsDialog />);
		fireEvent.keyDown(window, { key: "?" });

		expect(
			screen.getByText("Shortcuts work when focus is not in an input field"),
		).toBeInTheDocument();
	});

	it("cleans up event listener on unmount", () => {
		const removeSpy = vi.spyOn(window, "removeEventListener");

		const { unmount } = render(<KeyboardShortcutsDialog />);
		unmount();

		// Check that removeEventListener was called for keydown
		expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
	});
});

describe("keyboard-shortcuts - useKeyboardShortcuts hook", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("triggers shortcut action when key is pressed", () => {
		const mockAction = vi.fn();
		const shortcuts: KeyboardShortcut[] = [
			{
				key: "n",
				ctrl: true,
				description: "New",
				category: "Test",
				action: mockAction,
			},
		];

		function TestComponent() {
			useKeyboardShortcuts(shortcuts);
			return <div>Test</div>;
		}

		render(<TestComponent />);

		// Simulate Ctrl+N
		fireEvent.keyDown(window, { key: "n", ctrlKey: true });

		expect(mockAction).toHaveBeenCalledTimes(1);
	});

	it("does not trigger when typing in input", () => {
		const mockAction = vi.fn();
		const shortcuts: KeyboardShortcut[] = [
			{
				key: "n",
				ctrl: true,
				description: "New",
				category: "Test",
				action: mockAction,
			},
		];

		function TestComponent() {
			useKeyboardShortcuts(shortcuts);
			return (
				<div>
					<input type="text" data-testid="input" />
				</div>
			);
		}

		render(<TestComponent />);

		const input = screen.getByTestId("input");
		input.focus();
		fireEvent.keyDown(input, { key: "n", ctrlKey: true });

		expect(mockAction).not.toHaveBeenCalled();
	});

	it("respects enabled flag", () => {
		const mockAction = vi.fn();
		const shortcuts: KeyboardShortcut[] = [
			{
				key: "n",
				ctrl: true,
				description: "New",
				category: "Test",
				action: mockAction,
			},
		];

		function TestComponent() {
			useKeyboardShortcuts(shortcuts, false); // Disabled
			return <div>Test</div>;
		}

		render(<TestComponent />);

		fireEvent.keyDown(window, { key: "n", ctrlKey: true });

		expect(mockAction).not.toHaveBeenCalled();
	});

	it("calls preventDefault on matching shortcut", () => {
		const mockAction = vi.fn();
		const preventDefaultSpy = vi.fn();
		const shortcuts: KeyboardShortcut[] = [
			{
				key: "n",
				ctrl: true,
				description: "New",
				category: "Test",
				action: mockAction,
			},
		];

		function TestComponent() {
			useKeyboardShortcuts(shortcuts);
			return <div>Test</div>;
		}

		render(<TestComponent />);

		// Create a mock event with preventDefault
		const event = new KeyboardEvent("keydown", { key: "n", ctrlKey: true });
		Object.defineProperty(event, "preventDefault", {
			value: preventDefaultSpy,
		});

		fireEvent(window, event);

		expect(preventDefaultSpy).toHaveBeenCalled();
	});

	it("cleans up event listener on unmount", () => {
		const removeSpy = vi.spyOn(window, "removeEventListener");

		const shortcuts: KeyboardShortcut[] = [
			{ key: "n", ctrl: true, description: "New", category: "Test" },
		];

		function TestComponent() {
			useKeyboardShortcuts(shortcuts);
			return <div>Test</div>;
		}

		const { unmount } = render(<TestComponent />);
		unmount();

		expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
	});
});

describe("keyboard-shortcuts - KeyboardShortcutsIndicator", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders indicator button", () => {
		render(<KeyboardShortcutsIndicator />);
		expect(screen.getByText("?")).toBeInTheDocument();
		expect(screen.getByText("Shortcuts")).toBeInTheDocument();
	});

	it("dispatches keyboard event on click", () => {
		const dispatchSpy = vi.spyOn(window, "dispatchEvent");

		render(<KeyboardShortcutsIndicator />);

		const button = screen.getByRole("button");
		fireEvent.click(button);

		expect(dispatchSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "keydown",
				key: "?",
			}),
		);
	});

	it("has correct styling classes", () => {
		const { container } = render(<KeyboardShortcutsIndicator />);
		const button = container.querySelector("button");

		expect(button).toHaveClass(
			"fixed",
			"right-4",
			"bottom-4",
			"z-40",
			"rounded-full",
		);
	});
});

describe("keyboard-shortcuts - APP_SHORTCUTS constant", () => {
	it("has all expected categories", () => {
		const categories = Array.from(
			new Set(APP_SHORTCUTS.map((s) => s.category)),
		);
		expect(categories).toContain("Navigation");
		expect(categories).toContain("Chat");
		expect(categories).toContain("Artifacts");
		expect(categories).toContain("Theme");
		expect(categories).toContain("Help");
	});

	it("has required Navigation shortcuts", () => {
		const navShortcuts = APP_SHORTCUTS.filter(
			(s) => s.category === "Navigation",
		);
		expect(navShortcuts.length).toBeGreaterThanOrEqual(3);

		const keys = navShortcuts.map((s) => s.key.toLowerCase());
		expect(keys).toContain("n");
		expect(keys).toContain("b");
		expect(keys).toContain("/");
	});

	it("has required Chat shortcuts", () => {
		const chatShortcuts = APP_SHORTCUTS.filter((s) => s.category === "Chat");
		expect(chatShortcuts.length).toBeGreaterThanOrEqual(5);

		const keys = chatShortcuts.map((s) => s.key.toLowerCase());
		expect(keys).toContain("enter");
		expect(keys).toContain("escape");
		expect(keys).toContain("m");
	});

	it("has required Artifacts shortcuts", () => {
		const artifactShortcuts = APP_SHORTCUTS.filter(
			(s) => s.category === "Artifacts",
		);
		expect(artifactShortcuts.length).toBeGreaterThanOrEqual(4);
	});

	it("has Theme shortcut", () => {
		const themeShortcuts = APP_SHORTCUTS.filter((s) => s.category === "Theme");
		expect(themeShortcuts.length).toBe(1);
		expect(themeShortcuts[0].key.toLowerCase()).toBe("t");
	});

	it("has Help shortcut", () => {
		const helpShortcuts = APP_SHORTCUTS.filter((s) => s.category === "Help");
		expect(helpShortcuts.length).toBe(1);
		expect(helpShortcuts[0].key).toBe("?");
	});
});
