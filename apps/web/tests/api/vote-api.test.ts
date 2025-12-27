/**
 * Vote API tests
 */
import { describe, expect, it } from "vitest";

const API_URL = process.env.API_URL || "https://duyetbot-web.duyet.workers.dev";

describe("Vote API", () => {
	it("POST /api/vote route not implemented (404)", async () => {
		const response = await fetch(`${API_URL}/api/vote`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				chatId: crypto.randomUUID(),
				messageId: crypto.randomUUID(),
				value: "up",
			}),
		});

		// Vote endpoint not yet implemented
		expect(response.status).toBe(404);
	});

	it("POST /api/vote rejects invalid vote value", async () => {
		const response = await fetch(`${API_URL}/api/vote`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				chatId: crypto.randomUUID(),
				messageId: crypto.randomUUID(),
				value: "invalid",
			}),
		});

		expect(response.status).toBe(404);
	});
});
