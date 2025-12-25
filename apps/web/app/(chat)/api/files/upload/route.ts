import { NextResponse } from "next/server";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { auth } from "@/lib/auth/middleware";

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "File size should be less than 5MB",
    })
    // Update the file type based on the kind of files you want to accept
    .refine((file) => ["image/jpeg", "image/png"].includes(file.type), {
      message: "File type should be JPEG or PNG",
    }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Get filename from formData since Blob doesn't have name property
    const filename = (formData.get("file") as File).name;
    const fileBuffer = await file.arrayBuffer();

    try {
      const { env } = await getCloudflareContext({ async: true });
      const bucket = env.UPLOADS_BUCKET;

      if (!bucket) {
        return NextResponse.json(
          { error: "Upload storage not configured" },
          { status: 500 }
        );
      }

      // Generate unique key with user ID and timestamp
      const key = `uploads/${session.user.id}/${Date.now()}-${filename}`;

      // Upload to R2
      await bucket.put(key, fileBuffer, {
        httpMetadata: { contentType: file.type },
      });

      // Return public URL (configure R2 bucket for public access or use custom domain)
      const publicUrl = `${env.R2_PUBLIC_URL || "https://r2.public.url"}/${key}`;

      return NextResponse.json({
        url: publicUrl,
        downloadUrl: publicUrl,
        key,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      });
    } catch (_error) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
