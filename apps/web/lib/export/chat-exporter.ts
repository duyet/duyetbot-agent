import type { ChatMessage } from "@/lib/types";
import type { Chat } from "@/lib/db/schema";

export type ExportFormat = "markdown" | "json" | "pdf";

interface ChatExportData {
  chat: Chat;
  messages: ChatMessage[];
}

/**
 * Export chat to markdown format
 */
export function exportToMarkdown(data: ChatExportData): string {
  const { chat, messages } = data;
  let markdown = `# ${chat.title}\n\n`;
  markdown += `**Created:** ${new Date(chat.createdAt).toLocaleString()}\n`;
  markdown += `**Visibility:** ${chat.visibility}\n\n`;
  markdown += `---\n\n`;

  for (const message of messages) {
    const role = message.role === "user" ? "User" : "Assistant";
    markdown += `## ${role}\n\n`;

    for (const part of message.parts || []) {
      if (part.type === "text" && part.text) {
        markdown += `${part.text}\n\n`;
      } else if (part.type === "file" && part.url) {
        markdown += `[File: ${part.filename || part.url}](${part.url})\n\n`;
      } else if (part.type === "tool-" && part.toolName) {
        markdown += `**Tool:** ${part.toolName}\n\n`;
        if (part.args) {
          markdown += `**Args:** \`${JSON.stringify(part.args)}\`\n\n`;
        }
        if (part.result) {
          markdown += `**Result:** \n\`\`\`\n${JSON.stringify(part.result, null, 2)}\n\`\`\`\n\n`;
        }
      }
    }
    markdown += `---\n\n`;
  }

  return markdown;
}

/**
 * Export chat to JSON format
 */
export function exportToJSON(data: ChatExportData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Export chat to PDF format (returns markdown for PDF library conversion)
 */
export function exportToPDF(data: ChatExportData): string {
  // Return markdown which can be converted to PDF using libraries like jsPDF
  return exportToMarkdown(data);
}

/**
 * Download exported content as file
 */
export function downloadExport(content: string, filename: string, format: ExportFormat): void {
  const mimeTypes: Record<ExportFormat, string> = {
    markdown: "text/markdown",
    json: "application/json",
    pdf: "application/pdf",
  };

  const extensions: Record<ExportFormat, string> = {
    markdown: "md",
    json: "json",
    pdf: "pdf",
  };

  const blob = new Blob([content], { type: mimeTypes[format] });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.${extensions[format]}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Main export function that handles all formats
 */
export async function exportChat(
  data: ChatExportData,
  format: ExportFormat
): Promise<void> {
  const filename = `${data.chat.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now()}`;

  let content: string;
  switch (format) {
    case "markdown":
      content = exportToMarkdown(data);
      break;
    case "json":
      content = exportToJSON(data);
      break;
    case "pdf":
      content = exportToPDF(data);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  downloadExport(content, filename, format);
}

/**
 * Copy chat to clipboard as markdown
 */
export async function copyToClipboard(data: ChatExportData): Promise<void> {
  const markdown = exportToMarkdown(data);
  await navigator.clipboard.writeText(markdown);
}
