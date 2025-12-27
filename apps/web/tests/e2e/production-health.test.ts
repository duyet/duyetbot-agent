/**
 * Production Health Check Tests
 *
 * These tests verify the production deployment is working correctly.
 * Run against production with:
 *   PLAYWRIGHT_TEST_BASE_URL=https://duyetbot-web.duyet.workers.dev npx playwright test production-health
 *
 * These tests are designed to be:
 * - Fast (no AI API calls)
 * - Reliable (testing infrastructure, not AI responses)
 * - Safe to run frequently (monitoring)
 */

import { expect, test } from "@playwright/test";

const PROD_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "https://duyetbot-web.duyet.workers.dev";

test.describe("Production Health Checks", () => {
  test("health endpoint returns 200", async ({ request }) => {
    const response = await request.get(`${PROD_URL}/health`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("healthy");
  });

  test("home page loads successfully", async ({ page }) => {
    await page.goto("/");

    // Check page title or key elements
    await expect(page).toHaveTitle(/Chat|Duyet/i);

    // Input field should be visible
    await expect(page.getByTestId("multimodal-input")).toBeVisible();
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");

    // Should have login form elements
    await expect(page.locator("form")).toBeVisible();
  });

  test("register page loads", async ({ page }) => {
    await page.goto("/register");

    // Should have register form elements
    await expect(page.locator("form")).toBeVisible();
  });

  test("static assets load correctly", async ({ page }) => {
    // Listen for failed requests
    const failedRequests: string[] = [];
    page.on("requestfailed", (request) => {
      failedRequests.push(request.url());
    });

    await page.goto("/");

    // Wait for page to fully load
    await page.waitForLoadState("networkidle");

    // No critical asset failures
    const criticalFailures = failedRequests.filter(
      (url) => url.includes(".js") || url.includes(".css")
    );
    expect(criticalFailures).toHaveLength(0);
  });

  test("API routes return proper CORS headers", async ({ request }) => {
    const response = await request.get(`${PROD_URL}/health`);

    // Check CORS is configured
    const headers = response.headers();
    expect(headers["access-control-allow-origin"]).toBeDefined();
  });
});

test.describe("UI Components Load", () => {
  test("model selector is accessible", async ({ page }) => {
    await page.goto("/");

    // Find model selector button
    const modelButton = page.locator("button").filter({
      hasText: /Gemini|Claude|GPT|Grok|DeepSeek/i
    });
    await expect(modelButton.first()).toBeVisible();
  });

  test("suggested actions are visible on home", async ({ page }) => {
    await page.goto("/");

    const suggestions = page.locator("[data-testid='suggested-actions']");
    await expect(suggestions).toBeVisible();

    // Should have clickable buttons
    const buttons = suggestions.locator("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("send button exists and is initially disabled", async ({ page }) => {
    await page.goto("/");

    const sendButton = page.getByTestId("send-button");
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeDisabled();
  });

  test("attachments button is visible", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("attachments-button")).toBeVisible();
  });
});

test.describe("Guest User Flow", () => {
  test("can start typing without login", async ({ page }) => {
    await page.goto("/");

    const input = page.getByTestId("multimodal-input");
    await input.fill("Test message");

    // Input should accept text
    await expect(input).toHaveValue("Test message");

    // Send button should be enabled
    const sendButton = page.getByTestId("send-button");
    await expect(sendButton).toBeEnabled();
  });
});

test.describe("Performance Checks", () => {
  test("page loads within acceptable time", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const loadTime = Date.now() - startTime;

    // Page should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test("no console errors on page load", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes("favicon") &&
        !error.includes("analytics") &&
        !error.includes("404") && // Ignore 404s for optional assets
        !error.includes("manifest") &&
        !error.includes("Failed to load resource") // Ignore resource loading errors for non-critical assets
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
