/**
 * Message converter for transforming between database format and Vercel AI SDK format
 */

// Core message format expected by Vercel AI SDK
export type CoreMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

/**
 * Extract text content from message parts array
 * Parts can be text parts or file attachments
 */
function extractTextFromParts(parts: unknown): string {
  if (!parts) {
    return "";
  }

  // Handle JSON column type from Drizzle
  const partsArray = Array.isArray(parts) ? parts : [];

  return partsArray
    .map((part: unknown) => {
      if (typeof part === "string") {
        return part;
      }
      if (part && typeof part === "object") {
        // Handle text part: { type: "text", text: "..." }
        if ("type" in part && part.type === "text" && "text" in part) {
          return String(part.text);
        }
        // Handle file part: { type: "file", ... } - skip for now
        if ("type" in part && part.type === "file") {
          return ""; // Skip file attachments in text mode
        }
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Convert database messages to Vercel AI SDK CoreMessage format
 */
export function convertToCoreMessages(messages: unknown[]): CoreMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.map((msg: unknown) => {
    if (msg && typeof msg === "object" && "role" in msg && "parts" in msg) {
      const content = extractTextFromParts((msg as any).parts);
      return {
        role: (msg as any).role as "user" | "assistant" | "system",
        content: content || "",
      };
    }
    return {
      role: "user",
      content: "",
    };
  });
}

/**
 * Convert a single message to CoreMessage format
 */
export function convertSingleMessage(message: {
  id: string;
  role: string;
  parts: unknown[];
}): CoreMessage {
  const content = extractTextFromParts(message.parts);
  return {
    role: message.role as "user" | "assistant" | "system",
    content: content || "",
  };
}
