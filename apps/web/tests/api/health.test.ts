/**
 * Health check API tests
 */
import { describe, it, expect, beforeAll } from "vitest";

const API_URL = process.env.API_URL || "https://duyetbot-web.duyet.workers.dev";

describe("Health Check API", () => {
  it("GET /health returns 200 with status", async () => {
    const response = await fetch(`${API_URL}/health`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("status", "healthy");
    expect(data).toHaveProperty("timestamp");
  });

  it("health endpoint responds quickly", async () => {
    const start = Date.now();
    await fetch(`${API_URL}/health`);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000); // Should respond within 5 seconds
  });

  it("health returns valid ISO timestamp", async () => {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();

    const timestamp = new Date(data.timestamp);
    expect(timestamp.toISOString()).toBe(data.timestamp);
    expect(Date.now() - timestamp.getTime()).toBeLessThan(60000); // Within last minute
  });
});
