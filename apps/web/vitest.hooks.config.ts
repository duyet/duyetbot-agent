import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for React hooks testing
 *
 * Uses happy-dom environment to simulate browser DOM for @testing-library/react
 * (happy-dom is more compatible with bun than jsdom)
 */
export default defineConfig({
	resolve: {
		alias: {
			"@": new URL(".", import.meta.url).pathname,
		},
	},
	test: {
		globals: true,
		environment: "happy-dom",
		include: [
			"hooks/**/*.test.ts",
			"hooks/**/*.test.tsx",
			"components/**/*.test.ts",
			"components/**/*.test.tsx",
		],
		setupFiles: ["./tests/setup/hooks-test-setup.ts"],
		testTimeout: 10_000,
		hookTimeout: 10_000,
		teardownTimeout: 5_000,
		isolate: true,
		reporters: ["verbose"],
		// Pool options for better compatibility
		pool: "forks",
		// Coverage
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules/",
				"tests/",
				"*.config.ts",
				".next/",
				"dist/",
				"e2e/",
			],
		},
	},
});
