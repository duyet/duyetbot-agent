/**
 * History API tests
 */
import { describe, it, expect } from "vitest";

const API_URL = process.env.API_URL || "https://duyetbot-web.duyet.workers.dev";

describe("History API", () => {
  it("GET /api/history returns 401 without auth", async () => {
    const response = await fetch(`${API_URL}/api/history`);
    expect(response.status).toBe(401);
  });

  it("GET /api/history returns WorkerError format", async () => {
    const response = await fetch(`${API_URL}/api/history`);

    expect(response.status).toBe(401);

    const data = await response.json();
    // WorkerError format uses "code" not "error"
    expect(data).toHaveProperty("code");
  });
});
