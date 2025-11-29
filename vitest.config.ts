import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/index.ts",
        "vitest.config.ts",
        "wrangler.config.ts",
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
