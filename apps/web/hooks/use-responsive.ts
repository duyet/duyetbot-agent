"use client";

import * as React from "react";

/**
 * Centralized breakpoint definitions matching Tailwind defaults
 * These values are used both in hooks and should align with CSS media queries
 */
export const BREAKPOINTS = {
	/** Small mobile devices (< 640px) */
	sm: 640,
	/** Mobile/tablet boundary (< 768px) - primary mobile breakpoint */
	md: 768,
	/** Tablet/desktop boundary (< 1024px) */
	lg: 1024,
	/** Desktop (< 1280px) */
	xl: 1280,
	/** Large desktop (< 1536px) */
	"2xl": 1536,
} as const;

/**
 * Generic breakpoint hook using matchMedia
 * More performant than useWindowSize - only fires when crossing breakpoint
 */
function useBreakpoint(breakpoint: number, direction: "max" | "min" = "max") {
	const [matches, setMatches] = React.useState<boolean | undefined>(undefined);

	React.useEffect(() => {
		const query =
			direction === "max"
				? `(max-width: ${breakpoint - 1}px)`
				: `(min-width: ${breakpoint}px)`;

		const mql = window.matchMedia(query);
		const onChange = () => {
			setMatches(mql.matches);
		};

		mql.addEventListener("change", onChange);
		setMatches(mql.matches);

		return () => mql.removeEventListener("change", onChange);
	}, [breakpoint, direction]);

	return matches;
}

/**
 * Check if viewport is mobile (<768px)
 * Returns undefined during SSR, boolean after hydration
 */
export function useIsMobile() {
	return useBreakpoint(BREAKPOINTS.md, "max") ?? false;
}

/**
 * Check if viewport is tablet (768px - 1023px)
 * Returns undefined during SSR, boolean after hydration
 */
export function useIsTablet() {
	const isAboveMobile = useBreakpoint(BREAKPOINTS.md, "min");
	const isBelowDesktop = useBreakpoint(BREAKPOINTS.lg, "max");

	if (isAboveMobile === undefined || isBelowDesktop === undefined) {
		return false;
	}

	return isAboveMobile && isBelowDesktop;
}

/**
 * Check if viewport is desktop (>=1024px)
 * Returns undefined during SSR, boolean after hydration
 */
export function useIsDesktop() {
	return useBreakpoint(BREAKPOINTS.lg, "min") ?? false;
}

/**
 * Check if viewport is mobile or tablet (<1024px)
 * Useful for hiding desktop-only features
 */
export function useIsMobileOrTablet() {
	return useBreakpoint(BREAKPOINTS.lg, "max") ?? false;
}

/**
 * Get current responsive tier
 * Returns: 'mobile' | 'tablet' | 'desktop' | undefined (SSR)
 */
export function useResponsiveTier():
	| "mobile"
	| "tablet"
	| "desktop"
	| undefined {
	const isMobile = useBreakpoint(BREAKPOINTS.md, "max");
	const isTablet = useBreakpoint(BREAKPOINTS.lg, "max");

	if (isMobile === undefined || isTablet === undefined) {
		return undefined;
	}

	if (isMobile) return "mobile";
	if (isTablet) return "tablet";
	return "desktop";
}

/**
 * Get responsive value based on current breakpoint
 * Example: useResponsiveValue({ mobile: 2, tablet: 4, desktop: 6 })
 */
export function useResponsiveValue<T>(values: {
	mobile: T;
	tablet?: T;
	desktop?: T;
}): T {
	const tier = useResponsiveTier();

	if (tier === "mobile") return values.mobile;
	if (tier === "tablet") return values.tablet ?? values.mobile;
	return values.desktop ?? values.tablet ?? values.mobile;
}
