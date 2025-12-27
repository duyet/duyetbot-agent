/**
 * Sentry Client Configuration
 *
 * This file configures the Sentry SDK for the client-side (browser).
 * It initializes error tracking, performance monitoring, and session replay.
 */
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
	dsn: SENTRY_DSN,

	// Only initialize if DSN is provided
	enabled: Boolean(SENTRY_DSN),

	// Environment configuration
	environment: process.env.NODE_ENV,

	// Performance monitoring sample rate (1.0 = 100% of transactions)
	// Reduce in production if needed for cost control
	tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

	// Session replay configuration
	// Captures user sessions for debugging UI issues
	replaysSessionSampleRate: 0.1, // 10% of sessions
	replaysOnErrorSampleRate: 1.0, // 100% when errors occur

	// Debug mode for development
	debug: process.env.NODE_ENV === "development",

	// Filter out noisy errors
	beforeSend(event, hint) {
		// Filter out ResizeObserver errors (browser quirk)
		if (event.exception?.values) {
			const isResizeObserverError = event.exception.values.some(
				(value) =>
					value.value?.includes("ResizeObserver") ||
					value.type === "ResizeObserver loop limit exceeded",
			);
			if (isResizeObserverError) {
				return null;
			}
		}

		// Filter out network errors that are expected (offline, abort)
		if (event.exception?.values) {
			const isNetworkError = event.exception.values.some(
				(value) =>
					value.value?.includes("Failed to fetch") ||
					value.value?.includes("NetworkError") ||
					value.value?.includes("AbortError"),
			);
			if (isNetworkError) {
				return null;
			}
		}

		return event;
	},

	// Integrations
	integrations: [
		// Replay integration for session recording
		Sentry.replayIntegration({
			// Mask all text content for privacy
			maskAllText: true,
			// Block all media for privacy
			blockAllMedia: true,
		}),
		// Browser tracing for performance monitoring
		Sentry.browserTracingIntegration(),
	],
});
