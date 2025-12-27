"use client";

/**
 * Markdown Component
 *
 * Renders markdown content with proper styling for chat interfaces.
 * Uses react-markdown for parsing and rendering.
 */

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface MarkdownProps {
	children: string;
	className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
	return (
		<div
			className={cn(
				"prose prose-sm dark:prose-invert max-w-none",
				// Headings
				"prose-headings:font-semibold prose-headings:tracking-tight",
				// Code blocks
				"prose-pre:bg-muted prose-pre:border prose-pre:rounded-lg",
				"prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5",
				"prose-code:before:content-none prose-code:after:content-none",
				// Lists
				"prose-ul:my-2 prose-ol:my-2",
				"prose-li:my-0.5",
				// Links
				"prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
				// Paragraphs
				"prose-p:my-2 prose-p:leading-relaxed",
				// Blockquotes
				"prose-blockquote:border-l-primary prose-blockquote:not-italic",
				className,
			)}
		>
			<ReactMarkdown>{children}</ReactMarkdown>
		</div>
	);
}
