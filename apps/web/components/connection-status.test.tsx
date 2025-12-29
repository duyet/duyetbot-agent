/**
 * Unit tests for ConnectionStatus component
 *
 * Test Categories:
 * 1. ConnectionStatusIndicator - Main indicator with variants
 * 2. mapStatusToConnectionStatus - Status mapping function
 * 3. ConnectionDot - Compact dot indicator
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	ConnectionStatusIndicator,
	mapStatusToConnectionStatus,
	ConnectionDot,
} from "./connection-status";

describe("ConnectionStatusIndicator", () => {
	describe("compact variant (default)", () => {
		it("renders idle status", () => {
			const { container } = render(
				<ConnectionStatusIndicator status="idle" />,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("bg-muted");
			expect(indicator).toHaveAttribute("title", "Ready");
		});

		it("renders connecting status with spinner", () => {
			const { container } = render(
				<ConnectionStatusIndicator status="connecting" />,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("bg-yellow-100");
			expect(indicator).toHaveAttribute("title", "Connecting");
			// Spinner should have animate-spin class
			const spinner = indicator.querySelector("svg");
			expect(spinner).toHaveClass("animate-spin");
		});

		it("renders connected status", () => {
			const { container } = render(
				<ConnectionStatusIndicator status="connected" />,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("bg-green-100");
			expect(indicator).toHaveAttribute("title", "Connected");
		});

		it("renders streaming status", () => {
			const { container } = render(
				<ConnectionStatusIndicator status="streaming" />,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("bg-blue-100");
			expect(indicator).toHaveAttribute("title", "Streaming");
		});

		it("renders error status", () => {
			const { container } = render(
				<ConnectionStatusIndicator status="error" />,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("bg-red-100");
			expect(indicator).toHaveAttribute("title", "Error");
		});

		it("renders offline status", () => {
			const { container } = render(
				<ConnectionStatusIndicator status="offline" />,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("bg-gray-100");
			expect(indicator).toHaveAttribute("title", "Offline");
		});

		it("shows label when showLabel is true", () => {
			render(
				<ConnectionStatusIndicator status="connected" showLabel />,
			);
			expect(screen.getByText("Connected")).toBeInTheDocument();
		});

		it("hides label when showLabel is false (default)", () => {
			render(
				<ConnectionStatusIndicator status="connected" showLabel={false} />,
			);
			expect(screen.queryByText("Connected")).not.toBeInTheDocument();
		});
	});

	describe("full variant", () => {
		it("renders full variant with border", () => {
			const { container } = render(
				<ConnectionStatusIndicator status="connected" variant="full" />,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("border");
			expect(indicator).toHaveClass("border-current/20");
		});

		it("full variant has larger padding than compact", () => {
			const { container: compact } = render(
				<ConnectionStatusIndicator status="connected" variant="compact" />,
			);
			const { container: full } = render(
				<ConnectionStatusIndicator status="connected" variant="full" />,
			);

			const compactEl = compact.firstChild as HTMLElement;
			const fullEl = full.firstChild as HTMLElement;

			// Compact has px-2 py-1, Full has px-3 py-1.5
			expect(compactEl).toHaveClass("px-2", "py-1");
			expect(fullEl).toHaveClass("px-3", "py-1.5");
			// Full should have border that compact doesn't
			expect(fullEl).toHaveClass("border");
			expect(compactEl).not.toHaveClass("border");
		});

		it("applies custom className", () => {
			const { container } = render(
				<ConnectionStatusIndicator
					status="connected"
					className="custom-class"
				/>,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("custom-class");
		});
	});
});

describe("mapStatusToConnectionStatus", () => {
	it("returns offline when isOnline is false", () => {
		expect(mapStatusToConnectionStatus("ready", false)).toBe("offline");
		expect(mapStatusToConnectionStatus("streaming", false)).toBe("offline");
		expect(mapStatusToConnectionStatus(undefined, false)).toBe("offline");
	});

	it("maps streaming status", () => {
		expect(mapStatusToConnectionStatus("streaming", true)).toBe("streaming");
	});

	it("maps submitted and pending to connecting", () => {
		expect(mapStatusToConnectionStatus("submitted", true)).toBe(
			"connecting",
		);
		expect(mapStatusToConnectionStatus("pending", true)).toBe("connecting");
	});

	it("maps error to error", () => {
		expect(mapStatusToConnectionStatus("error", true)).toBe("error");
	});

	it("maps done and ready to connected", () => {
		expect(mapStatusToConnectionStatus("done", true)).toBe("connected");
		expect(mapStatusToConnectionStatus("ready", true)).toBe("connected");
	});

	it("maps undefined to connected (when online)", () => {
		expect(mapStatusToConnectionStatus(undefined, true)).toBe("connected");
	});

	it("handles all valid chat statuses", () => {
		const validStatuses = [
			"pending",
			"streaming",
			"error",
			"submitted",
			"done",
			"ready",
			undefined,
		] as const;

		validStatuses.forEach((status) => {
			const result = mapStatusToConnectionStatus(status, true);
			expect([
				"streaming",
				"connecting",
				"error",
				"connected",
				"idle",
			]).toContain(result);
		});
	});
});

describe("ConnectionDot", () => {
	it("renders dot with label", () => {
		render(<ConnectionDot status="connected" />);
		expect(screen.getByText("Connected")).toBeInTheDocument();
	});

	it("has colored dot for each status", () => {
		const { container: connected } = render(
			<ConnectionDot status="connected" />,
		);
		const { container: error } = render(<ConnectionDot status="error" />);
		const { container: streaming } = render(
			<ConnectionDot status="streaming" />,
		);

		// Check for correct color classes
		const connectedDot = connected.querySelector(".rounded-full");
		const errorDot = error.querySelector(".rounded-full");
		const streamingDot = streaming.querySelector(".rounded-full");

		expect(connectedDot).toHaveClass("bg-green-600");
		expect(errorDot).toHaveClass("bg-red-600");
		expect(streamingDot).toHaveClass("bg-blue-600");
	});

	it("adds animate-pulse for streaming and connecting", () => {
		const { container: streaming } = render(
			<ConnectionDot status="streaming" />,
		);
		const { container: connecting } = render(
			<ConnectionDot status="connecting" />,
		);
		const { container: connected } = render(
			<ConnectionDot status="connected" />,
		);

		const streamingDot = streaming.querySelector(".rounded-full");
		const connectingDot = connecting.querySelector(".rounded-full");
		const connectedDot = connected.querySelector(".rounded-full");

		expect(streamingDot).toHaveClass("animate-pulse");
		expect(connectingDot).toHaveClass("animate-pulse");
		expect(connectedDot).not.toHaveClass("animate-pulse");
	});

	it("renders correct label for each status", () => {
		// Map statuses to their expected labels
		const statusLabels = {
			idle: "Ready",
			connecting: "Connecting",
			connected: "Connected",
			streaming: "Streaming",
			error: "Error",
			offline: "Offline",
		} as const;

		Object.entries(statusLabels).forEach(([status, expectedLabel]) => {
			const { container, unmount } = render(
				<ConnectionDot status={status as keyof typeof statusLabels} />,
			);
			expect(container.textContent).toContain(expectedLabel);
			unmount();
		});
	});
});
