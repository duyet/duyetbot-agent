"use client";

import { Copy, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	copyToClipboard,
	type ExportFormat,
	exportChat,
} from "@/lib/export/chat-exporter";

type ChatExportProps = {
	chatId: string;
	chatTitle: string;
	messages: any[];
};

export function ChatExport({ chatId, chatTitle, messages }: ChatExportProps) {
	const [isExporting, setIsExporting] = useState(false);
	const [_format, setFormat] = useState<ExportFormat | null>(null);

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
				<Button disabled={isExporting} size="icon" variant="ghost">
					{isExporting ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Download className="h-4 w-4" />
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem
					disabled={isExporting}
					onClick={() => handleExport("markdown")}
				>
					<Download className="mr-2 h-4 w-4" />
					Export as Markdown
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={isExporting}
					onClick={() => handleExport("json")}
				>
					<Download className="mr-2 h-4 w-4" />
					Export as JSON
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={isExporting}
					onClick={() => handleExport("pdf")}
				>
					<Download className="mr-2 h-4 w-4" />
					Export as PDF
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={isExporting}
					onClick={handleCopyToClipboard}
				>
					<Copy className="mr-2 h-4 w-4" />
					Copy as Markdown
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
