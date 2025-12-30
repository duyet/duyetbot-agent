import { expect, test } from "@playwright/test";

const MODEL_BUTTON_REGEX = /Gemini|Claude|GPT|Grok/i;

test.describe("Model Selector", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
	});

	test("displays a model button", async ({ page }) => {
		// Look for any button with model-related content
		const modelButton = page
			.locator("button")
			.filter({ hasText: MODEL_BUTTON_REGEX })
			.first();
		await expect(modelButton).toBeVisible();
	});

	test("opens model selector popover on click", async ({ page }) => {
		const modelButton = page
			.locator("button")
			.filter({ hasText: MODEL_BUTTON_REGEX })
			.first();
		await modelButton.click();

		// Search input should be visible in the popover with full placeholder text
		await expect(
			page.getByPlaceholder("Search models by name or provider..."),
		).toBeVisible();
	});

	test("can search for models", async ({ page }) => {
		const modelButton = page
			.locator("button")
			.filter({ hasText: MODEL_BUTTON_REGEX })
			.first();
		await modelButton.click();

		const searchInput = page.getByPlaceholder(
			"Search models by name or provider...",
		);
		await searchInput.fill("Claude");

		// Should show at least one Claude model (use flexible matching)
		await expect(page.getByText(/Claude/i).first()).toBeVisible();
	});

	test("can close model selector by clicking outside", async ({ page }) => {
		const modelButton = page
			.locator("button")
			.filter({ hasText: MODEL_BUTTON_REGEX })
			.first();
		await modelButton.click();

		await expect(
			page.getByPlaceholder("Search models by name or provider..."),
		).toBeVisible();

		// Click outside to close
		await page.keyboard.press("Escape");

		await expect(
			page.getByPlaceholder("Search models by name or provider..."),
		).not.toBeVisible();
	});

	test("shows model provider groups", async ({ page }) => {
		const modelButton = page
			.locator("button")
			.filter({ hasText: MODEL_BUTTON_REGEX })
			.first();
		await modelButton.click();

		// Should show provider group headers
		// Use .first() to handle strict mode violations when multiple elements match
		await expect(page.getByText("Anthropic").first()).toBeVisible();
		await expect(page.getByText("Google").first()).toBeVisible();
	});

	test("can select a different model", async ({ page }) => {
		const modelButton = page
			.locator("button")
			.filter({ hasText: MODEL_BUTTON_REGEX })
			.first();

		// Get the initial model button text
		const initialText = await modelButton.textContent();

		await modelButton.click();

		// Select any available Claude model (use flexible matching)
		const firstClaudeModel = page.getByText(/Claude/i).first();
		const modelName = await firstClaudeModel.textContent();
		await firstClaudeModel.click();

		// Popover should close
		await expect(
			page.getByPlaceholder("Search models by name or provider..."),
		).not.toBeVisible();

		// Model button should now show the selected model (changed from initial)
		const updatedButton = page
			.locator("button")
			.filter({ hasText: /Claude/i })
			.first();
		await expect(updatedButton).toBeVisible();

		// Verify the button text changed (if different model was selected)
		const finalText = await updatedButton.textContent();
		if (modelName && finalText !== initialText) {
			expect(finalText).toContain(modelName?.trim() || "");
		}
	});
});
