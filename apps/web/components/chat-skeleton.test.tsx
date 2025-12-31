/**
 * Unit tests for Chat Skeleton components
 *
 * Test Categories:
 * 1. ChatSkeleton - Full page loading skeleton
 * 2. MessageSkeleton - Individual message loading skeleton
 * 3. MessagesListSkeleton - Multiple message placeholders
 * 4. SidebarSkeleton - Sidebar loading skeleton
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	ChatSkeleton,
	MessageSkeleton,
	MessagesListSkeleton,
	SidebarSkeleton,
} from "./chat-skeleton";

describe("ChatSkeleton", () => {
	it("renders full page layout", () => {
		const { container } = render(<ChatSkeleton />);
		expect(container.firstChild).toBeInTheDocument();
	});

	it("renders header section with skeleton elements", () => {
		const { container } = render(<ChatSkeleton />);
		const header = container.querySelector("header");
		expect(header).toBeInTheDocument();

		// Should have skeleton elements (h-8 or h-6 with rounded/rounded-full)
		const skeletons = header?.querySelectorAll(
			'[class*="rounded-md"], [class*="rounded-full"]',
		);
		expect(skeletons?.length).toBeGreaterThanOrEqual(4);
	});

	it("renders messages area with greeting skeleton", () => {
		const { container } = render(<ChatSkeleton />);
		// Look for the greeting area (logo/avatar + text placeholders)
		const skeletons = container.querySelectorAll(
			'[class*="rounded-lg"], [class*="rounded-full"]',
		);
		// Should have multiple skeleton elements for greeting
		expect(skeletons.length).toBeGreaterThan(5);
	});

	it("renders suggested actions grid", () => {
		const { container } = render(<ChatSkeleton />);
		const skeletons = container.querySelectorAll('[class*="rounded-lg"]');
		// Grid should have 4 suggestion skeletons
		expect(skeletons.length).toBeGreaterThanOrEqual(4);
	});

	it("renders input area skeleton", () => {
		const { container } = render(<ChatSkeleton />);
		// Should have textarea and toolbar skeletons
		const skeletons = container.querySelectorAll('[class*="rounded"]');
		expect(skeletons.length).toBeGreaterThan(15);
	});

	it("has correct page layout classes", () => {
		const { container } = render(<ChatSkeleton />);
		const wrapper = container.firstChild as HTMLElement;
		expect(wrapper).toHaveClass("flex", "h-dvh", "min-w-0", "flex-col");
	});
});

describe("MessageSkeleton", () => {
	describe("when isUser is false (default, assistant message)", () => {
		it("renders assistant message layout", () => {
			const { container } = render(<MessageSkeleton />);
			const message = container.firstChild as HTMLElement;
			expect(message).toHaveClass("items-start");
		});

		it("has avatar skeleton", () => {
			const { container } = render(<MessageSkeleton />);
			const avatar = container.querySelector('[class*="h-8 w-8"]');
			expect(avatar).toBeInTheDocument();
		});

		it("has message content skeletons", () => {
			const { container } = render(<MessageSkeleton />);
			// Look for content skeletons (they have h-5 or h-16 classes with widths)
			const contentSkeletons = container.querySelectorAll(
				'[class*="h-5"], [class*="h-16"]',
			);
			// Should have 2 content skeletons
			expect(contentSkeletons.length).toBe(2);
		});
	});

	describe("when isUser is true (user message)", () => {
		it("renders user message layout with reversed direction", () => {
			const { container } = render(<MessageSkeleton isUser />);
			const message = container.firstChild as HTMLElement;
			expect(message).toHaveClass("flex-row-reverse");
		});

		it("renders content aligned to end", () => {
			const { container } = render(<MessageSkeleton isUser />);
			const content = container.querySelector('[class*="items-end"]');
			expect(content).toBeInTheDocument();
		});

		it("has different skeleton widths for user messages", () => {
			const { container } = render(<MessageSkeleton isUser />);
			// User messages have w-32 and w-48 widths
			const skeleton32 = container.querySelector('[class*="w-32"]');
			const skeleton48 = container.querySelector('[class*="w-48"]');
			expect(skeleton32).toBeInTheDocument();
			expect(skeleton48).toBeInTheDocument();
		});
	});

	describe("accessibility", () => {
		it("has proper loading state representation", () => {
			const { container } = render(<MessageSkeleton />);
			// Skeleton components should have aria-hidden or loading indicators
			const skeletons = container.querySelectorAll(
				'[class*="animate-pulse"], [class*="skeleton"]',
			);
			expect(skeletons.length).toBeGreaterThan(0);
		});
	});
});

describe("MessagesListSkeleton", () => {
	it("renders default count of 3 messages", () => {
		const { container } = render(<MessagesListSkeleton />);
		const messages = container.querySelectorAll(
			'[class*="flex flex-col gap-6"] > div',
		);
		expect(messages.length).toBe(3);
	});

	it("renders custom count of messages", () => {
		const { container } = render(<MessagesListSkeleton count={5} />);
		const messages = container.querySelectorAll(
			'[class*="flex flex-col gap-6"] > div',
		);
		expect(messages.length).toBe(5);
	});

	it("applies stagger animation to messages", () => {
		const { container } = render(<MessagesListSkeleton count={3} />);
		const messages = container.querySelectorAll(
			'[class*="animate-stagger-fade-in"]',
		);
		expect(messages.length).toBe(3);
	});

	it("alternates between user and assistant messages", () => {
		const { container } = render(<MessagesListSkeleton count={4} />);
		// Look at direct children of the main container
		const mainContainer = container.firstChild as HTMLElement;
		const _messageElements = mainContainer?.querySelector(":scope > div");

		// Get all direct children divs
		const children = Array.from(mainContainer?.children || []);
		expect(children.length).toBe(4);

		// Check that they alternate by looking at the classes of the first child
		const first = children[0] as HTMLElement;
		const second = children[1] as HTMLElement;
		const third = children[2] as HTMLElement;
		const fourth = children[3] as HTMLElement;

		// Even indices (0, 2) are user messages with flex-row-reverse
		expect(
			first.querySelector('[class*="flex-row-reverse"]'),
		).toBeInTheDocument();
		expect(
			third.querySelector('[class*="flex-row-reverse"]'),
		).toBeInTheDocument();
		// Odd indices (1, 3) are assistant messages with items-start
		expect(second.querySelector('[class*="items-start"]')).toBeInTheDocument();
		expect(fourth.querySelector('[class*="items-start"]')).toBeInTheDocument();
	});

	it("wraps messages in container with correct classes", () => {
		const { container } = render(<MessagesListSkeleton />);
		const wrapper = container.firstChild as HTMLElement;
		expect(wrapper).toHaveClass("flex", "flex-col", "gap-6", "p-4");
	});
});

describe("SidebarSkeleton", () => {
	it("renders sidebar layout", () => {
		const { container } = render(<SidebarSkeleton />);
		expect(container.firstChild).toBeInTheDocument();
	});

	it("renders new chat button skeleton", () => {
		const { container } = render(<SidebarSkeleton />);
		const newChatSkeleton = container.querySelector('[class*="h-10 w-full"]');
		expect(newChatSkeleton).toBeInTheDocument();
	});

	it("renders section header skeleton", () => {
		const { container } = render(<SidebarSkeleton />);
		const headerSkeleton = container.querySelector('[class*="h-4 w-16"]');
		expect(headerSkeleton).toBeInTheDocument();
	});

	it("renders 5 chat history item skeletons", () => {
		const { container } = render(<SidebarSkeleton />);
		const historySkeletons = container.querySelectorAll(
			'[class*="h-10 rounded-md"]',
		);
		expect(historySkeletons.length).toBe(5);
	});

	it("applies stagger animation with delays", () => {
		const { container } = render(<SidebarSkeleton />);
		const animatedElements = container.querySelectorAll(
			'[class*="animate-stagger-fade-in"]',
		);
		// All elements should have stagger animation
		expect(animatedElements.length).toBe(7); // 1 new chat + 1 header + 5 items
	});

	it("has variable width for chat history items", () => {
		const { container } = render(<SidebarSkeleton />);
		const historySkeletons = container.querySelectorAll(
			'[class*="h-10 rounded-md"]',
		);
		// Each should have a different random width between 60-100%
		const widths = Array.from(historySkeletons).map(
			(el) => (el as HTMLElement).style.width,
		);
		// Check that we have widths set (they're dynamic so just verify they exist)
		expect(widths.some((w) => w)).toBe(true);
	});

	it("wraps content in container with correct classes", () => {
		const { container } = render(<SidebarSkeleton />);
		const wrapper = container.firstChild as HTMLElement;
		expect(wrapper).toHaveClass("flex", "flex-col", "gap-4", "p-4");
	});
});
