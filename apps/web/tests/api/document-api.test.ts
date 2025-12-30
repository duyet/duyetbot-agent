/**
 * Document API tests
 */
import { describe, expect, it } from "vitest";

const API_URL = process.env.API_URL || "https://duyetbot-web.duyet.workers.dev";

describe("Document API", () => {
	it("GET /api/document requires id parameter (400)", async () => {
		const response = await fetch(`${API_URL}/api/document`);
		// Document endpoint validates id parameter first
		expect(response.status).toBe(400);
	});

	it("GET /api/document returns 401 for valid id without auth", async () => {
		const response = await fetch(
			`${API_URL}/api/document?id=${crypto.randomUUID()}`,
		);
		// Document endpoint requires authentication for valid id
		expect(response.status).toBe(401);
	});
});
