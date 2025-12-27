"use client";

import { useState } from "react";
import { Download, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { exportChat, copyToClipboard, type ExportFormat } from "@/lib/export/chat-exporter";

interface ChatExportProps {
  chatId: string;
  chatTitle: string;
  messages: any[];
}

export function ChatExport({ chatId, chatTitle, messages }: ChatExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat | null>(null);

  const handleExport = async (selectedFormat: ExportFormat) => {
    setIsExporting(true);
    setFormat(selectedFormat);
    try {
      const exportData = {
        chat: {
          id: chatId,
          title: chatTitle,
          createdAt: new Date(),
          visibility: "private",
        },
        messages,
      };

      await exportChat(exportData, selectedFormat);
      toast.success(`Chat exported as ${selectedFormat.toUpperCase()}`);
    } catch (error) {
      toast.error("Failed to export chat");
      console.error(error);
    } finally {
      setIsExporting(false);
      setFormat(null);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const exportData = {
        chat: {
          id: chatId,
          title: chatTitle,
          createdAt: new Date(),
          visibility: "private",
        },
        messages,
      };

      await copyToClipboard(exportData);
      toast.success("Chat copied to clipboard as Markdown");
    } catch (error) {
      toast.error("Failed to copy to clipboard");
      console.error(error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("markdown")} disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("json")} disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")} disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyToClipboard} disabled={isExporting}>
          <Copy className="mr-2 h-4 w-4" />
          Copy as Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
