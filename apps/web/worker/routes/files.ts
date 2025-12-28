/**
 * Files upload routes for Hono worker
 * POST /api/files/upload - Upload file to R2
 */

import { Hono } from "hono";
import { getSessionFromRequest } from "../lib/auth-helpers";
import type { Env } from "../types";

export const filesRoutes = new Hono<{ Bindings: Env }>();

/**
 * Magic numbers (file signatures) for common file types
 * Used to validate actual file type regardless of declared MIME type
 */
const MAGIC_NUMBERS: Record<string, Uint8Array> = {
	// Images
	"image/jpeg": new Uint8Array([0xff, 0xd8, 0xff]),
	"image/png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
	"image/gif": new Uint8Array([0x47, 0x49, 0x46, 0x38]),
	"image/webp": new Uint8Array([0x52, 0x49, 0x46, 0x46]), // RIFF....WEBP
	// Documents
	"application/pdf": new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF
	// Text/Code files (no magic number, validated by content)
};

/**
 * Check if file matches its declared type via magic number
 */
async function validateFileType(file: File, declaredType: string): Promise<boolean> {
	// Skip magic number check for text/code files (they have no binary signature)
	const textTypes = [
		"text/plain",
		"text/markdown",
		"text/csv",
		"text/javascript",
		"text/typescript",
		"application/json",
		"text/html",
		"text/css",
		"text/xml",
		"application/xml",
	];

	if (textTypes.includes(declaredType)) {
		// For text files, verify they don't contain binary content
		const buffer = await file.arrayBuffer();
		const view = new Uint8Array(buffer.slice(0, 1024)); // Check first 1KB

		// Check for null bytes (indicates binary file)
		for (let i = 0; i < view.length; i++) {
			if (view[i] === 0) {
				return false;
			}
		}
		return true;
	}

	// For binary files, check magic number
	const expectedMagic = MAGIC_NUMBERS[declaredType];
	if (!expectedMagic) {
		return true; // No validation available, allow it
	}

	const fileBuffer = await file.arrayBuffer();
	const fileHeader = new Uint8Array(fileBuffer.slice(0, expectedMagic.length));

	// Compare file header with expected magic number
	for (let i = 0; i < expectedMagic.length; i++) {
		if (fileHeader[i] !== expectedMagic[i]) {
			return false;
		}
	}

	return true;
}

/**
 * POST /api/files/upload
 * Upload file to R2
 */
filesRoutes.post("/upload", async (c) => {
	const session = await getSessionFromRequest(c);

	if (!session?.user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	try {
		const formData = await c.req.formData();
		const file = formData.get("file") as File | null;

		if (!file) {
			return c.json({ error: "No file uploaded" }, 400);
		}

		// Validate file size (10MB max)
		if (file.size > 10 * 1024 * 1024) {
			return c.json({ error: "File size should be less than 10MB" }, 400);
		}

		// Validate file type - support images, documents, and code files
		const allowedTypes = [
			// Images
			"image/jpeg",
			"image/png",
			"image/gif",
			"image/webp",
			"image/svg+xml",
			// Documents
			"application/pdf",
			"text/plain",
			"text/markdown",
			"text/csv",
			// Code files
			"text/javascript",
			"text/typescript",
			"application/json",
			"text/html",
			"text/css",
			"text/xml",
			"application/xml",
		];
		if (!allowedTypes.includes(file.type)) {
			return c.json(
				{
					error: `Unsupported file type: ${file.type}. Allowed: images, PDF, text, and code files.`,
				},
				400,
			);
		}

		// Validate file content matches declared type (magic number check)
		const isValidFileType = await validateFileType(file, file.type);
		if (!isValidFileType) {
			return c.json(
				{
					error: `File content does not match declared type (${file.type}). File may be corrupted or renamed.`,
				},
				400,
			);
		}

		const bucket = c.env.UPLOADS_BUCKET;

		if (!bucket) {
			return c.json({ error: "Upload storage not configured" }, 500);
		}

		// Generate unique key with user ID and timestamp
		const key = `uploads/${session.user.id}/${Date.now()}-${file.name}`;

		// Upload to R2
		await bucket.put(key, file.stream(), {
			httpMetadata: { contentType: file.type },
		});

		// Return public URL (configure R2 bucket for public access or use custom domain)
		const publicUrl = `${c.env.R2_PUBLIC_URL || "https://r2.public.url"}/${key}`;

		return c.json({
			url: publicUrl,
			downloadUrl: publicUrl,
			pathname: file.name, // For frontend compatibility
			contentType: file.type, // For frontend compatibility
			key,
			size: file.size,
			uploadedAt: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Upload error:", error);
		return c.json({ error: "Upload failed" }, 500);
	}
});
