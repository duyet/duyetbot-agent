"use client";

import { Maximize2 } from "lucide-react";
import {
	type ComponentProps,
	type ImgHTMLAttributes,
	memo,
	useCallback,
	useState,
} from "react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { getSecureRehypePlugins } from "@/lib/streamdown-security";
import { cn } from "@/lib/utils";

type ResponseProps = ComponentProps<typeof Streamdown>;

// Custom image component for markdown rendering
const MarkdownImage = memo(
	({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) => {
		const [isExpanded, setIsExpanded] = useState(false);
		const [imageError, setImageError] = useState(false);
		const [isLoading, setIsLoading] = useState(true);

		// Check if image is a data URL or external URL
		const isDataUrl = typeof src === "string" && src.startsWith("data:");
		const isExternalUrl =
			typeof src === "string" &&
			(src.startsWith("http://") || src.startsWith("https://"));

		// Don't render if src is invalid or image failed to load
		const shouldShowFallback =
			!src || (!isDataUrl && !isExternalUrl) || imageError;

		const handleClick = useCallback(() => {
			setIsExpanded(true);
		}, []);

		if (shouldShowFallback) {
			return (
				<span className="text-muted-foreground text-sm italic">
					[Image: {alt || "unable to display"}]
				</span>
			);
		}

		return (
			<>
				<span
					className="group relative inline-block max-w-full cursor-pointer"
					onClick={handleClick}
				>
					<img
						{...props}
						src={src}
						alt={alt || ""}
						className={cn(
							"h-auto max-w-full rounded-md transition-opacity",
							isLoading && "opacity-0",
						)}
						loading="lazy"
						onLoad={() => setIsLoading(false)}
						onError={() => {
							setIsLoading(false);
							setImageError(true);
						}}
						style={{ maxHeight: "512px" }}
					/>
					{/* Loading state */}
					{isLoading && (
						<div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-md animate-pulse">
							<span className="text-xs text-muted-foreground">
								Loading image...
							</span>
						</div>
					)}
					{/* Expand button overlay */}
					<div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-md">
						<Button
							variant="secondary"
							size="sm"
							className="shadow-lg"
							onClick={(e) => {
								e.stopPropagation();
								handleClick();
							}}
						>
							<Maximize2 className="h-4 w-4" />
						</Button>
					</div>
				</span>

				{/* Expanded image dialog */}
				<Dialog open={isExpanded} onOpenChange={setIsExpanded}>
					<DialogContent className="max-w-4xl w-full">
						<DialogHeader>
							<DialogTitle>{alt || "Image"}</DialogTitle>
						</DialogHeader>
						<div className="flex items-center justify-center min-h-[200px]">
							<img
								src={src}
								alt={alt || ""}
								className="max-w-full max-h-[70vh] object-contain rounded-md"
							/>
						</div>
					</DialogContent>
				</Dialog>
			</>
		);
	},
);
MarkdownImage.displayName = "MarkdownImage";

export const Response = memo(
	({ className, ...props }: ResponseProps) => (
		<Streamdown
			className={cn(
				"size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto",
				className,
			)}
			rehypePlugins={getSecureRehypePlugins("ai")}
			components={{
				img: MarkdownImage,
			}}
			{...props}
		/>
	),
	(prevProps, nextProps) => prevProps.children === nextProps.children,
);

Response.displayName = "Response";
