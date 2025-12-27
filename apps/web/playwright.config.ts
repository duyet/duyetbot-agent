import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import { config } from "dotenv";

config({
  path: ".env.local",
});

/* Use process.env.PORT by default and fallback to port 3000 */
const PORT = process.env.PORT || 3000;

/**
 * Determine if we're running production tests
 * Set via: PLAYWRIGHT_PROJECT=production or --project=production
 */
const isProductionTest = process.env.PLAYWRIGHT_PROJECT === "production";

/**
 * Production URL for remote testing
 */
const PRODUCTION_URL =
  process.env.PRODUCTION_URL || "https://duyetbot-web.duyet.workers.dev";

/**
 * Set webServer.url and use.baseURL with the location
 * of the WebServer respecting the correct set port
 */
const baseURL = isProductionTest ? PRODUCTION_URL : `http://localhost:${PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: 0,
  /* Limit workers to prevent browser crashes */
  workers: process.env.CI ? 2 : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "retain-on-failure",
  },

  /* Configure global timeout for each test */
  timeout: 240 * 1000, // 4 minutes
  expect: {
    timeout: 240 * 1000,
  },

  /* Configure projects */
  projects: [
    {
      name: "e2e",
      testMatch: /e2e\/.*.test.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },

    // Production testing project - runs against deployed production URL
    {
      name: "production",
      testMatch: /e2e\/production-health\.test\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: PRODUCTION_URL,
      },
    },
  ],

  /* Run your local dev server before starting the tests - ONLY for local e2e tests */
  webServer: isProductionTest
    ? undefined
    : {
        command: "bun dev",
        url: `http://localhost:${PORT}`,
        timeout: 120 * 1000,
        reuseExistingServer: !process.env.CI,
      },
});
