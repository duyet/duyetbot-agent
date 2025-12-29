/**
 * Unit tests for PendingIndicator component
 *
 * Test Categories:
 * 1. PendingIndicator - Main pending indicator with position variants
 * 2. MessagePendingIndicator - Inline message-level indicator
 * 3. RollbackWarning - Warning banner for failed operations
 */

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
			render(
				<PendingIndicator
					operations={mockOperations}
				/>,
			);
			expect(screen.getByText("1 operation")).toBeInTheDocument();
		});

		it("pluralizes 'operation' when count > 1", () => {
			const operations: PendingOperation[] = [
				{ id: "1", type: "append", timestamp: Date.now() },
				{ id: "2", type: "update", timestamp: Date.now() },
			];
			render(<PendingIndicator operations={operations} />);
			expect(screen.getByText("2 operations")).toBeInTheDocument();
		});

		it("displays correct operation label", () => {
			const deleteOp: PendingOperation[] = [
				{ id: "1", type: "delete", timestamp: Date.now() },
			];
			render(<PendingIndicator operations={deleteOp} />);
			expect(screen.getByText("Deleting...")).toBeInTheDocument();
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
		render(<MessagePendingIndicator type="update" />);
		expect(screen.getByText("Updating...")).toBeInTheDocument();
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
		render(<RollbackWarning operation={mockOperation} />);
		expect(screen.getByText("Operation failed")).toBeInTheDocument();
	});

	it("shows operation type label", () => {
		render(<RollbackWarning operation={mockOperation} />);
		expect(screen.getByText(/Deleting... failed/)).toBeInTheDocument();
	});

	it("shows rolling back message", () => {
		render(<RollbackWarning operation={mockOperation} />);
		expect(screen.getByText(/Rolling back.../)).toBeInTheDocument();
	});

	it("displays time remaining when provided", () => {
		render(<RollbackWarning operation={mockOperation} timeRemaining={5} />);
		expect(screen.getByText(/Rolling back... 5s/)).toBeInTheDocument();
	});

	it("does not show time when not provided", () => {
		render(<RollbackWarning operation={mockOperation} />);
		// Should show "Rolling back..." without time
		expect(screen.getByText(/Rolling back...\s*$/)).toBeInTheDocument();
	});

	it("shows cancel button when onCancelRollback provided", () => {
		const onCancelRollback = vi.fn();
		render(
			<RollbackWarning
				operation={mockOperation}
				onCancelRollback={onCancelRollback}
			/>,
		);
		const button = screen.getByText("Cancel rollback");
		expect(button).toBeInTheDocument();
	});

	it("calls onCancelRollback when cancel button clicked", () => {
		const onCancelRollback = vi.fn();
		render(
			<RollbackWarning
				operation={mockOperation}
				onCancelRollback={onCancelRollback}
			/>,
		);
		const button = screen.getByText("Cancel rollback");
		button.click();
		expect(onCancelRollback).toHaveBeenCalledTimes(1);
	});

	it("does not show cancel button when handler not provided", () => {
		render(<RollbackWarning operation={mockOperation} />);
		expect(screen.queryByText("Cancel rollback")).not.toBeInTheDocument();
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
