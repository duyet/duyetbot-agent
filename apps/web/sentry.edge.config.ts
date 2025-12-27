/**
 * Sentry Edge Configuration
 *
 * This file configures the Sentry SDK for edge runtime (Cloudflare Workers).
 * Used for API routes and middleware running at the edge.
 */
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
	dsn: SENTRY_DSN,

	// Only initialize if DSN is provided
	enabled: Boolean(SENTRY_DSN),

	// Environment configuration
	environment: process.env.NODE_ENV,

	// Performance monitoring sample rate
	// Lower for edge to reduce overhead
	tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 1.0,

	// Debug mode for development
	debug: process.env.NODE_ENV === "development",

	// Filter out expected errors
	beforeSend(event) {
		// Filter out expected API errors
		if (event.exception?.values) {
			const isExpectedError = event.exception.values.some(
				(value) =>
					value.value?.includes("401") ||
					value.value?.includes("404") ||
					value.value?.includes("Rate limit"),
			);
			if (isExpectedError) {
				return null;
			}
		}
		return event;
	},
});
