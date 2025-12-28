/**
 * k6 API Load Test for DuyetBot Web
 *
 * Tests the chat API endpoints under load.
 *
 * Run against production:
 *   k6 run --env URL=https://duyetbot-web.duyet.workers.dev tests/load/api-load-test.js
 *
 * Note: This test requires a valid authentication token.
 * Set the TOKEN environment variable: --env TOKEN=your_token_here
 */

import { check, sleep } from "k6";
import http from "k6/http";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

export const options = {
	// API load test: higher load for stress testing
	stages: [
		{ duration: "30s", target: 10 }, // Warm up
		{ duration: "1m", target: 20 }, // Ramp to 20 concurrent users
		{ duration: "2m", target: 20 }, // Sustain load
		{ duration: "30s", target: 50 }, // Spike test
		{ duration: "1m", target: 50 }, // Sustain spike
		{ duration: "30s", target: 0 }, // Ramp down
	],

	thresholds: {
		// API endpoints should respond quickly
		http_req_duration: ["p(95)<1000", "p(99)<2000"],
		// Keep error rate low
		errors: ["rate<0.1"],
		// At least 90% of requests should succeed
		http_req_failed: ["rate<0.1"],
	},

	// Cloudflare Workers optimization
	batch: 20,
	batchPerHost: 10,
};

const BASE_URL = __ENV.URL || "http://localhost:3000";
const TOKEN = __ENV.TOKEN || "";

// Headers
const getHeaders = (auth = false) => {
	const headers = {
		"Content-Type": "application/json",
	};

	if (auth && TOKEN) {
		headers["Authorization"] = `Bearer ${TOKEN}`;
	}

	return headers;
};

export default function () {
	// Test 1: Health check (always run)
	const healthRes = http.get(`${BASE_URL}/health`, {
		tags: { name: "Health" },
	});

	check(healthRes, {
		"health status is 200": (r) => r.status === 200,
		"health response time < 300ms": (r) => r.timings.duration < 300,
	}) || errorRate.add(1);

	// Test 2: Chat history (requires auth)
	if (TOKEN) {
		const historyRes = http.get(`${BASE_URL}/api/history`, {
			headers: getHeaders(true),
			tags: { name: "History" },
		});

		check(historyRes, {
			"history status is 200 or 401": (r) =>
				r.status === 200 || r.status === 401,
			"history response time < 1000ms": (r) => r.timings.duration < 1000,
		}) || errorRate.add(1);
	}

	// Test 3: Models list (public endpoint)
	const modelsRes = http.get(`${BASE_URL}/api/models`, {
		tags: { name: "Models" },
	});

	check(modelsRes, {
		"models status is 200": (r) => r.status === 200,
		"models response time < 500ms": (r) => r.timings.duration < 500,
		"models returns array": (r) => {
			try {
				return Array.isArray(r.json());
			} catch {
				return false;
			}
		},
	}) || errorRate.add(1);

	// Test 4: Create chat (requires auth)
	if (TOKEN) {
		const createRes = http.post(`${BASE_URL}/api/chats`, JSON.stringify({}), {
			headers: getHeaders(true),
			tags: { name: "CreateChat" },
		});

		check(createRes, {
			"create chat status is 200 or 401": (r) =>
				r.status === 200 || r.status === 401,
			"create chat response time < 1000ms": (r) => r.timings.duration < 1000,
		}) || errorRate.add(1);
	}

	// Random sleep to simulate realistic user behavior
	sleep(Math.random() * 3 + 2); // 2-5 seconds
}

export function setup() {
	console.log(`Starting API load test against: ${BASE_URL}`);
	console.log(`Authentication: ${TOKEN ? "Enabled" : "Disabled (guest mode)"}`);
}
