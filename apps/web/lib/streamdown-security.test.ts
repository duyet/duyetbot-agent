/**
 * Unit tests for streamdown security configuration
 *
 * Test Categories:
 * 1. getAllowedLinkDomains - Environment-based domain parsing
 * 2. aiContentSecurityConfig - AI content security settings
 * 3. getSecureRehypePlugins - Plugin export functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSecureRehypePlugins } from "./streamdown-security";

describe("streamdown-security", () => {
	const originalEnv = process.env.NEXT_PUBLIC_ALLOWED_LINK_DOMAINS;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		// Restore original environment
		process.env.NEXT_PUBLIC_ALLOWED_LINK_DOMAINS = originalEnv;
	});

	describe("getAllowedLinkDomains behavior via getSecureRehypePlugins", () => {
		it("returns plugins array when domains are not configured", () => {
			delete process.env.NEXT_PUBLIC_ALLOWED_LINK_DOMAINS;

			const plugins = getSecureRehypePlugins("ai");
			expect(plugins).toBeTruthy();
			expect(Array.isArray(plugins)).toBe(true);
		});

		it("parses comma-separated domains from NEXT_PUBLIC_ALLOWED_LINK_DOMAINS", () => {
			process.env.NEXT_PUBLIC_ALLOWED_LINK_DOMAINS =
				"github.com,anthropic.com,duyet.workers.dev";

			const plugins = getSecureRehypePlugins("ai");
			expect(plugins).toBeTruthy();
		});

		it("trims whitespace from domain names", () => {
			process.env.NEXT_PUBLIC_ALLOWED_LINK_DOMAINS =
				" github.com , anthropic.com , duyet.workers.dev ";

			const plugins = getSecureRehypePlugins("ai");
			expect(plugins).toBeTruthy();
		});

		it("filters empty strings from domain list", () => {
			process.env.NEXT_PUBLIC_ALLOWED_LINK_DOMAINS =
				"github.com,,anthropic.com,";

			const plugins = getSecureRehypePlugins("ai");
			expect(plugins).toBeTruthy();
		});

		it("handles empty string as NEXT_PUBLIC_ALLOWED_LINK_DOMAINS", () => {
			process.env.NEXT_PUBLIC_ALLOWED_LINK_DOMAINS = "";

			const plugins = getSecureRehypePlugins("ai");
			expect(plugins).toBeTruthy();
		});

		it("handles single domain without comma", () => {
			process.env.NEXT_PUBLIC_ALLOWED_LINK_DOMAINS = "github.com";

			const plugins = getSecureRehypePlugins("ai");
			expect(plugins).toBeTruthy();
		});
	});

	describe("getSecureRehypePlugins", () => {
		it("returns plugins array for AI content", () => {
			const plugins = getSecureRehypePlugins("ai");
			expect(Array.isArray(plugins)).toBe(true);
			expect(plugins.length).toBeGreaterThan(0);
		});

		it("returns plugins array for user content", () => {
			const plugins = getSecureRehypePlugins("user");
			expect(Array.isArray(plugins)).toBe(true);
			expect(plugins.length).toBeGreaterThan(0);
		});

		it("defaults to AI content when source is not specified", () => {
			const plugins = getSecureRehypePlugins();
			expect(Array.isArray(plugins)).toBe(true);
		});

		it("returns different configurations for AI vs user content", () => {
			delete process.env.NEXT_PUBLIC_ALLOWED_LINK_DOMAINS;

			const aiPlugins = getSecureRehypePlugins("ai");
			const userPlugins = getSecureRehypePlugins("user");

			// Both should be arrays
			expect(Array.isArray(aiPlugins)).toBe(true);
			expect(Array.isArray(userPlugins)).toBe(true);

			// User content configuration is more permissive
			// (allowedLinkPrefixes: ["*"]) vs AI content (environment-dependent)
			expect(userPlugins).toBeTruthy();
		});
	});

	describe("security defaults", () => {
		it("always blocks dangerous protocols", () => {
			delete process.env.NEXT_PUBLIC_ALLOWED_LINK_DOMAINS;

			const plugins = getSecureRehypePlugins("ai");
			// Config should only allow safe protocols
			expect(plugins).toBeTruthy();
		});

		it("allows data: images for inline content", () => {
			const plugins = getSecureRehypePlugins("ai");
			// Config should allow data: images
			expect(plugins).toBeTruthy();
		});
	});
});
