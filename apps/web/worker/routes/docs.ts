/**
 * API Documentation Routes
 *
 * Serves OpenAPI specification and Swagger UI for API documentation.
 */

import { Hono } from "hono";
import { openApiSpec } from "../openapi";
import type { HonoEnv } from "../types";

const docsRouter = new Hono<HonoEnv>();

// GET /api/docs - Swagger UI HTML
docsRouter.get("/", (c) => {
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>DuyetBot API Documentation</title>
	<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
	<style>
		body { margin: 0; padding: 0; }
		.swagger-ui .topbar { display: none; }
		.swagger-ui .info { margin: 20px 0; }
		.swagger-ui .info .title { font-size: 2em; }
	</style>
</head>
<body>
	<div id="swagger-ui"></div>
	<script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
	<script>
		window.onload = () => {
			window.ui = SwaggerUIBundle({
				url: '/api/docs/openapi.json',
				dom_id: '#swagger-ui',
				deepLinking: true,
				presets: [
					SwaggerUIBundle.presets.apis,
					SwaggerUIBundle.SwaggerUIStandalonePreset
				],
				layout: "BaseLayout",
				defaultModelsExpandDepth: 2,
				defaultModelExpandDepth: 2,
				docExpansion: 'list',
				filter: true,
				showExtensions: true,
				showCommonExtensions: true,
				tryItOutEnabled: true,
				persistAuthorization: true,
			});
		};
	</script>
</body>
</html>`;

	return c.html(html);
});

// GET /api/docs/openapi.json - OpenAPI specification
docsRouter.get("/openapi.json", (c) => {
	return c.json(openApiSpec);
});

// GET /api/docs/openapi.yaml - OpenAPI specification in YAML format
docsRouter.get("/openapi.yaml", (c) => {
	// Simple JSON to YAML conversion for OpenAPI spec
	const yaml = jsonToYaml(openApiSpec);
	return c.text(yaml, 200, { "Content-Type": "text/yaml" });
});

/**
 * Simple JSON to YAML converter for OpenAPI specs
 * Handles basic types, arrays, and objects
 */
function jsonToYaml(obj: unknown, indent = 0): string {
	const spaces = "  ".repeat(indent);

	if (obj === null || obj === undefined) {
		return "null";
	}

	if (typeof obj === "string") {
		// Quote strings that need it
		if (
			obj.includes(":") ||
			obj.includes("#") ||
			obj.includes("\n") ||
			obj.startsWith(" ") ||
			obj.endsWith(" ") ||
			/^[0-9]/.test(obj) ||
			["true", "false", "null", "yes", "no"].includes(obj.toLowerCase())
		) {
			return `"${obj.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
		}
		return obj;
	}

	if (typeof obj === "number" || typeof obj === "boolean") {
		return String(obj);
	}

	if (Array.isArray(obj)) {
		if (obj.length === 0) {
			return "[]";
		}
		return obj
			.map((item) => {
				const itemYaml = jsonToYaml(item, indent + 1);
				if (typeof item === "object" && item !== null) {
					return `${spaces}- ${itemYaml.trimStart()}`;
				}
				return `${spaces}- ${itemYaml}`;
			})
			.join("\n");
	}

	if (typeof obj === "object") {
		const entries = Object.entries(obj);
		if (entries.length === 0) {
			return "{}";
		}
		return entries
			.map(([key, value]) => {
				const valueYaml = jsonToYaml(value, indent + 1);
				if (typeof value === "object" && value !== null && !Array.isArray(value)) {
					return `${spaces}${key}:\n${valueYaml}`;
				}
				if (Array.isArray(value) && value.length > 0) {
					return `${spaces}${key}:\n${valueYaml}`;
				}
				return `${spaces}${key}: ${valueYaml}`;
			})
			.join("\n");
	}

	return String(obj);
}

export { docsRouter };
