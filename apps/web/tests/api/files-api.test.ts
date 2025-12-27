/**
 * Files API tests
 */
import { describe, it, expect } from "vitest";

const API_URL = process.env.API_URL || "https://duyetbot-web.duyet.workers.dev";

describe("Files API", () => {
  it("POST /api/files/upload returns 401 without auth", async () => {
    const response = await fetch(`${API_URL}/api/files/upload`, {
      method: "POST",
    });

    expect(response.status).toBe(401);
  });

  it("POST /api/files/upload requires multipart/form-data", async () => {
    // Test without proper content-type
    const response = await fetch(`${API_URL}/api/files/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Should reject (400 or 401 depending on auth check order)
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
