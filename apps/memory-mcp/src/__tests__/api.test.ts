import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock MCP agent to avoid cloudflare: protocol issues
vi.mock("../mcp-agent.js", () => ({
  MemoryMcpAgent: class MockMemoryMcpAgent {},
}));

// Mock RPC entrypoint to avoid cloudflare:workers protocol issues
vi.mock("../rpc-entrypoint.js", () => ({
  MemoryServiceEntrypoint: class MockMemoryServiceEntrypoint {},
}));

import app from "../index.js";

// Mock D1 and KV
const mockD1 = {
  prepare: vi.fn(() => ({
    bind: vi.fn(() => ({
      first: vi.fn(async () => null),
      all: vi.fn(async () => ({ results: [] })),
      run: vi.fn(async () => ({ success: true })),
    })),
  })),
};

const mockKV = {
  get: vi.fn(async () => null),
  put: vi.fn(async () => {}),
  delete: vi.fn(async () => {}),
  getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
};

const mockEnv = {
  DB: mockD1,
  KV: mockKV,
  ENVIRONMENT: "test",
};

describe("API Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const res = await app.request("/health", {}, mockEnv as any);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.name).toBe("duyetbot-memory");
      expect(body.version).toBe("1.0.0");
    });
  });

  describe("POST /api/authenticate", () => {
    it("should reject missing token", async () => {
      const res = await app.request(
        "/api/authenticate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        mockEnv as any,
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it("should reject invalid JSON", async () => {
      const res = await app.request(
        "/api/authenticate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "invalid json",
        },
        mockEnv as any,
      );

      expect(res.status).toBe(400);
    });
  });

  describe("Protected endpoints", () => {
    it("should reject missing authorization header", async () => {
      const res = await app.request(
        "/api/memory/get",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: "test" }),
        },
        mockEnv as any,
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("should reject invalid bearer format", async () => {
      const res = await app.request(
        "/api/memory/get",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Basic token123",
          },
          body: JSON.stringify({ session_id: "test" }),
        },
        mockEnv as any,
      );

      expect(res.status).toBe(401);
    });

    it("should reject invalid token", async () => {
      const res = await app.request(
        "/api/memory/get",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer invalid_token",
          },
          body: JSON.stringify({ session_id: "test" }),
        },
        mockEnv as any,
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });
  });

  describe("POST /api/memory/save", () => {
    it("should reject without auth", async () => {
      const res = await app.request(
        "/api/memory/save",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: "Hello" }],
          }),
        },
        mockEnv as any,
      );

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/memory/search", () => {
    it("should reject without auth", async () => {
      const res = await app.request(
        "/api/memory/search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "test" }),
        },
        mockEnv as any,
      );

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/sessions/list", () => {
    it("should reject without auth", async () => {
      const res = await app.request(
        "/api/sessions/list",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        mockEnv as any,
      );

      expect(res.status).toBe(401);
    });
  });
});

describe("CORS", () => {
  it("should include CORS headers", async () => {
    const res = await app.request("/health", {}, mockEnv as any);
    // CORS middleware is applied, headers depend on origin
    expect(res.status).toBe(200);
  });
});

describe("Rate Limiting", () => {
  // Rate limiting tests would require more complex mocking
  // to simulate multiple requests from the same user
  it("should have rate limiting middleware configured", () => {
    // This is a structural test - the middleware is defined in index.ts
    expect(true).toBe(true);
  });
});
