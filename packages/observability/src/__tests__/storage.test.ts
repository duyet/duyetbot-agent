import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObservabilityStorage } from "../storage.js";
import type { ObservabilityEvent } from "../types.js";

// Mock D1 database
function createMockDb() {
  const mockPreparedStatement = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [], success: true }),
  };

  return {
    prepare: vi.fn().mockReturnValue(mockPreparedStatement),
    batch: vi.fn().mockResolvedValue([]),
    _statement: mockPreparedStatement,
  };
}

describe("ObservabilityStorage", () => {
  let storage: ObservabilityStorage;
  let mockDb: ReturnType<typeof createMockDb>;

  const sampleEvent: ObservabilityEvent = {
    eventId: "test-event-123",
    requestId: "req-123",
    appSource: "telegram-webhook",
    eventType: "message",
    userId: "user-456",
    username: "testuser",
    chatId: "chat-789",
    triggeredAt: 1700000000000,
    completedAt: 1700000001000,
    durationMs: 1000,
    status: "success",
    inputText: "Hello world",
    responseText: "Hi there!",
    classification: {
      type: "simple",
      category: "general",
      complexity: "low",
    },
    agents: [
      {
        name: "router",
        type: "agent",
        duration_ms: 50,
        input_tokens: 100,
        output_tokens: 20,
      },
      {
        name: "simple-agent",
        type: "agent",
        duration_ms: 200,
        input_tokens: 500,
        output_tokens: 150,
      },
    ],
    inputTokens: 600,
    outputTokens: 170,
    totalTokens: 770,
    cachedTokens: 0,
    reasoningTokens: 0,
    model: "claude-sonnet-4-20250514",
  };

  beforeEach(() => {
    mockDb = createMockDb();
    storage = new ObservabilityStorage(mockDb);
  });

  describe("writeEvent", () => {
    it("should prepare and execute INSERT statement", async () => {
      await storage.writeEvent(sampleEvent);

      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO observability_events"),
      );
      expect(mockDb._statement.bind).toHaveBeenCalled();
      expect(mockDb._statement.run).toHaveBeenCalled();
    });

    it("should bind all event fields", async () => {
      await storage.writeEvent(sampleEvent);

      const bindCall = mockDb._statement.bind.mock.calls[0];
      expect(bindCall).toContain(sampleEvent.eventId);
      expect(bindCall).toContain(sampleEvent.appSource);
      expect(bindCall).toContain(sampleEvent.eventType);
      expect(bindCall).toContain(sampleEvent.userId);
      expect(bindCall).toContain(sampleEvent.inputTokens);
      expect(bindCall).toContain(sampleEvent.outputTokens);
    });

    it("should serialize agents array to JSON", async () => {
      await storage.writeEvent(sampleEvent);

      const bindCall = mockDb._statement.bind.mock.calls[0];
      const agentsJson = bindCall.find(
        (arg: unknown) =>
          typeof arg === "string" && arg.includes('"name":"router"'),
      );
      expect(agentsJson).toBeDefined();
      expect(JSON.parse(agentsJson as string)).toEqual(sampleEvent.agents);
    });

    it("should handle null optional fields", async () => {
      const minimalEvent: ObservabilityEvent = {
        eventId: "min-event",
        appSource: "github-webhook",
        eventType: "issue_comment",
        triggeredAt: 1700000000000,
        status: "pending",
        agents: [],
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cachedTokens: 0,
        reasoningTokens: 0,
      };

      await storage.writeEvent(minimalEvent);

      const bindCall = mockDb._statement.bind.mock.calls[0];
      // Should have null for optional fields
      expect(bindCall).toContain(null);
    });
  });

  describe("getRecentEvents", () => {
    it("should query with default limit", async () => {
      await storage.getRecentEvents();

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM observability_events"),
      );
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY triggered_at DESC"),
      );
      expect(mockDb._statement.bind).toHaveBeenCalledWith(50);
    });

    it("should query with custom limit", async () => {
      await storage.getRecentEvents(10);

      expect(mockDb._statement.bind).toHaveBeenCalledWith(10);
    });

    it("should parse results into ObservabilityEvent objects", async () => {
      mockDb._statement.all.mockResolvedValueOnce({
        results: [
          {
            id: 1,
            event_id: "test-123",
            request_id: null,
            app_source: "telegram-webhook",
            event_type: "message",
            user_id: "user-1",
            username: "test",
            chat_id: null,
            repo: null,
            triggered_at: 1700000000000,
            completed_at: 1700000001000,
            duration_ms: 1000,
            status: "success",
            error_type: null,
            error_message: null,
            input_text: "Hello",
            response_text: "Hi",
            classification_type: "simple",
            classification_category: "general",
            classification_complexity: "low",
            agents:
              '[{"name":"router","type":"agent","duration_ms":50,"input_tokens":100,"output_tokens":20}]',
            input_tokens: 100,
            output_tokens: 20,
            total_tokens: 120,
            cached_tokens: 0,
            reasoning_tokens: 0,
            model: null,
            metadata: null,
            created_at: 1700000000000,
          },
        ],
        success: true,
      });

      const events = await storage.getRecentEvents();

      expect(events).toHaveLength(1);
      expect(events[0].eventId).toBe("test-123");
      expect(events[0].appSource).toBe("telegram-webhook");
      expect(events[0].agents).toHaveLength(1);
      expect(events[0].agents[0].name).toBe("router");
      expect(events[0].classification).toEqual({
        type: "simple",
        category: "general",
        complexity: "low",
      });
    });
  });

  describe("getEventsBySource", () => {
    it("should filter by app source", async () => {
      await storage.getEventsBySource("telegram-webhook", 25);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE app_source = ?"),
      );
      expect(mockDb._statement.bind).toHaveBeenCalledWith(
        "telegram-webhook",
        25,
      );
    });
  });

  describe("getEventsByUser", () => {
    it("should filter by user ID", async () => {
      await storage.getEventsByUser("user-123", 30);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE user_id = ?"),
      );
      expect(mockDb._statement.bind).toHaveBeenCalledWith("user-123", 30);
    });
  });

  describe("getRecentErrors", () => {
    it("should filter by error status and time", async () => {
      await storage.getRecentErrors(24, 50);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'error'"),
      );
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("triggered_at > ?"),
      );
    });
  });

  describe("getDailyMetrics", () => {
    it("should query daily_metrics view", async () => {
      mockDb._statement.all.mockResolvedValueOnce({
        results: [
          {
            date: "2024-01-15",
            app_source: "telegram-webhook",
            total_events: 100,
            successful: 95,
            failed: 5,
            avg_duration_ms: 250.5,
            total_tokens: 50000,
            input_tokens: 35000,
            output_tokens: 15000,
          },
        ],
        success: true,
      });

      const metrics = await storage.getDailyMetrics(7);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("FROM observability_daily_metrics"),
      );
      expect(metrics).toHaveLength(1);
      expect(metrics[0].date).toBe("2024-01-15");
      expect(metrics[0].totalEvents).toBe(100);
      expect(metrics[0].successful).toBe(95);
    });
  });

  describe("getCategoryStats", () => {
    it("should query category_stats view", async () => {
      mockDb._statement.all.mockResolvedValueOnce({
        results: [
          {
            classification_category: "general",
            total: 50,
            avg_duration_ms: 200,
            total_tokens: 25000,
          },
          {
            classification_category: "code",
            total: 30,
            avg_duration_ms: 400,
            total_tokens: 40000,
          },
        ],
        success: true,
      });

      const stats = await storage.getCategoryStats();

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("FROM observability_category_stats"),
      );
      expect(stats).toHaveLength(2);
      expect(stats[0].classificationCategory).toBe("general");
      expect(stats[1].classificationCategory).toBe("code");
    });
  });

  describe("getTokenUsage", () => {
    it("should aggregate token usage for time range", async () => {
      mockDb._statement.first.mockResolvedValueOnce({
        input_tokens: 10000,
        output_tokens: 3000,
        total_tokens: 13000,
        cached_tokens: 500,
        event_count: 50,
      });

      const usage = await storage.getTokenUsage(1700000000000, 1700100000000);

      expect(usage.inputTokens).toBe(10000);
      expect(usage.outputTokens).toBe(3000);
      expect(usage.totalTokens).toBe(13000);
      expect(usage.cachedTokens).toBe(500);
      expect(usage.eventCount).toBe(50);
    });

    it("should return zeros when no data", async () => {
      mockDb._statement.first.mockResolvedValueOnce(null);

      const usage = await storage.getTokenUsage(1700000000000, 1700100000000);

      expect(usage.inputTokens).toBe(0);
      expect(usage.outputTokens).toBe(0);
      expect(usage.totalTokens).toBe(0);
      expect(usage.eventCount).toBe(0);
    });
  });

  describe("getEventById", () => {
    it("should return event when found", async () => {
      mockDb._statement.first.mockResolvedValueOnce({
        id: 1,
        event_id: "test-123",
        request_id: null,
        app_source: "telegram-webhook",
        event_type: "message",
        user_id: null,
        username: null,
        chat_id: null,
        repo: null,
        triggered_at: 1700000000000,
        completed_at: null,
        duration_ms: null,
        status: "pending",
        error_type: null,
        error_message: null,
        input_text: null,
        response_text: null,
        classification_type: null,
        classification_category: null,
        classification_complexity: null,
        agents: "[]",
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        cached_tokens: 0,
        reasoning_tokens: 0,
        model: null,
        metadata: null,
        created_at: 1700000000000,
      });

      const event = await storage.getEventById("test-123");

      expect(event).not.toBeNull();
      expect(event!.eventId).toBe("test-123");
    });

    it("should return null when not found", async () => {
      mockDb._statement.first.mockResolvedValueOnce(null);

      const event = await storage.getEventById("non-existent");

      expect(event).toBeNull();
    });
  });
});
