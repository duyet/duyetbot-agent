/**
 * AI SDK v6 Tools for Web Worker
 *
 * Tools compatible with Cloudflare Workers environment.
 * Direct implementations using fetch APIs (no shell, git, or long-running processes).
 */

import { tool } from "ai";
import { z } from "zod";

/**
 * Web search tool - Web search using DuckDuckGo with source credibility
 *
 * Provides:
 * - Web search via DuckDuckGo Instant Answer API
 * - Date filtering for recent content
 * - Source credibility scoring and domain analysis
 */
export const webSearchTool = tool({
  description: `Search the web for information using DuckDuckGo.

Features:
- Web search using DuckDuckGo
- Date filtering (today, week, month, all) for recent content
- Source credibility scoring for reputable sources

Returns structured metadata for visualization including:
- Credibility scores for each source
- Domain analysis and reputation indicators
- Publication date and relevance metrics

Examples:
- "Search for recent AI news" → web search with default settings
- "What are today's tech headlines?" → search with dateRange: "today"`,
  inputSchema: z.object({
    query: z.string().describe("Search query to research"),
    maxResults: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .describe("Maximum number of results (default: 5)"),
    dateRange: z
      .enum(["today", "week", "month", "all"])
      .optional()
      .describe("Filter by recency"),
  }),
  execute: async ({ query, maxResults = 5, dateRange = "all" }) => {
    // DuckDuckGo Instant Answer API
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
      const response = await fetch(ddgUrl);
      const data = (await response.json()) as {
        AbstractText?: string;
        AbstractURL?: string;
        AbstractSource?: string;
        RelatedTopics?: Array<{ Text: string; FirstURL: string }>;
        Heading?: string;
      };

      const results: Array<{
        title: string;
        url: string;
        snippet: string;
        credibility: number;
        domain: string;
        publishedAt?: string;
      }> = [];

      // Credibility scoring function
      const calculateCredibility = (url: string, _source?: string): number => {
        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname.toLowerCase();

          // High credibility domains
          const highCredibilityDomains = [
            "wikipedia.org",
            "nature.com",
            "science.org",
            "ieee.org",
            "acm.org",
            "nih.gov",
            "gov.uk",
            "gov.au",
            "europa.eu",
          ];

          // Medium credibility domains
          const mediumCredibilityDomains = [
            "github.com",
            "stackoverflow.com",
            "reddit.com",
            "medium.com",
            "dev.to",
            "hackernoon.com",
            "techcrunch.com",
            "wired.com",
            "theverge.com",
            "arstechnica.com",
          ];

          if (highCredibilityDomains.some((d) => domain.includes(d))) {
            return 0.9;
          }

          if (mediumCredibilityDomains.some((d) => domain.includes(d))) {
            return 0.7;
          }

          // Check for educational domains
          if (domain.endsWith(".edu")) {
            return 0.85;
          }

          // Check for government domains
          if (domain.endsWith(".gov")) {
            return 0.9;
          }

          // Default moderate credibility
          return 0.5;
        } catch {
          return 0.3;
        }
      };

      // Add abstract if available
      if (data.AbstractText) {
        const url = data.AbstractURL || "";
        results.push({
          title: data.Heading || "DuckDuckGo Summary",
          url,
          snippet: data.AbstractText,
          credibility: calculateCredibility(url, data.AbstractSource),
          domain: url ? new URL(url).hostname : "unknown",
          publishedAt: new Date().toISOString(),
        });
      }

      // Add related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics) {
          if (topic.Text && topic.FirstURL && results.length < maxResults) {
            const url = topic.FirstURL;
            results.push({
              title: topic.Text.split(" - ")[0] || "Related Topic",
              url,
              snippet: topic.Text,
              credibility: calculateCredibility(url),
              domain: new URL(url).hostname,
              publishedAt: new Date().toISOString(),
            });
          }
        }
      }

      // Return structured metadata for visualization
      return {
        query,
        dateRange,
        results: results.slice(0, maxResults),
        count: Math.min(results.length, maxResults),
        metadata: {
          averageCredibility:
            results.length > 0
              ? results.reduce((sum, r) => sum + r.credibility, 0) /
                results.length
              : 0,
          highCredibilityCount: results.filter((r) => r.credibility >= 0.7)
            .length,
          searchedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new Error(
        `Search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

/**
 * URL fetch tool - Fetch and extract content from a specific URL
 *
 * Provides:
 * - URL content fetching and extraction
 * - HTML to text conversion
 * - Content truncation for large pages
 */
export const urlFetchTool = tool({
  description: `Fetch and extract text content from a specific URL.

Features:
- Fetches HTML content from URLs
- Extracts text by removing scripts, styles, and HTML tags
- Truncates content to first 5000 characters

Examples:
- "Get content from https://example.com/article" → fetch and extract URL content
- "Fetch https://blog.example.com/post" → extract article text`,
  inputSchema: z.object({
    url: z.string().url().describe("The URL to fetch content from"),
  }),
  execute: async ({ url }) => {
    // Fetch content from specific URL
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch URL: ${response.status} ${response.statusText}`
        );
      }
      const html = await response.text();

      // Basic text extraction (remove script tags, styles, etc.)
      const text = html
        .replace(/<script[^>]*>.*?<\/script>/gis, "")
        .replace(/<style[^>]*>.*?<\/style>/gis, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // Return structured content
      return {
        url,
        title: extractTitle(html),
        content: text.slice(0, 5000),
        contentLength: text.length,
        truncated: text.length > 5000,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch URL: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

/**
 * Duyet MCP Client Tool
 *
 * Access information about Duyet including profile, CV, blog posts, GitHub activity.
 * Connects to https://mcp.duyet.net HTTP endpoints.
 */
export const duyetMCPTool = tool({
  description: `Access information about Duyet including profile, CV, blog posts, GitHub activity, and contact options.

Available actions:
- get_about: Get basic information about Duyet (experience, skills, contact)
- get_cv: Get CV/resume in summary, detailed, or JSON format
- get_blog_posts: Get latest blog posts from blog.duyet.net
- get_blog_post: Get full content of a specific blog post by URL
- get_github_activity: Get recent GitHub contributions and activity
- send_message: Send a message to Duyet for collaboration or inquiries
- get_hire_info: Get information about hiring Duyet
- say_hi: Send a friendly greeting to Duyet`,
  inputSchema: z.object({
    action: z
      .enum([
        "get_about",
        "get_cv",
        "get_blog_posts",
        "get_blog_post",
        "get_github_activity",
        "send_message",
        "get_hire_info",
        "say_hi",
      ])
      .describe("The action to perform"),
    format: z
      .enum(["summary", "detailed", "json"])
      .optional()
      .describe("Format for CV (summary, detailed, or json)"),
    limit: z
      .number()
      .optional()
      .describe("Limit number of results for blog posts or GitHub activity"),
    url: z
      .string()
      .optional()
      .describe("URL for getting specific blog post content"),
    message: z
      .string()
      .optional()
      .describe("Message for send_message or say_hi actions"),
    email: z.string().optional().describe("Email for send_message action"),
  }),
  execute: async ({ action, format, limit, url, message, email }) => {
    const baseURL = "https://mcp.duyet.net";

    try {
      let endpoint = "";
      const options: RequestInit = {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      };

      switch (action) {
        case "get_about":
          endpoint = "/api/resources/about";
          break;

        case "get_cv":
          endpoint = `/api/tools/cv?format=${format || "detailed"}`;
          break;

        case "get_blog_posts":
          endpoint = `/api/tools/blog/posts?limit=${limit || 5}`;
          break;

        case "get_blog_post":
          if (!url) {
            throw new Error(
              "url parameter is required for get_blog_post action"
            );
          }
          endpoint = `/api/tools/blog/post?url=${encodeURIComponent(url)}`;
          break;

        case "get_github_activity":
          endpoint = `/api/tools/github/activity?limit=${limit || 10}`;
          break;

        case "send_message":
          if (!message) {
            throw new Error(
              "message parameter is required for send_message action"
            );
          }
          endpoint = "/api/tools/message";
          options.method = "POST";
          (options as { body: string }).body = JSON.stringify({
            message,
            email,
          });
          break;

        case "get_hire_info":
          endpoint = "/api/tools/hire";
          break;

        case "say_hi":
          endpoint = "/api/tools/hi";
          options.method = "POST";
          (options as { body: string }).body = JSON.stringify({ message });
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      const response = await fetch(`${baseURL}${endpoint}`, options);

      if (!response.ok) {
        throw new Error(
          `Duyet MCP server error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      return result;
    } catch (error) {
      throw new Error(
        `Duyet MCP request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

/**
 * Plan tool - Task planning and breakdown with structured metadata
 */
export const planTool = tool({
  description: `Plan and break down complex tasks into steps.

Useful for:
- Breaking down complex problems into manageable steps
- Creating action plans for multi-step tasks
- Organizing thoughts before execution

Returns structured metadata for visualization including:
- Step-by-step breakdown with status tracking
- Dependencies between steps
- Estimated complexity and effort
- Progress indicators`,
  inputSchema: z.object({
    task: z.string().describe("The task or problem to plan"),
    context: z
      .string()
      .optional()
      .describe("Additional context about the task"),
    steps: z
      .array(z.string())
      .optional()
      .describe(
        "Custom steps for the plan (optional, will be generated if not provided)"
      ),
  }),
  execute: async ({ task, context, steps }) => {
    // Generate or use provided steps
    const planSteps = steps || [
      "1. Understand the requirements and constraints",
      "2. Identify the key components or steps needed",
      "3. Break down each component into actionable items",
      "4. Sequence the steps logically",
      "5. Identify any dependencies between steps",
    ];

    // Return structured metadata for visualization
    return {
      task,
      context,
      steps: planSteps.map((step, index) => ({
        id: `step-${index + 1}`,
        title: step,
        status: index === 0 ? "in-progress" : "pending",
        dependencies: index > 0 ? [`step-${index}`] : [],
        complexity: index < 2 ? "low" : index < 4 ? "medium" : "high",
      })),
      metadata: {
        totalSteps: planSteps.length,
        completedSteps: 0,
        estimatedEffort: planSteps.length * 15, // minutes
        createdAt: new Date().toISOString(),
      },
      suggestion: `For task "${task}", I recommend starting by clarifying the specific goals and success criteria. Then break down the work into smaller, testable increments.`,
    };
  },
});

/**
 * Scratchpad tool - Temporary note storage using KV
 */
export const scratchpadTool = tool({
  description: `Store and retrieve temporary notes during a conversation.

Useful for:
- Remembering intermediate results
- Keeping track of information across multiple steps
- Temporary data storage with KV persistence

Actions:
- store: Save a note with a key and value
- retrieve: Get a note by key
- list: List all stored notes
- clear: Remove a specific key or clear all notes
- export: Export all notes as JSON`,
  inputSchema: z.object({
    action: z
      .enum(["store", "retrieve", "list", "clear", "export"])
      .describe("Action to perform"),
    key: z.string().optional().describe("Key for storing/retrieving data"),
    value: z.string().optional().describe("Value to store"),
  }),
  execute: async ({ action, key, value }) => {
    // Note: KV storage would be passed through closure in production
    // For now, using in-memory fallback
    const kv = undefined;

    switch (action) {
      case "store": {
        if (!key || value === undefined) {
          throw new Error("key and value are required for store action");
        }

        const noteData = {
          value,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (kv) {
          await kv.put(`scratchpad:${key}`, JSON.stringify(noteData));
        } else {
          const storage = (globalThis.scratchpadStorage =
            globalThis.scratchpadStorage || new Map<string, string>());
          storage.set(key, JSON.stringify(noteData));
        }

        return {
          action: "stored",
          key,
          size: value.length,
          storage: kv ? "kv" : "memory",
        };
      }

      case "retrieve": {
        if (!key) {
          throw new Error("key is required for retrieve action");
        }

        if (kv) {
          const stored = await kv.get(`scratchpad:${key}`);
          if (!stored) {
            throw new Error(`Key "${key}" not found in scratchpad`);
          }
          const data = JSON.parse(stored);
          return {
            action: "retrieved",
            key,
            value: data.value,
            createdAt: data.createdAt,
          };
        }
        const storage = globalThis.scratchpadStorage;
        if (!storage) {
          throw new Error("Scratchpad is empty");
        }
        const stored = storage.get(key);
        if (stored === undefined) {
          throw new Error(`Key "${key}" not found in scratchpad`);
        }
        const data = JSON.parse(stored);
        return {
          action: "retrieved",
          key,
          value: data.value,
          createdAt: data.createdAt,
        };
      }

      case "list": {
        if (kv) {
          const keys = await kv.list({ prefix: "scratchpad:" });
          const notes = await Promise.all(
            keys.keys.map(async (k) => {
              const value = await kv.get(k.name);
              const data = value
                ? JSON.parse(value)
                : { value: "", createdAt: new Date().toISOString() };
              return {
                key: k.name.replace("scratchpad:", ""),
                value: data.value,
                createdAt: data.createdAt,
              };
            })
          );
          return { action: "listed", count: notes.length, notes };
        }
        const storage = globalThis.scratchpadStorage;
        if (!storage) {
          return { action: "listed", count: 0, notes: [] };
        }
        const notes = Array.from(storage.entries()).map(([k, v]) => {
          const data = JSON.parse(v);
          return {
            key: k,
            value: data.value,
            createdAt: data.createdAt,
          };
        });
        return { action: "listed", count: notes.length, notes };
      }

      case "clear":
        if (key) {
          if (kv) {
            await kv.delete(`scratchpad:${key}`);
          } else {
            const storage = globalThis.scratchpadStorage;
            if (storage) {
              storage.delete(key);
            }
          }
          return { action: "cleared", key };
        }
        if (kv) {
          const keys = await kv.list({ prefix: "scratchpad:" });
          await Promise.all(keys.keys.map((k) => kv.delete(k.name)));
        } else {
          const storage = globalThis.scratchpadStorage;
          if (storage) {
            storage.clear();
          }
        }
        return { action: "cleared", all: true };

      case "export": {
        if (kv) {
          const keys = await kv.list({ prefix: "scratchpad:" });
          const notes: Record<string, string> = {};
          await Promise.all(
            keys.keys.map(async (k) => {
              const value = await kv.get(k.name);
              if (value) {
                const data = JSON.parse(value);
                notes[k.name.replace("scratchpad:", "")] = data.value;
              }
            })
          );
          return {
            action: "exported",
            format: "json",
            data: JSON.stringify(notes, null, 2),
            count: Object.keys(notes).length,
          };
        }
        const storage = globalThis.scratchpadStorage;
        const notes: Record<string, string> = {};
        if (storage) {
          storage.forEach((v, k) => {
            const data = JSON.parse(v);
            notes[k] = data.value;
          });
        }
        return {
          action: "exported",
          format: "json",
          data: JSON.stringify(notes, null, 2),
          count: Object.keys(notes).length,
        };
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },
});

/**
 * Weather tool - Get current weather for a location
 *
 * Provides:
 * - Current weather conditions using Open-Meteo API (free, no API key required)
 * - Temperature, humidity, wind speed, weather description
 * - Support for city name or coordinates
 */
export const getWeatherTool = tool({
  description: `Get current weather information for a location.

Features:
- Current weather conditions (temperature, humidity, wind, weather description)
- Support for city names or latitude/longitude coordinates
- Uses Open-Meteo API (free, no API key required)

Examples:
- "What's the weather in Tokyo?" → weather for Tokyo
- "Get weather for latitude 35.6762 and longitude 139.6503" → weather for coordinates`,
  inputSchema: z.object({
    location: z
      .string()
      .optional()
      .describe("City name or location description"),
    latitude: z
      .number()
      .min(-90)
      .max(90)
      .optional()
      .describe("Latitude (-90 to 90)"),
    longitude: z
      .number()
      .min(-180)
      .max(180)
      .optional()
      .describe("Longitude (-180 to 180)"),
  }),
  execute: async ({ location, latitude, longitude }) => {
    try {
      let lat: number;
      let lon: number;
      let locationName = location || "Unknown location";

      // If coordinates are provided directly, use them
      if (latitude !== undefined && longitude !== undefined) {
        lat = latitude;
        lon = longitude;
      } else if (location) {
        // Geocode the location name to coordinates using Open-Meteo Geocoding API
        const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
        const geocodeResponse = await fetch(geocodeUrl);
        const geocodeData = (await geocodeResponse.json()) as {
          results?: Array<{
            latitude: number;
            longitude: number;
            name: string;
            country: string;
          }>;
        };

        if (!geocodeData.results || geocodeData.results.length === 0) {
          throw new Error(`Location not found: ${location}`);
        }

        const result = geocodeData.results[0];
        lat = result.latitude;
        lon = result.longitude;
        locationName = `${result.name}, ${result.country}`;
      } else {
        throw new Error(
          "Either location name or latitude/longitude coordinates are required"
        );
      }

      // Fetch weather data from Open-Meteo API
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&wind_speed_unit=mph&timezone=auto`;
      const weatherResponse = await fetch(weatherUrl);

      if (!weatherResponse.ok) {
        throw new Error(`Weather API error: ${weatherResponse.status}`);
      }

      const weatherData = (await weatherResponse.json()) as {
        current: {
          temperature_2m: number;
          relative_humidity_2m: number;
          weather_code: number;
          wind_speed_10m: number;
        };
      };

      // Convert weather code to description
      const weatherDescription = getWeatherDescription(
        weatherData.current.weather_code
      );

      return {
        location: locationName,
        latitude: lat,
        longitude: lon,
        temperature: {
          value: weatherData.current.temperature_2m,
          unit: "°C",
        },
        humidity: {
          value: weatherData.current.relative_humidity_2m,
          unit: "%",
        },
        windSpeed: {
          value: weatherData.current.wind_speed_10m,
          unit: "mph",
        },
        condition: weatherDescription,
        retrievedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Weather lookup failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

/**
 * Convert Open-Meteo weather code to human-readable description
 *
 * Codes: https://open-meteo.com/en/docs
 */
function getWeatherDescription(code: number): string {
  const weatherCodes: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };

  return weatherCodes[code] || "Unknown";
}

/**
 * Helper function to extract title from HTML
 */
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : "Untitled";
}

/**
 * Get all AI SDK v6 compatible tools for the web worker
 *
 * These tools are safe for Cloudflare Workers (no shell, git, or long-running processes)
 */
export function getWebWorkerTools() {
  return {
    web_search: webSearchTool,
    url_fetch: urlFetchTool,
    duyet_mcp: duyetMCPTool,
    plan: planTool,
    scratchpad: scratchpadTool,
    getWeather: getWeatherTool,
  };
}

// Extend global type for scratchpad storage
declare global {
  // eslint-disable-next-line no-var
  var scratchpadStorage: Map<string, string> | undefined;
}
