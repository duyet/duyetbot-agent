import type { Page } from "@playwright/test";

const MODEL_BUTTON_REGEX = /Gemini|Claude|GPT|Grok/i;
const CHAT_URL_REGEX = /\/chat\/[\w-]+/;

/**
 * Page Object Model for Chat Interface
 * Provides reusable methods for interacting with the chat UI
 */
export class ChatPage {
	page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	// Navigation
	async goto() {
		await this.page.goto("/");
	}

	async createNewChat() {
		await this.page.goto("/");
		await this.page.waitForSelector("[data-testid='multimodal-input']");
	}

	async waitForChatPage() {
		await this.page.waitForURL(CHAT_URL_REGEX);
		await this.page.waitForSelector("[data-testid='multimodal-input']");
	}

	// Input methods
	getInput() {
		return this.page.getByTestId("multimodal-input");
	}

	async typeMessage(message: string) {
		const input = this.getInput();
		await input.fill(message);
	}

	async clearInput() {
		const input = this.getInput();
		await input.fill("");
	}

	async sendMessage() {
		await this.page.getByTestId("send-button").click();
	}

	async sendUserMessage(message: string) {
		await this.typeMessage(message);
		await this.sendMessage();
	}

	async sendMessageByKeyboard() {
		const input = this.getInput();
		await input.press("Enter");
	}

	// Button controls
	getSendButton() {
		return this.page.getByTestId("send-button");
	}

	getStopButton() {
		return this.page.getByTestId("stop-button");
	}

	getAttachmentsButton() {
		return this.page.getByTestId("attachments-button");
	}

	async clickSend() {
		await this.getSendButton().click();
	}

	async clickStop() {
		await this.getStopButton().click();
	}

	async clickAttachments() {
		await this.getAttachmentsButton().click();
	}

	// Suggested actions
	getSuggestedActions() {
		return this.page.locator("[data-testid='suggested-actions'] button");
	}

	async clickSuggestedAction(index = 0) {
		const suggestions = this.getSuggestedActions();
		await suggestions.nth(index).click();
	}

	async clickSuggestedActionByText(text: string) {
		await this.page.getByTestId("suggested-actions").getByText(text).click();
	}

	// Model selection
	async openModelSelector() {
		const modelButton = this.page
			.locator("button")
			.filter({ hasText: MODEL_BUTTON_REGEX })
			.first();
		await modelButton.click();
	}

	async closeModelSelector() {
		await this.page.keyboard.press("Escape");
	}

	async selectModel(modelName: string) {
		await this.openModelSelector();
		await this.page.getByText(modelName).first().click();
	}

	async searchModels(query: string) {
		await this.openModelSelector();
		const searchInput = this.page.getByPlaceholder("Search models...");
		await searchInput.fill(query);
	}

	async getSelectedModelName() {
		const modelButton = this.page
			.locator("button")
			.filter({ hasText: MODEL_BUTTON_REGEX })
			.first();
		return await modelButton.textContent();
	}

	// Message display
	getMessages() {
		return this.page.locator("[data-testid^='message-']");
	}

	getLastMessage() {
		return this.getMessages().last();
	}

	getMessageByText(text: string) {
		return this.page.getByText(text).first();
	}

	async getMessagesCount() {
		return await this.getMessages().count();
	}

	// Visibility selector
	async openVisibilitySelector() {
		await this.page.getByTestId("visibility-selector").click();
	}

	async selectVisibility(type: "public" | "private") {
		await this.openVisibilitySelector();
		await this.page.getByRole("menuitem", { name: type }).click();
	}

	// Attachment handling
	async attachFile(filePath: string) {
		const fileInput = this.page.locator("input[type='file']");
		await fileInput.setInputFiles(filePath);
	}

	getAttachmentsPreview() {
		return this.page.locator("[data-testid='attachments-preview']");
	}

	async removeAttachment(index = 0) {
		const removeButtons = this.page.locator(
			"[data-testid='attachments-preview'] button[aria-label*='Remove']",
		);
		await removeButtons.nth(index).click();
	}

	// Status and state checks
	async isSendButtonDisabled() {
		const button = this.getSendButton();
		return await button.isDisabled();
	}

	async isStopButtonVisible() {
		const button = this.getStopButton();
		return await button.isVisible().catch(() => false);
	}

	async isThinking() {
		return await this.page
			.locator("[data-testid='thinking-message']")
			.isVisible()
			.catch(() => false);
	}

	async waitForResponse(timeout = 30_000) {
		await this.page.waitForSelector("[data-testid='thinking-message']", {
			state: "hidden",
			timeout,
		});
	}

	async waitForMessageCount(count: number, timeout = 30_000) {
		await this.page.waitForFunction(
			(expectedCount) => {
				const messages = document.querySelectorAll("[data-testid^='message-']");
				return messages.length >= expectedCount;
			},
			count,
			{ timeout },
		);
	}

	// URL and routing
	getCurrentChatId() {
		const url = this.page.url();
		const match = url.match(/\/chat\/([\w-]+)/);
		return match ? match[1] : null;
	}

	async waitForUrlChange(timeout = 5000) {
		await this.page.waitForURL(CHAT_URL_REGEX, { timeout });
	}

	// Toast and notifications
	async getToasts() {
		return this.page.locator("[data-sonner-toast]");
	}

	async getLastToast() {
		const toasts = await this.getToasts();
		return toasts.last();
	}

	async waitForToast(timeout = 5000) {
		await this.page.waitForSelector("[data-sonner-toast]", { timeout });
	}

	// Sidebar interactions
	async openSidebar() {
		await this.page.getByTestId("sidebar-toggle").click();
	}

	async closeSidebar() {
		const sidebar = this.page.getByTestId("sidebar");
		if (await sidebar.isVisible()) {
			await this.page.keyboard.press("Escape");
		}
	}

	async getChatHistoryItems() {
		return this.page.locator("[data-testid^='chat-history-item']");
	}

	async clickChatHistoryItem(index = 0) {
		const items = await this.getChatHistoryItems();
		await items.nth(index).click();
	}

	// Helper for debugging
	async takeScreenshot(name: string) {
		await this.page.screenshot({ path: `test-screenshots/${name}.png` });
	}
}
