/**
 * File Upload API Routes
 *
 * Handles image file uploads with validation and base64 storage.
 * For MVP, files are stored as data URIs (base64 encoded).
 */

import { Hono } from 'hono';
import { requireAuth } from '../lib/auth-middleware';

type Bindings = {
  ASSETS: Fetcher;
  ENVIRONMENT: string;
};

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Corresponding file extensions
const CONTENT_TYPE_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * Validation error with detailed message
 */
class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

/**
 * Validate file based on size and content type
 */
function validateFile(file: File | null): void {
  if (!file) {
    throw new FileValidationError('No file uploaded');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new FileValidationError('File size should be less than 5MB');
  }

  if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
    throw new FileValidationError('File type should be JPEG, PNG, or WEBP');
  }
}

/**
 * Convert file to base64 data URI
 */
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
  return `data:${file.type};base64,${btoa(binary)}`;
}

/**
 * Generate a unique pathname for the uploaded file
 */
function generatePathname(filename: string, contentType: string): string {
  const extension = CONTENT_TYPE_TO_EXTENSION[contentType] || '.bin';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `/uploads/${timestamp}-${random}${extension}`;
}

const filesUploadRouter = new Hono<{ Bindings: Bindings }>();

/**
 * POST /api/v1/files/upload
 *
 * Upload a file and return its metadata.
 *
 * Request:
 * - FormData with 'file' field containing the file
 *
 * Response:
 * - url: Data URI (base64 encoded)
 * - pathname: Generated file path
 * - contentType: File MIME type
 * - size: File size in bytes
 *
 * Errors:
 * - 400: Invalid file or validation error
 * - 401: Unauthorized (requires authentication)
 * - 500: Upload failed
 */
filesUploadRouter.post('/upload', requireAuth, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;

    // Validate file
    try {
      validateFile(file);
    } catch (error) {
      if (error instanceof FileValidationError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }

    if (!file) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    // Convert to base64 data URI
    const url = await fileToBase64(file);
    const pathname = generatePathname(file.name, file.type);

    return c.json({
      url,
      pathname,
      contentType: file.type,
      size: file.size,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return c.json({ error: 'Upload failed' }, 500);
  }
});

export { filesUploadRouter };
