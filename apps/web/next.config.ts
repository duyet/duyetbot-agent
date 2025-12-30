import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Static export for Cloudflare Workers Assets
	output: "export",

	// Disable image optimization (not supported in static export)
	images: {
		unoptimized: true,
	},

	// Production optimizations
	productionBrowserSourceMaps: false,

	// Webpack configuration for bundle optimization
	webpack: (config, { isServer }) => {
		// Optimize bundle size
		if (!isServer) {
			config.resolve.alias = {
				...config.resolve.alias,
				// Use lighter versions where available
			};
		}
		return config;
	},

	// Enable experimental features for performance
	experimental: {
		// Optimize CSS imports
		optimizeCss: true,
		// Optimize package imports
		optimizePackageImports: [
			"lucide-react",
			"@radix-ui/react-icons",
			"recharts",
		],
	},

	// Compress output (for static assets)
	compress: true,

	// Generate strict ESM output for better tree-shaking
	eslint: {
		ignoreDuringBuilds: false,
	},

	typescript: {
		ignoreBuildErrors: false,
	},
};

// Sentry configuration options
const sentryOptions = {
	// Suppress Sentry logs during build (less noisy)
	silent: true,

	// Organization and project names (optional, for source maps upload)
	org: process.env.SENTRY_ORG,
	project: process.env.SENTRY_PROJECT,

	// Upload source maps to Sentry for better stack traces
	// Only enabled when auth token is available
	sourcemaps: {
		disable: !process.env.SENTRY_AUTH_TOKEN,
	},

	// Disable telemetry
	telemetry: false,

	// Hide source maps from production bundle
	hideSourceMaps: true,

	// Disable Sentry webpack plugin features that don't apply to static export
	disableServerWebpackPlugin: true,
};

// Wrap with Sentry only if DSN is configured
const config = process.env.NEXT_PUBLIC_SENTRY_DSN
	? withSentryConfig(nextConfig, sentryOptions)
	: nextConfig;

export default config;
