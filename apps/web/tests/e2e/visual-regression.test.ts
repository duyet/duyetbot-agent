/**
 * Visual Regression Tests
 *
 * These tests use Playwright's built-in screenshot comparison to detect
 * unintended visual changes across the application.
 *
 * Run locally:
 *   bun run test:e2e --grep="Visual Regression"
 *
 * Update baselines (when intentional visual changes occur):
 *   bun run test:e2e --grep="Visual Regression" --update-snapshots
 *
 * CI/CD Integration:
 *   - Screenshots are compared against committed baseline images
 *   - Failed tests indicate visual regressions that need review
 *   - Use --update-snapshots to update baselines for approved changes
 */

import { expect, test } from "@playwright/test";

test.describe("Visual Regression - Home Page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		// Wait for page to fully render
		await page.waitForLoadState("networkidle");
	});

	test("home page visual snapshot - desktop", async ({ page }) => {
		// Full page screenshot at desktop viewport
		await expect(page).toHaveScreenshot("home-desktop.png", {
			fullPage: true,
			// Allow minor animation differences
			animations: "allow",
		});
	});

	test("home page visual snapshot - mobile", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto("/");
		await page.waitForLoadState("domcontentloaded");

		await expect(page).toHaveScreenshot("home-mobile.png", {
			fullPage: true,
			animations: "allow",
		});
	});

	test("model selector popover visual snapshot", async ({ page }) => {
		const modelButton = page
			.locator("button")
			.filter({ hasText: /Gemini|Claude|GPT|Grok/i })
			.first();

		await modelButton.click();

		// Wait for popover animation
		await page.waitForTimeout(200);

		// Screenshot of just the model selector
		const searchInput = page.getByPlaceholder(
			"Search models by name or provider...",
		);
		await expect(searchInput).toBeVisible();

		await expect(searchInput).toHaveScreenshot("model-selector.png", {
			animations: "allow",
		});
	});

	test("suggested actions visual snapshot", async ({ page }) => {
		const suggestions = page.locator("[data-testid='suggested-actions']");
		await expect(suggestions).toBeVisible();

		await expect(suggestions).toHaveScreenshot("suggested-actions.png", {
			animations: "allow",
		});
	});
});

test.describe("Visual Regression - Auth Pages", () => {
	test("login page visual snapshot", async ({ page }) => {
		await page.goto("/login");
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("login-page.png", {
			fullPage: true,
			animations: "allow",
		});
	});

	test("register page visual snapshot", async ({ page }) => {
		await page.goto("/register");
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("register-page.png", {
			fullPage: true,
			animations: "allow",
		});
	});
});

test.describe("Visual Regression - Chat Interface", () => {
	test("message input with text visual snapshot", async ({ page }) => {
		await page.goto("/");
		const input = page.getByTestId("multimodal-input");

		await input.fill("Test message for visual regression");

		// Focus the input to show any focus states
		await input.focus();

		await expect(input).toHaveScreenshot("input-with-text.png", {
			animations: "allow",
		});
	});

	test("send button enabled state visual snapshot", async ({ page }) => {
		await page.goto("/");
		const input = page.getByTestId("multimodal-input");
		const sendButton = page.getByTestId("send-button");

		await input.fill("Test message");
		await expect(sendButton).toBeEnabled();

		await expect(sendButton).toHaveScreenshot("send-button-enabled.png", {
			animations: "allow",
		});
	});
});

test.describe("Visual Regression - Dark Mode", () => {
	test.use({ colorScheme: "dark" });

	test("home page dark mode visual snapshot", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("home-dark-mode.png", {
			fullPage: true,
			animations: "allow",
		});
	});

	test("model selector dark mode visual snapshot", async ({ page }) => {
		await page.goto("/");

		const modelButton = page
			.locator("button")
			.filter({ hasText: /Gemini|Claude|GPT|Grok/i })
			.first();

		await modelButton.click();
		await page.waitForTimeout(200);

		const searchInput = page.getByPlaceholder(
			"Search models by name or provider...",
		);
		await expect(searchInput).toBeVisible();

		await expect(searchInput).toHaveScreenshot("model-selector-dark.png", {
			animations: "allow",
		});
	});
});

test.describe("Visual Regression - Component States", () => {
	test("attachments button visual snapshot", async ({ page }) => {
		await page.goto("/");

		const attachmentsButton = page.getByTestId("attachments-button");

		await expect(attachmentsButton).toHaveScreenshot("attachments-button.png", {
			animations: "allow",
		});
	});

	test("input placeholder state visual snapshot", async ({ page }) => {
		await page.goto("/");

		const input = page.getByTestId("multimodal-input");
		await expect(input).toBeVisible();

		// Screenshot with just placeholder
		await expect(input).toHaveScreenshot("input-placeholder.png", {
			animations: "allow",
		});
	});
});

test.describe("Visual Regression - Responsive Breakpoints", () => {
	const viewports = [
		{ name: "mobile", width: 375, height: 667 },
		{ name: "tablet", width: 768, height: 1024 },
		{ name: "laptop", width: 1024, height: 768 },
		{ name: "desktop", width: 1920, height: 1080 },
	];

	for (const viewport of viewports) {
		test(`home page at ${viewport.name} viewport`, async ({ page }) => {
			await page.setViewportSize({
				width: viewport.width,
				height: viewport.height,
			});
			await page.goto("/");
			await page.waitForLoadState("networkidle");

			await expect(page).toHaveScreenshot(
				`home-${viewport.name}-${viewport.width}x${viewport.height}.png`,
				{
					fullPage: true,
					animations: "allow",
				},
			);
		});
	}
});

test.describe("Visual Regression - Production URL", () => {
	test.use({ baseURL: "https://duyetbot-web.duyet.workers.dev" });

	test("production home page matches expected design", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		// Production screenshot with production-specific naming
		await expect(page).toHaveScreenshot("production-home.png", {
			fullPage: true,
			animations: "allow",
		});
	});
});
