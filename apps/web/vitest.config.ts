import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest configuration for API and unit tests
 *
 * - API tests: Run directly against production Workers API or local dev server
 * - Unit tests: Run in isolation with mocked dependencies
 * - Component tests: React component tests using jsdom environment
 */
export default defineConfig({
	test: {
		globals: true,
		environment: "happy-dom", // happy-dom for React component tests (Bun compatible)
		include: ["tests/api/**/*.test.ts", "lib/**/*.test.ts", "components/**/*.test.tsx"],
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
		// Setup files for testing-library
		setupFiles: ["./vitest.setup.ts"],
		// Coverage
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: ["node_modules/", "tests/", "*.config.ts", ".next/", "dist/"],
		},
	},
	// Resolve path aliases
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./"),
		},
	},
	// Use automatic JSX runtime (no React import needed)
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react",
	},
});
