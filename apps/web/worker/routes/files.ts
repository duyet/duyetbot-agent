/**
 * Files upload routes for Hono worker
 * POST /api/files/upload - Upload file to R2
 */

import { Hono } from "hono";
import { getSessionFromRequest } from "../lib/auth-helpers";
import type { Env } from "../types";

export const filesRoutes = new Hono<{ Bindings: Env }>();

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

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: "File size should be less than 5MB" }, 400);
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: "File type should be JPEG or PNG" }, 400);
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
      key,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ error: "Upload failed" }, 500);
  }
});
