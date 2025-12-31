/**
 * Suggestions API tests
 */
import { describe, expect, it } from "vitest";

const API_URL = process.env.API_URL || "https://duyetbot-web.duyet.workers.dev";

describe("Suggestions API", () => {
	it("GET /api/suggestions returns 400 without documentId parameter", async () => {
		const response = await fetch(`${API_URL}/api/suggestions`);
		expect(response.status).toBe(400);
	});

	it("GET /api/suggestions returns 401 with valid documentId but no auth", async () => {
		const response = await fetch(
			`${API_URL}/api/suggestions?documentId=${crypto.randomUUID()}`,
		);
		// With valid documentId, auth is checked next
		expect(response.status).toBe(401);
	});
});
