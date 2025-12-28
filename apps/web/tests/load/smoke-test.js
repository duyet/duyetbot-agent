/**
 * k6 Load Testing Suite for DuyetBot Web
 *
 * Run locally:
 *   k6 run tests/load/smoke-test.js
 *
 * Run against production:
 *   k6 run --env URL=https://duyetbot-web.duyet.workers.dev tests/load/smoke-test.js
 *
 * Run with HTML output:
 *   k6 run --out json=test-results.json tests/load/smoke-test.js
 *
 * Best Practices:
 * - Test against production URL from multiple locations
 * - Use gradual ramp-up to avoid triggering Cloudflare DDoS protection
 * - Monitor response times, error rates, and throughput
 * - Correlate with Cloudflare Analytics for comprehensive view
 */

import { check, sleep } from "k6";
import http from "k6/http";
import { Rate } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");

// Test configuration
export const options = {
	// Base URL for tests (can be overridden via --env)
	// stages: [
	// 	{ duration: "30s", target: 10 },   // Ramp up to 10 users
	// 	{ duration: "1m", target: 10 },    // Stay at 10 users
	// 	{ duration: "30s", target: 50 },   // Ramp up to 50 users
	// 	{ duration: "1m", target: 50 },    // Stay at 50 users
	// 	{ duration: "30s", target: 0 },    // Ramp down to 0
	// ],

	// Smoke test: low load for quick validation
	stages: [
		{ duration: "10s", target: 5 }, // Quick ramp up
		{ duration: "20s", target: 5 }, // Stay at 5 users
		{ duration: "10s", target: 0 }, // Ramp down
	],

	// Thresholds for alerting
	thresholds: {
		// 95% of requests must complete below 500ms
		http_req_duration: ["p(95)<500"],
		// Error rate must be below 5%
		errors: ["rate<0.05"],
		// 95% of requests must be successful
		http_req_failed: ["rate<0.05"],
	},

	// Cloudflare Workers friendly settings
	// Lower batch size and timeout for edge testing
	batch: 10,
	batchPerHost: 5,
	httpDebug: "full", // For debugging
};

const BASE_URL = __ENV.URL || "http://localhost:3000";

export default function () {
	// Test 1: Home page health check
	const homeRes = http.get(`${BASE_URL}/`, {
		tags: { name: "Home" },
	});

	check(homeRes, {
		"home status is 200 or 404": (r) => r.status === 200 || r.status === 404, // 404 OK for static export
		"home response time < 500ms": (r) => r.timings.duration < 500,
	}) || errorRate.add(1);

	sleep(1);

	// Test 2: Health endpoint
	const healthRes = http.get(`${BASE_URL}/health`, {
		tags: { name: "Health" },
	});

	check(healthRes, {
		"health status is 200": (r) => r.status === 200,
		"health response time < 300ms": (r) => r.timings.duration < 300,
		"health returns healthy": (r) => r.json("status") === "healthy",
	}) || errorRate.add(1);

	sleep(1);

	// Test 3: Login page
	const loginRes = http.get(`${BASE_URL}/login`, {
		tags: { name: "Login" },
	});

	check(loginRes, {
		"login status is 200": (r) => r.status === 200,
		"login response time < 500ms": (r) => r.timings.duration < 500,
	}) || errorRate.add(1);

	sleep(1);

	// Test 4: Register page
	const registerRes = http.get(`${BASE_URL}/register`, {
		tags: { name: "Register" },
	});

	check(registerRes, {
		"register status is 200": (r) => r.status === 200,
		"register response time < 500ms": (r) => r.timings.duration < 500,
	}) || errorRate.add(1);

	// Small sleep between iterations to avoid rate limiting
	sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// Optional: Setup function (runs once before test)
export function setup() {
	console.log(`Starting load test against: ${BASE_URL}`);
	console.log(
		`Test duration: ${options.stages.reduce((acc, s) => acc + s.duration, 0)}`,
	);
	console.log(`Max VUs: ${Math.max(...options.stages.map((s) => s.target))}`);
}

// Optional: Teardown function (runs once after test)
export function teardown() {
	console.log("Load test completed");
}
