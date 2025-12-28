"use client";

/**
 * Markdown Component
 *
 * Renders markdown content with proper styling and security.
 * Uses Streamdown with hardened security settings to prevent XSS attacks.
 *
 * @deprecated Use Streamdown component directly with getSecureRehypePlugins()
 * This component is kept for backward compatibility but should be replaced.
 */

import { Streamdown } from "streamdown";
import { getSecureRehypePlugins } from "@/lib/streamdown-security";
import { cn } from "@/lib/utils";

interface MarkdownProps {
	children: string;
	className?: string;
	/**
	 * Source of the markdown content
	 * - "ai": AI-generated content (strict security settings)
	 * - "user": User-generated content (more permissive)
	 * @default "ai"
	 */
	source?: "ai" | "user";
}

export function Markdown({
	children,
	className,
	source = "ai",
}: MarkdownProps) {
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
			<Streamdown
				rehypePlugins={getSecureRehypePlugins(source)}
				className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0")}
			>
				{children}
			</Streamdown>
		</div>
	);
}
