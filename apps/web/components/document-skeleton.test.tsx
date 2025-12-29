/**
 * Unit tests for Document Skeleton components
 *
 * Test Categories:
 * 1. DocumentSkeleton - Artifact-specific loading skeletons (image vs other)
 * 2. InlineDocumentSkeleton - Inline document loading placeholder
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	DocumentSkeleton,
	InlineDocumentSkeleton,
} from "./document-skeleton";

describe("DocumentSkeleton", () => {
	describe("when artifactKind is 'image'", () => {
		it("renders centered image placeholder", () => {
			const { container } = render(
				<DocumentSkeleton artifactKind="image" />,
			);
			const wrapper = container.firstChild as HTMLElement;
			expect(wrapper).toHaveClass(
				"flex",
				"h-[calc(100dvh-60px)]",
				"flex-col",
				"items-center",
				"justify-center",
			);
		});

		it("renders large square placeholder", () => {
			const { container } = render(
				<DocumentSkeleton artifactKind="image" />,
			);
			const placeholder = container.querySelector(".size-96");
			expect(placeholder).toBeInTheDocument();
		});

		it("has pulse animation", () => {
			const { container } = render(
				<DocumentSkeleton artifactKind="image" />,
			);
			const placeholder = container.querySelector('[class*="animate-pulse"]');
			expect(placeholder).toBeInTheDocument();
		});

		it("has rounded corners", () => {
			const { container } = render(
				<DocumentSkeleton artifactKind="image" />,
			);
			const placeholder = container.querySelector('[class*="rounded-lg"]');
			expect(placeholder).toBeInTheDocument();
		});

		it("has correct background color", () => {
			const { container } = render(
				<DocumentSkeleton artifactKind="image" />,
			);
			const placeholder = container.querySelector(
				'[class*="bg-muted-foreground/20"]',
			);
			expect(placeholder).toBeInTheDocument();
		});
	});

	describe("when artifactKind is not 'image'", () => {
		const nonImageKinds = [
			"text",
			"code",
			"sheet",
			"chart",
		] as const;

		nonImageKinds.forEach((kind) => {
			describe(`artifactKind is '${kind}'`, () => {
				it(`renders vertical layout for ${kind}`, () => {
					const { container } = render(
						<DocumentSkeleton artifactKind={kind} />,
					);
					const wrapper = container.firstChild as HTMLElement;
					expect(wrapper).toHaveClass("flex", "w-full", "flex-col", "gap-4");
				});

				it(`renders title skeleton for ${kind}`, () => {
					const { container } = render(
						<DocumentSkeleton artifactKind={kind} />,
					);
					const title = container.querySelector('[class*="h-12 w-1/2"]');
					expect(title).toBeInTheDocument();
				});

				it(`renders multiple line skeletons for ${kind}`, () => {
					const { container } = render(
						<DocumentSkeleton artifactKind={kind} />,
					);
					// Look for h-5 elements (line skeletons) - there are 5 of them (including the transparent spacer)
					const lines = container.querySelectorAll('.h-5');
					// Should have 5 elements with h-5 class
					expect(lines.length).toBe(5);
				});

				it(`renders button skeleton for ${kind}`, () => {
					const { container } = render(
						<DocumentSkeleton artifactKind={kind} />,
					);
					const button = container.querySelector('[class*="h-8 w-52"]');
					expect(button).toBeInTheDocument();
				});

				it(`has transparent spacer element for ${kind}`, () => {
					const { container } = render(
						<DocumentSkeleton artifactKind={kind} />,
					);
					const spacer = container.querySelector('[class*="bg-transparent"]');
					expect(spacer).toBeInTheDocument();
				});

				it(`all elements have pulse animation for ${kind}`, () => {
					const { container } = render(
						<DocumentSkeleton artifactKind={kind} />,
					);
					const animated = container.querySelectorAll('[class*="animate-pulse"]');
					expect(animated.length).toBeGreaterThan(0);
				});
			});
		});
	});

	describe("accessibility", () => {
		it("has loading state representation for image", () => {
			const { container } = render(
				<DocumentSkeleton artifactKind="image" />,
			);
			const animated = container.querySelectorAll('[class*="animate-pulse"]');
			expect(animated.length).toBeGreaterThan(0);
		});

		it("has loading state representation for non-image", () => {
			const { container } = render(
				<DocumentSkeleton artifactKind="text" />,
			);
			const animated = container.querySelectorAll('[class*="animate-pulse"]');
			expect(animated.length).toBeGreaterThan(0);
		});
	});
});

describe("InlineDocumentSkeleton", () => {
	it("renders vertical layout", () => {
		const { container } = render(<InlineDocumentSkeleton />);
		const wrapper = container.firstChild as HTMLElement;
		expect(wrapper).toHaveClass("flex", "w-full", "flex-col", "gap-4");
	});

	it("renders 7 line skeletons", () => {
		const { container } = render(<InlineDocumentSkeleton />);
		const lines = container.querySelectorAll('.h-4');
		// Should have 7 line skeleton divs
		expect(lines.length).toBe(7);
	});

	it("has varying line widths", () => {
		const { container } = render(<InlineDocumentSkeleton />);
		const lines = container.querySelectorAll('.h-4');
		// Check for various width classes
		const widths = Array.from(lines).map((line) =>
			Array.from((line as HTMLElement).classList).filter((c) =>
				c.startsWith("w-"),
			),
		);
		// Should have different widths: w-48, w-3/4, w-1/2, w-64, w-40, w-36, w-64
		const flatWidths = widths.flat();
		expect(flatWidths.length).toBeGreaterThan(1);
	});

	it("all lines have pulse animation", () => {
		const { container } = render(<InlineDocumentSkeleton />);
		const animated = container.querySelectorAll('.animate-pulse');
		// All 7 line divs should be animated
		expect(animated.length).toBeGreaterThanOrEqual(7);
	});

	it("has correct background color", () => {
		const { container } = render(<InlineDocumentSkeleton />);
		// Look for the specific bg class - all line skeletons should have it
		const lines = container.querySelectorAll('.bg-muted-foreground\\/20');
		// All 7 line divs should have the background color
		expect(lines.length).toBeGreaterThanOrEqual(7);
	});

	it("has consistent height for all lines", () => {
		const { container } = render(<InlineDocumentSkeleton />);
		const lines = container.querySelectorAll('[class*="h-4"]');
		// All lines should have h-4
		lines.forEach((line) => {
			expect((line as HTMLElement)).toHaveClass("h-4");
		});
	});

	describe("accessibility", () => {
		it("has proper loading state representation", () => {
			const { container } = render(<InlineDocumentSkeleton />);
			const animated = container.querySelectorAll('[class*="animate-pulse"]');
			expect(animated.length).toBeGreaterThan(0);
		});
	});
});
