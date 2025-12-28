/**
 * Setup file for React hooks testing with @testing-library/react
 *
 * This file is imported in hook test files to configure:
 * - jsdom environment for DOM simulation
 * - @testing-library/jest-dom matchers
 * - cleanup after each test
 */

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { expect, vi } from "vitest";

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
	cleanup();
});

// Mock console methods to reduce test noise
global.console = {
	...console,
	// Keep error logging for debugging
	error: vi.fn(console.error),
	warn: vi.fn(console.warn),
	// Silence info/debug in tests
	info: vi.fn(),
	log: vi.fn(),
	debug: vi.fn(),
};

// Mock window.matchMedia for responsive hooks
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
	constructor() {}
	disconnect() {}
	observe() {}
	takeRecords() {
		return [];
	}
	unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
	constructor() {}
	disconnect() {}
	observe() {}
	unobserve() {}
} as any;
