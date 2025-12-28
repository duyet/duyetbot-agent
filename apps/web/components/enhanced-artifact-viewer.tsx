"use client";

import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
	CodeIcon,
	CopyIcon,
	DownloadIcon,
	EyeIcon,
	FileIcon as FileText,
	ImageIcon,
	Maximize2,
	Minimize2,
	RotateCw,
	Table,
	ZoomIn,
	ZoomOut,
} from "./icons";

export type ArtifactKind = "text" | "code" | "image" | "sheet";

export interface ArtifactViewerProps {
	/**
	 * The type/kind of artifact being viewed
	 */
	kind: ArtifactKind;

	/**
	 * The title of the artifact
	 */
	title: string;

	/**
	 * The content to display
	 */
	content: string;

	/**
	 * Additional metadata about the artifact
	 */
	metadata?: Record<string, unknown>;

	/**
	 * Callback when content is edited
	 */
	onContentChange?: (content: string) => void;

	/**
	 * Whether the viewer is in read-only mode
	 */
	readOnly?: boolean;

	/**
	 * Additional class names
	 */
	className?: string;

	/**
	 * Reference to the container element
	 */
	containerRef?: RefObject<HTMLDivElement>;
}

/**
 * View modes for artifact rendering
 */
export type ArtifactViewMode =
	| "preview" // Rendered preview (markdown, syntax highlighted, etc.)
	| "source" // Raw source code
	| "split"; // Side-by-side preview and source

/**
 * Enhanced artifact viewer with multiple view modes
 *
 * Features:
 * - Preview/Source/Split view modes
 * - Zoom and rotation for images
 * - Copy and download actions
 * - Keyboard shortcuts (Ctrl/Cmd + P for preview, S for source, D for download)
 * - Responsive design with mobile support
 */
export function EnhancedArtifactViewer({
	kind,
	title,
	content,
	metadata = {},
	onContentChange,
	readOnly = false,
	className,
	containerRef,
}: ArtifactViewerProps) {
	const [viewMode, setViewMode] = useState<ArtifactViewMode>("preview");
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [zoom, setZoom] = useState(100);
	const [rotation, setRotation] = useState(0);
	const contentRef = useRef<HTMLDivElement>(null);

	// Get icon for artifact kind
	const getKindIcon = () => {
		switch (kind) {
			case "code":
				return CodeIcon;
			case "image":
				return ImageIcon;
			case "sheet":
				return Table;
			default:
				return FileText;
		}
	};

	const KindIcon = getKindIcon();

	// Copy content to clipboard
	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(content);
			toast.success("Copied to clipboard");
		} catch (_error) {
			toast.error("Failed to copy content");
		}
	}, [content]);

	// Download content as file
	const handleDownload = useCallback(() => {
		const extensions: Record<ArtifactKind, string> = {
			code: getLanguageExtension(metadata.language as string) || "txt",
			image: "png",
			sheet: "csv",
			text: "txt",
		};

		const extension = extensions[kind];
		const filename = `${title}.${extension}`;

		// Create blob and download
		const blob = new Blob([content], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		toast.success(`Downloaded ${filename}`);
	}, [content, title, kind, metadata]);

	// Reset zoom and rotation
	const handleResetView = useCallback(() => {
		setZoom(100);
		setRotation(0);
	}, []);

	// Handle keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ignore if user is typing in an input/textarea
			const target = e.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.contentEditable === "true"
			) {
				return;
			}

			// View mode shortcuts
			if ((e.ctrlKey || e.metaKey) && e.key === "p") {
				e.preventDefault();
				setViewMode("preview");
			}
			if ((e.ctrlKey || e.metaKey) && e.key === "s" && !readOnly) {
				e.preventDefault();
				setViewMode("source");
			}

			// Download shortcut
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "D") {
				e.preventDefault();
				handleDownload();
			}

			// Zoom for images
			if (kind === "image") {
				if ((e.ctrlKey || e.metaKey) && e.key === "=") {
					e.preventDefault();
					setZoom((z) => Math.min(200, z + 10));
				}
				if ((e.ctrlKey || e.metaKey) && e.key === "-") {
					e.preventDefault();
					setZoom((z) => Math.max(50, z - 10));
				}
				if ((e.ctrlKey || e.metaKey) && e.key === "0") {
					e.preventDefault();
					setZoom(100);
					setRotation(0);
				}
				if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "R") {
					e.preventDefault();
					setRotation((r) => (r + 90) % 360);
				}
			}

			// Fullscreen toggle
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
				e.preventDefault();
				setIsFullscreen((f) => !f);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [kind, readOnly, handleDownload]);

	// Render toolbar buttons
	const renderToolbar = () => (
		<div className="flex items-center gap-1 border-b bg-muted/30 p-2">
			{/* View mode buttons */}
			<div className="flex items-center gap-1 rounded-lg border bg-background p-0.5">
				<button
					className={cn(
						"rounded px-2 py-1 font-medium text-xs transition-colors",
						viewMode === "preview"
							? "bg-primary text-primary-foreground"
							: "hover:bg-accent",
					)}
					onClick={() => setViewMode("preview")}
					title="Preview (Ctrl+P)"
				>
					<EyeIcon size={14} />
				</button>
				{!readOnly && (
					<button
						className={cn(
							"rounded px-2 py-1 font-medium text-xs transition-colors",
							viewMode === "source"
								? "bg-primary text-primary-foreground"
								: "hover:bg-accent",
						)}
						onClick={() => setViewMode("source")}
						title="Source (Ctrl+S)"
					>
						<CodeIcon size={14} />
					</button>
				)}
			</div>

			{/* Zoom controls for images */}
			{kind === "image" && (
				<>
					<div className="mx-1 h-4 w-px bg-border" />
					<div className="flex items-center gap-1">
						<button
							className="rounded p-1 transition-colors hover:bg-accent"
							onClick={() => setZoom((z) => Math.min(200, z + 10))}
							title="Zoom in (Ctrl++)"
						>
							<ZoomIn size={14} />
						</button>
						<span className="w-12 text-center text-muted-foreground text-xs">
							{zoom}%
						</span>
						<button
							className="rounded p-1 transition-colors hover:bg-accent"
							onClick={() => setZoom((z) => Math.max(50, z - 10))}
							title="Zoom out (Ctrl+-)"
						>
							<ZoomOut size={14} />
						</button>
						<button
							className="rounded p-1 transition-colors hover:bg-accent"
							onClick={handleResetView}
							title="Reset view (Ctrl+0)"
						>
							<RotateCw size={14} />
						</button>
					</div>
				</>
			)}

			<div className="flex-1" />

			{/* Action buttons */}
			<div className="flex items-center gap-1">
				<button
					className="rounded p-1.5 transition-colors hover:bg-accent"
					onClick={handleCopy}
					title="Copy to clipboard"
				>
					<CopyIcon size={14} />
				</button>
				<button
					className="rounded p-1.5 transition-colors hover:bg-accent"
					onClick={handleDownload}
					title="Download (Ctrl+Shift+D)"
				>
					<DownloadIcon size={14} />
				</button>
				<button
					className="rounded p-1.5 transition-colors hover:bg-accent"
					onClick={() => setIsFullscreen((f) => !f)}
					title={isFullscreen ? "Exit fullscreen" : "Fullscreen (Ctrl+Shift+F)"}
				>
					{isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
				</button>
			</div>
		</div>
	);

	// Render content based on kind and view mode
	const renderContent = () => {
		const baseClassName = "overflow-auto p-4 h-full";
		const style =
			kind === "image"
				? {
						transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
						transformOrigin: "top left",
					}
				: undefined;

		switch (kind) {
			case "image":
				return (
					<div
						className={cn(baseClassName, "flex items-center justify-center")}
						ref={contentRef}
						style={style}
					>
						<img
							alt={title}
							className="max-h-full max-w-full rounded-lg object-contain"
							src={content}
						/>
					</div>
				);

			case "code":
				if (viewMode === "source") {
					return (
						<div
							className={cn(
								baseClassName,
								"whitespace-pre-wrap font-mono text-sm",
							)}
							ref={contentRef}
						>
							{content}
						</div>
					);
				}
				// Preview mode would use syntax highlighting
				return (
					<div className={cn(baseClassName)} ref={contentRef}>
						<pre className="overflow-x-auto font-mono text-sm">
							<code>{content}</code>
						</pre>
					</div>
				);

			case "text":
				if (viewMode === "source") {
					return (
						<div
							className={cn(
								baseClassName,
								"whitespace-pre-wrap font-mono text-sm",
							)}
							ref={contentRef}
						>
							{content}
						</div>
					);
				}
				// Preview mode would use markdown rendering
				return (
					<div
						className={cn(baseClassName, "prose dark:prose-invert max-w-none")}
						ref={contentRef}
					>
						<p className="whitespace-pre-wrap">{content}</p>
					</div>
				);

			case "sheet": {
				// Simple CSV rendering for now
				const lines = content.split("\n");
				const headers = lines[0]?.split(",") || [];
				const rows = lines.slice(1).map((line) => line.split(","));

				return (
					<div
						className={cn(baseClassName, "overflow-x-auto")}
						ref={contentRef}
					>
						<table className="w-full border-collapse text-sm">
							<thead>
								<tr className="border-b">
									{headers.map((header, i) => (
										<th className="p-2 text-left font-medium" key={i}>
											{header}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{rows.map((row, i) => (
									<tr className="border-b" key={i}>
										{row.map((cell, j) => (
											<td className="p-2" key={j}>
												{cell}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				);
			}

			default:
				return (
					<div className={baseClassName} ref={contentRef}>
						{content}
					</div>
				);
		}
	};

	return (
		<div
			className={cn(
				"flex h-full flex-col overflow-hidden rounded-lg border bg-background",
				isFullscreen && "fixed inset-0 z-50 rounded-none",
				className,
			)}
			ref={containerRef}
		>
			{/* Header */}
			<div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
				<KindIcon className="text-muted-foreground" size={16} />
				<span className="flex-1 truncate font-medium text-sm">{title}</span>
			</div>

			{/* Toolbar */}
			{renderToolbar()}

			{/* Content */}
			<div className="relative flex-1 overflow-hidden">
				{renderContent()}

				{/* Image transformation indicator */}
				{kind === "image" && (zoom !== 100 || rotation !== 0) && (
					<div className="absolute right-2 bottom-2 rounded-md border bg-background/80 px-2 py-1 text-muted-foreground text-xs backdrop-blur">
						{zoom}% • {rotation}°
					</div>
				)}
			</div>
		</div>
	);
}

/**
 * Get file extension for programming language
 */
function getLanguageExtension(language: string | undefined): string {
	if (!language) return "txt";

	const extensions: Record<string, string> = {
		javascript: "js",
		typescript: "ts",
		python: "py",
		java: "java",
		c: "c",
		cpp: "cpp",
		csharp: "cs",
		go: "go",
		rust: "rs",
		ruby: "rb",
		php: "php",
		html: "html",
		css: "css",
		json: "json",
		xml: "xml",
		yaml: "yaml",
		yml: "yml",
		markdown: "md",
		sql: "sql",
		shell: "sh",
		bash: "sh",
	};

	return extensions[language.toLowerCase()] || "txt";
}
