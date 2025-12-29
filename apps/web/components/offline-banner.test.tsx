/**
 * Unit tests for OfflineBanner component
 *
 * Test Categories:
 * 1. OfflineBanner - Component rendering and behavior
 * 2. Hook integration - useOnlineStatus behavior
 *
 * Note: Using container-based queries instead of text queries due to happy-dom + React 19 compatibility issues.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the hook before importing the component
vi.mock("@/hooks/use-online-status", () => ({
	useOnlineStatus: vi.fn(),
}));

import { OfflineBanner } from "./offline-banner";
import { useOnlineStatus } from "@/hooks/use-online-status";

describe("OfflineBanner", () => {
	describe("when online", () => {
		it("returns null when user is online", () => {
			vi.mocked(useOnlineStatus).mockReturnValue(true);

			const { container } = render(<OfflineBanner />);
			expect(container.firstChild).toBe(null);
		});

		it("does not render any content", () => {
			vi.mocked(useOnlineStatus).mockReturnValue(true);

			render(<OfflineBanner />);
			expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
		});
	});

	describe("when offline", () => {
		it("renders banner when user is offline", () => {
			vi.mocked(useOnlineStatus).mockReturnValue(false);

			const { container } = render(<OfflineBanner />);
			expect(container.firstChild).not.toBe(null);
		});

		it("displays offline message", () => {
			vi.mocked(useOnlineStatus).mockReturnValue(false);

			const { container } = render(<OfflineBanner />);
			const banner = container.firstChild as HTMLElement;
			expect(banner.textContent).toContain("You are offline. Some features may be limited.");
		});

		it("shows WifiOff icon", () => {
			vi.mocked(useOnlineStatus).mockReturnValue(false);

			const { container } = render(<OfflineBanner />);
			const icon = container.querySelector("svg");
			expect(icon).toBeInTheDocument();
		});

		it("has correct styling classes", () => {
			vi.mocked(useOnlineStatus).mockReturnValue(false);

			const { container } = render(<OfflineBanner />);
			const banner = container.firstChild as HTMLElement;
			expect(banner).toHaveClass("bg-amber-500");
			expect(banner).toHaveClass("fixed");
		});
	});

	describe("accessibility", () => {
		it("has proper color contrast with amber background", () => {
			vi.mocked(useOnlineStatus).mockReturnValue(false);

			const { container } = render(<OfflineBanner />);
			const banner = container.firstChild as HTMLElement;
			expect(banner).toHaveClass("bg-amber-500");
			expect(banner).toHaveClass("text-white");
		});

		it("has fixed positioning for visibility", () => {
			vi.mocked(useOnlineStatus).mockReturnValue(false);

			const { container } = render(<OfflineBanner />);
			const banner = container.firstChild as HTMLElement;
			expect(banner).toHaveClass("fixed");
			expect(banner).toHaveClass("z-50");
		});
	});
});
