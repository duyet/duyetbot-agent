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
 * @see https://streamdown.ai/docs/security
 */

import { defaultRehypePlugins, type StreamdownProps } from "streamdown";
import { harden } from "rehype-harden";

/**
 * Hardened security configuration for AI-generated content
 *
 * Rationale:
 * - AI models can be manipulated via prompt injection to include malicious content
 * - Restrict link domains to prevent phishing/malware distribution
 * - Allow data: images for inline charts/graphs (common in AI responses)
 * - Block dangerous protocols (javascript:, data: for links, etc.)
 */
const aiContentSecurityConfig = {
	// Safe protocols only - block javascript:, data:, vbscript:, etc.
	allowedProtocols: ["http", "https", "mailto", "tel"],

	// Restrict links to trusted domains
	// Note: Using wildcards for now since AI may need to reference various sources
	// In production, consider limiting to specific domains or implementing link validation
	allowedLinkPrefixes: ["*"], // TODO: Make configurable per environment

	// Allow data: images for inline content (charts, graphs, etc.)
	allowedImagePrefixes: ["*", "data:"],
	allowDataImages: true,

	// Set default origin for relative URLs
	defaultOrigin: typeof window !== "undefined"
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
	return [
		defaultRehypePlugins.katex,
		[harden, config],
	];
}

// Re-export for convenience
export { defaultRehypePlugins };
