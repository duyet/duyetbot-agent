/**
 * Unit tests for TypingIndicator component
 *
 * Test Categories:
 * 1. TypingIndicator - Main component with variants (dots, pulse, wave)
 * 2. CompactTypingIndicator - Compact inline version
 */

import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { CompactTypingIndicator, TypingIndicator } from "./typing-indicator";

describe("TypingIndicator", () => {
	describe("default variant (dots)", () => {
		it("renders three bouncing dots by default", () => {
			const { container } = render(<TypingIndicator />);
			const dots = container.querySelectorAll("span[class*='animate-bounce']");
			expect(dots.length).toBe(3);
		});

		it("renders dots variant when explicitly specified", () => {
			const { container } = render(<TypingIndicator variant="dots" />);
			const dots = container.querySelectorAll("span[class*='animate-bounce']");
			expect(dots.length).toBe(3);
		});

		it("has correct animation delays for dots", () => {
			const { container } = render(<TypingIndicator variant="dots" />);
			const dots = container.querySelectorAll("span[class*='animate-bounce']");

			const dotsArray = Array.from(dots);
			expect(dotsArray[0]).toHaveStyle({ animationDelay: "0ms" });
			expect(dotsArray[1]).toHaveStyle({ animationDelay: "150ms" });
			expect(dotsArray[2]).toHaveStyle({ animationDelay: "300ms" });
		});

		it("has proper aria-label for accessibility", () => {
			const { container } = render(<TypingIndicator />);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toBeInTheDocument();
			expect(indicator).toHaveAttribute("aria-label", "AI is typing");
		});
	});

	describe("pulse variant", () => {
		it("renders three pulsing dots", () => {
			const { container } = render(<TypingIndicator variant="pulse" />);
			const dots = container.querySelectorAll("span[class*='animate-pulse']");
			expect(dots.length).toBe(3);
		});

		it("has correct animation delays for pulse", () => {
			const { container } = render(<TypingIndicator variant="pulse" />);
			const dots = container.querySelectorAll("span[class*='animate-pulse']");

			const dotsArray = Array.from(dots);
			expect(dotsArray[0]).toHaveStyle({ animationDelay: "" });
			expect(dotsArray[1]).toHaveStyle({ animationDelay: "150ms" });
			expect(dotsArray[2]).toHaveStyle({ animationDelay: "300ms" });
		});
	});

	describe("wave variant", () => {
		it("renders three wave bars", () => {
			const { container } = render(<TypingIndicator variant="wave" />);
			const bars = container.querySelectorAll("span[class*='animate-pulse']");
			expect(bars.length).toBe(3);
		});

		it("has correct animation delays for wave bars", () => {
			const { container } = render(<TypingIndicator variant="wave" />);
			const bars = container.querySelectorAll("span[class*='animate-pulse']");

			const barsArray = Array.from(bars);
			expect(barsArray[0]).toHaveStyle({ animationDelay: "0ms" });
			expect(barsArray[1]).toHaveStyle({ animationDelay: "100ms" });
			expect(barsArray[2]).toHaveStyle({ animationDelay: "200ms" });
		});

		it("has custom animation duration for wave", () => {
			const { container } = render(<TypingIndicator variant="wave" />);
			const bars = container.querySelectorAll("span");

			const barsArray = Array.from(bars);
			barsArray.forEach((bar) => {
				expect((bar as HTMLElement).style.animationDuration).toBe("800ms");
			});
		});
	});

	describe("custom className", () => {
		it("applies custom className to container", () => {
			const { container } = render(
				<TypingIndicator className="custom-class" />,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("custom-class");
		});

		it("preserves default classes with custom className", () => {
			const { container } = render(
				<TypingIndicator className="custom-class" />,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("flex");
			expect(indicator).toHaveClass("items-center");
			expect(indicator).toHaveClass("custom-class");
		});
	});

	describe("CompactTypingIndicator", () => {
		it("renders three pinging dots", () => {
			const { container } = render(<CompactTypingIndicator />);
			const dots = container.querySelectorAll("span[class*='animate-ping']");
			expect(dots.length).toBe(3);
		});

		it("has correct animation delays for compact dots", () => {
			const { container } = render(<CompactTypingIndicator />);
			const dots = container.querySelectorAll("span[class*='animate-ping']");

			const dotsArray = Array.from(dots);
			expect(dotsArray[0]).toHaveStyle({ animationDelay: "" });
			expect(dotsArray[1]).toHaveStyle({ animationDelay: "150ms" });
			expect(dotsArray[2]).toHaveStyle({ animationDelay: "300ms" });
		});

		it("has compact dot size", () => {
			const { container } = render(<CompactTypingIndicator />);
			const dots = container.querySelectorAll("span");

			const dotsArray = Array.from(dots);
			dotsArray.forEach((dot) => {
				expect(dot as HTMLElement).toHaveClass("h-1");
				expect(dot as HTMLElement).toHaveClass("w-1");
			});
		});

		it("applies custom className when provided", () => {
			const { container } = render(
				<CompactTypingIndicator className="custom-class" />,
			);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toHaveClass("custom-class");
		});

		it("does not have aria-label (decorative only)", () => {
			const { container } = render(<CompactTypingIndicator />);
			const indicator = container.firstChild as HTMLElement;
			expect(indicator).toBeInTheDocument();
			expect(indicator).not.toHaveAttribute("aria-label");
		});
	});
});
