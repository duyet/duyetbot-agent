import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for API and unit tests
 *
 * - API tests: Run directly against production Workers API or local dev server
 * - Unit tests: Run in isolation with mocked dependencies
 */
export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["tests/api/**/*.test.ts", "lib/**/*.test.ts"],
		testTimeout: 60_000, // 60 seconds for API calls
		hookTimeout: 60_000,
		teardownTimeout: 30_000,
		isolate: false, // Share context between tests for session management
		reporters: ["verbose", "json"],
		outputFile: "./test-results/api-results.json",
		// Use env vars from environment
		env: {
			NODE_ENV: "test",
		},
		// Pool options for better compatibility
		pool: "forks",
		// Note: singleFork is no longer supported in newer vitest versions
		// Coverage
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: ["node_modules/", "tests/", "*.config.ts", ".next/", "dist/"],
		},
	},
});
