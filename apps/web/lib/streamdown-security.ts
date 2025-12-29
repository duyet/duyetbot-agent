/**
 * Streamdown security configuration
 * Provides hardened rehype-harden settings for AI-generated and user content
 *
 * SECURITY NOTES:
 * - AI content: Use strict settings to prevent prompt injection attacks
 * - User content: Can be more permissive since user typed it themselves
 * - Links: Block javascript:, data:, and other dangerous protocols
 * - Images: Allow data: images for inline content (needed for some AI responses)
 * - HTML: Disabled entirely - all HTML is escaped by default
 *
 * ENVIRONMENT VARIABLES:
 * - NEXT_PUBLIC_ALLOWED_LINK_DOMAINS: Comma-separated list of allowed link domains
 *   Example: "github.com,duyet.workers.dev,anthropic.com"
 *   Default: "*" (all domains allowed) for development flexibility
 *   Production should explicitly set trusted domains
 *
 * @see https://streamdown.ai/docs/security
 */

import { harden } from "rehype-harden";
import { defaultRehypePlugins, type StreamdownProps } from "streamdown";

/**
 * Parse allowed link domains from environment variable
 *
 * @returns Array of allowed domain prefixes (e.g., "github.com", "*.duyet.workers.dev")
 *          Defaults to ["*"] for all domains if not configured
 */
function getAllowedLinkDomains(): string[] {
	const envDomains = process.env.NEXT_PUBLIC_ALLOWED_LINK_DOMAINS;

	if (!envDomains || envDomains.trim() === "") {
		// Default: allow all domains in development/unconfigured environments
		if (process.env.NODE_ENV !== "production") {
			return ["*"];
		}
		// In production, default to a conservative whitelist
		return [
			"github.com",
			"*.github.com",
			"*.githubusercontent.com",
			"anthropic.com",
			"docs.anthropic.com",
		];
	}

	// Parse comma-separated domains and trim whitespace
	return envDomains
		.split(",")
		.map((domain) => domain.trim())
		.filter((domain) => domain.length > 0);
}

/**
 * Hardened security configuration for AI-generated content
 *
 * Rationale:
 * - AI models can be manipulated via prompt injection to include malicious content
 * - Restrict link domains to prevent phishing/malware distribution
 * - Allow data: images for inline charts/graphs (common in AI responses)
 * - Block dangerous protocols (javascript:, data: for links, etc.)
 *
 * Configuration via NEXT_PUBLIC_ALLOWED_LINK_DOMAINS environment variable:
 * - Development: Defaults to "*" (all domains) for flexibility
 * - Production: Defaults to conservative whitelist if not explicitly set
 * - Custom: Set NEXT_PUBLIC_ALLOWED_LINK_DOMAINS="github.com,anthropic.com"
 */
const aiContentSecurityConfig = {
	// Safe protocols only - block javascript:, data:, vbscript:, etc.
	allowedProtocols: ["http", "https", "mailto", "tel"],

	// Restrict links to configured trusted domains
	// Configure via NEXT_PUBLIC_ALLOWED_LINK_DOMAINS environment variable
	allowedLinkPrefixes: getAllowedLinkDomains(),

	// Allow data: images for inline content (charts, graphs, etc.)
	allowedImagePrefixes: ["*", "data:"],
	allowDataImages: true,

	// Set default origin for relative URLs
	defaultOrigin:
		typeof window !== "undefined"
			? window.location.origin
			: "https://duyetbot-web.duyet.workers.dev",
};

/**
 * Permissive security configuration for user-generated content
 *
 * Rationale:
 * - User typed the content themselves, so they're only attacking themselves
 * - Allow more flexibility for user-provided markdown
 * - Still block dangerous protocols for safety
 */
const userContentSecurityConfig = {
	// Still block dangerous protocols
	allowedProtocols: ["http", "https", "mailto", "tel"],

	// Allow all links
	allowedLinkPrefixes: ["*"],

	// Allow all images
	allowedImagePrefixes: ["*"],
	allowDataImages: true,
};

/**
 * Get rehype-harden plugin configuration for Streamdown
 *
 * @param source - "ai" for AI-generated content, "user" for user content
 * @returns Plugin array for Streamdown rehypePlugins prop
 *
 * @example
 * ```tsx
 * import { Streamdown } from 'streamdown';
 * import { getSecureRehypePlugins } from '@/lib/streamdown-security';
 *
 * <Streamdown rehypePlugins={getSecureRehypePlugins('ai')}>
 *   {aiGeneratedContent}
 * </Streamdown>
 * ```
 */
export function getSecureRehypePlugins(
	source: "ai" | "user" = "ai",
): NonNullable<StreamdownProps["rehypePlugins"]> {
	const config =
		source === "ai" ? aiContentSecurityConfig : userContentSecurityConfig;

	// Note: We deliberately exclude defaultRehypePlugins.raw
	// This means ALL HTML tags are escaped, preventing XSS attacks
	return [defaultRehypePlugins.katex, [harden, config]];
}

// Re-export for convenience
export { defaultRehypePlugins };
