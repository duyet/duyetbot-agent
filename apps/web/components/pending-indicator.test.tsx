/**
 * Unit tests for PendingIndicator component
 *
 * Test Categories:
 * 1. PendingIndicator - Main pending indicator with position variants
 * 2. MessagePendingIndicator - Inline message-level indicator
 * 3. RollbackWarning - Warning banner for failed operations
 *
 * Note: Using container-based queries instead of text queries due to happy-dom + React 19 compatibility issues.
 * Text-based queries (screen.getByText) don't work properly in this environment.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PendingOperation } from "@/hooks/use-optimistic-update";
import {
	PendingIndicator,
	MessagePendingIndicator,
	RollbackWarning,
} from "./pending-indicator";

describe("PendingIndicator", () => {
	const mockOperations: PendingOperation[] = [
		{ id: "1", type: "append", timestamp: Date.now() },
	];

	describe("when there are no operations", () => {
		it("returns null when operations array is empty", () => {
			const { container } = render(
				<PendingIndicator operations={[]} />,
			);
			expect(container.firstChild).toBe(null);
		});
	});

	describe("when there are pending operations", () => {
		it("renders indicator with operation count", () => {
			const { container } = render(
				<PendingIndicator
					operations={mockOperations}
				/>,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toBeInTheDocument();
			expect(indicator.textContent).toContain("1 operation");
		});

		it("pluralizes 'operation' when count > 1", () => {
			const operations: PendingOperation[] = [
				{ id: "1", type: "append", timestamp: Date.now() },
				{ id: "2", type: "update", timestamp: Date.now() },
			];
			const { container } = render(<PendingIndicator operations={operations} />);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toBeInTheDocument();
			expect(indicator.textContent).toContain("2 operations");
		});

		it("displays correct operation label", () => {
			const deleteOp: PendingOperation[] = [
				{ id: "1", type: "delete", timestamp: Date.now() },
			];
			const { container } = render(<PendingIndicator operations={deleteOp} />);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toBeInTheDocument();
			expect(indicator.textContent).toContain("Deleting...");
		});

		it("shows animated spinner", () => {
			const { container } = render(
				<PendingIndicator operations={mockOperations} />,
			);
			const spinner = container.querySelector(".animate-ping");
			expect(spinner).toBeInTheDocument();
		});

		it("has correct position classes for bottom-right (default)", () => {
			const { container } = render(
				<PendingIndicator operations={mockOperations} />,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("bottom-4", "right-4");
		});

		it("has correct position classes for top-right", () => {
			const { container } = render(
				<PendingIndicator
					operations={mockOperations}
					position="top-right"
				/>,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("top-4", "right-4");
		});

		it("has correct position classes for top-left", () => {
			const { container } = render(
				<PendingIndicator
					operations={mockOperations}
					position="top-left"
				/>,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("top-4", "left-4");
		});

		it("has correct position classes for bottom-left", () => {
			const { container } = render(
				<PendingIndicator
					operations={mockOperations}
					position="bottom-left"
				/>,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("bottom-4", "left-4");
		});

		it("applies custom className", () => {
			const { container } = render(
				<PendingIndicator
					operations={mockOperations}
					className="custom-class"
				/>,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("custom-class");
		});

		it("has tooltip with operation details", () => {
			const { container } = render(
				<PendingIndicator operations={mockOperations} />,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveAttribute(
				"title",
				"1 pending operation: Sending...",
			);
		});
	});
});

describe("MessagePendingIndicator", () => {
	it("renders with correct operation type label", () => {
		const { container } = render(<MessagePendingIndicator type="update" />);
		const indicator = container.firstChild as HTMLElement;
		expect(indicator).toBeInTheDocument();
		expect(indicator.textContent).toContain("Updating...");
	});

	it("renders with spinner animation", () => {
		const { container } = render(
			<MessagePendingIndicator type="append" />,
		);
		const spinner = container.querySelector(".animate-ping");
		expect(spinner).toBeInTheDocument();
	});

	it("applies custom className", () => {
		const { container } = render(
			<MessagePendingIndicator
				type="regenerate"
				className="custom-class"
			/>,
		);
		const indicator = container.firstChild as HTMLElement;
		expect(indicator).toHaveClass("custom-class");
	});

	it("has correct styling classes", () => {
		const { container } = render(
			<MessagePendingIndicator type="delete" />,
		);
		const indicator = container.firstChild as HTMLElement;
		expect(indicator).toHaveClass("inline-flex", "items-center", "gap-1.5");
	});
});

describe("RollbackWarning", () => {
	const mockOperation: PendingOperation = {
		id: "1",
		type: "delete",
		timestamp: Date.now(),
	};

	it("renders operation failed message", () => {
		const { container } = render(<RollbackWarning operation={mockOperation} />);
		const warning = container.firstChild as HTMLElement;
		expect(warning).toBeInTheDocument();
		expect(warning.textContent).toContain("Operation failed");
	});

	it("shows operation type label", () => {
		const { container } = render(<RollbackWarning operation={mockOperation} />);
		const warning = container.firstChild as HTMLElement;
		expect(warning.textContent).toContain("Deleting... failed");
	});

	it("shows rolling back message", () => {
		const { container } = render(<RollbackWarning operation={mockOperation} />);
		const warning = container.firstChild as HTMLElement;
		expect(warning.textContent).toContain("Rolling back...");
	});

	it("displays time remaining when provided", () => {
		const { container } = render(<RollbackWarning operation={mockOperation} timeRemaining={5} />);
		const warning = container.firstChild as HTMLElement;
		expect(warning.textContent).toContain("Rolling back...");
		expect(warning.textContent).toContain("5s");
	});

	it("does not show time when not provided", () => {
		const { container } = render(<RollbackWarning operation={mockOperation} />);
		const warning = container.firstChild as HTMLElement;
		expect(warning.textContent).toContain("Rolling back...");
	});

	it("shows cancel button when onCancelRollback provided", () => {
		const onCancelRollback = vi.fn();
		const { container } = render(
			<RollbackWarning
				operation={mockOperation}
				onCancelRollback={onCancelRollback}
			/>,
		);
		const button = container.querySelector("button");
		expect(button).toBeInTheDocument();
		expect(button?.textContent).toContain("Cancel rollback");
	});

	it("calls onCancelRollback when cancel button clicked", () => {
		const onCancelRollback = vi.fn();
		const { container } = render(
			<RollbackWarning
				operation={mockOperation}
				onCancelRollback={onCancelRollback}
			/>,
		);
		const button = container.querySelector("button");
		expect(button).toBeInTheDocument();
		button?.click();
		expect(onCancelRollback).toHaveBeenCalledTimes(1);
	});

	it("does not show cancel button when handler not provided", () => {
		const { container } = render(<RollbackWarning operation={mockOperation} />);
		const button = container.querySelector("button");
		expect(button).not.toBeInTheDocument();
	});

	it("has correct warning styling", () => {
		const { container } = render(
			<RollbackWarning operation={mockOperation} />,
		);
		const warning = container.firstChild as HTMLElement;
		expect(warning).toHaveClass("border-amber-500/30", "bg-amber-500/10");
	});

	it("applies custom className", () => {
		const { container } = render(
			<RollbackWarning
				operation={mockOperation}
				className="custom-class"
			/>,
		);
		const warning = container.firstChild as HTMLElement;
		expect(warning).toHaveClass("custom-class");
	});
});
