"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type PanelPosition = "left" | "right";

export interface ResizablePanelsProps {
	/**
	 * Initial width of the resizable panel in pixels
	 * @default 400
	 */
	initialWidth?: number;

	/**
	 * Minimum width of the resizable panel in pixels
	 * @default 300
	 */
	minWidth?: number;

	/**
	 * Maximum width of the resizable panel in pixels
	 * @default 800
	 */
	maxWidth?: number;

	/**
	 * Which panel is resizable
	 * @default "left"
	 */
	resizablePanel?: PanelPosition;

	/**
	 * Additional class names
	 */
	className?: string;

	/**
	 * Children should be an array of two elements: [leftPanel, rightPanel]
	 */
	children: [React.ReactNode, React.ReactNode];
}

/**
 * Resizable split-panel component with drag handle
 *
 * Features:
 * - Smooth drag-to-resize with mouse and touch support
 * - Collapsible panels with keyboard shortcuts
 * - Persistent width storage in localStorage
 * - Responsive design (mobile defaults to stacked layout)
 */
export function ResizablePanels({
	initialWidth = 400,
	minWidth = 300,
	maxWidth = 800,
	resizablePanel = "left",
	className,
	children,
}: ResizablePanelsProps) {
	const [leftPanel, rightPanel] = children;
	const [panelWidth, setPanelWidth] = useState(initialWidth);
	const [isResizing, setIsResizing] = useState(false);
	const [isCollapsed, setIsCollapsed] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const dragHandleRef = useRef<HTMLDivElement>(null);

	// Load saved width from localStorage on mount
	useEffect(() => {
		const savedWidth = localStorage.getItem("resizable-panel-width");
		if (savedWidth) {
			const width = Number.parseInt(savedWidth, 10);
			if (width >= minWidth && width <= maxWidth) {
				setPanelWidth(width);
			}
		}
	}, [minWidth, maxWidth]);

	// Save width to localStorage when it changes
	useEffect(() => {
		if (!isResizing && !isCollapsed) {
			localStorage.setItem("resizable-panel-width", panelWidth.toString());
		}
	}, [panelWidth, isResizing, isCollapsed]);

	// Handle keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Toggle panel collapse with Ctrl/Cmd + [
			if ((e.ctrlKey || e.metaKey) && e.key === "[") {
				e.preventDefault();
				setIsCollapsed((prev) => !prev);
			}

			// Reset to default width with Ctrl/Cmd + \
			if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
				e.preventDefault();
				setIsCollapsed(false);
				setPanelWidth(initialWidth);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [initialWidth]);

	const handleMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		setIsResizing(true);

		const startX = e.clientX;
		const startWidth = panelWidth;

		const handleMouseMove = (e: MouseEvent) => {
			const deltaX =
				resizablePanel === "left" ? e.clientX - startX : startX - e.clientX;

			const newWidth = Math.max(
				minWidth,
				Math.min(maxWidth, startWidth + deltaX),
			);

			setPanelWidth(newWidth);
		};

		const handleMouseUp = () => {
			setIsResizing(false);
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
	};

	const handleTouchStart = (e: React.TouchEvent) => {
		e.preventDefault();
		setIsResizing(true);

		const startX = e.touches[0].clientX;
		const startWidth = panelWidth;

		const handleTouchMove = (e: TouchEvent) => {
			const deltaX =
				resizablePanel === "left"
					? e.touches[0].clientX - startX
					: startX - e.touches[0].clientX;

			const newWidth = Math.max(
				minWidth,
				Math.min(maxWidth, startWidth + deltaX),
			);

			setPanelWidth(newWidth);
		};

		const handleTouchEnd = () => {
			setIsResizing(false);
			document.removeEventListener("touchmove", handleTouchMove);
			document.removeEventListener("touchend", handleTouchEnd);
		};

		document.addEventListener("touchmove", handleTouchMove);
		document.addEventListener("touchend", handleTouchEnd);
	};

	// On mobile, render stacked layout
	return (
		<div
			className={cn(
				"flex h-full flex-col md:flex-row",
				isResizing && "cursor-col-resize",
				className,
			)}
			ref={containerRef}
		>
			{/* Left Panel */}
			<div
				className={cn(
					"flex-shrink-0 overflow-hidden",
					"transition-all duration-200 ease-out",
					isCollapsed && "w-0 opacity-0",
					!isCollapsed && resizablePanel === "left" && "md:border-r",
					isResizing && "transition-none",
				)}
				style={
					!isCollapsed && resizablePanel === "left"
						? { width: `${panelWidth}px` }
						: undefined
				}
			>
				{leftPanel}
			</div>

			{/* Drag Handle (desktop only, between panels) */}
			{resizablePanel === "left" && (
				<>
					<div
						className={cn(
							"hidden md:block",
							"relative z-10 shrink-0",
							"cursor-col-resize",
							"hover:bg-accent",
							"transition-colors",
							isResizing && "bg-accent",
							isCollapsed && "cursor-pointer",
						)}
						onClick={() => {
							if (isCollapsed) {
								setIsCollapsed(false);
							}
						}}
						onMouseDown={handleMouseDown}
						onTouchStart={handleTouchStart}
						ref={dragHandleRef}
						style={{ width: "4px" }}
					>
						{/* Visual drag indicator */}
						<div className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2">
							<div
								className={cn(
									"flex flex-col gap-0.5",
									"opacity-0 transition-opacity hover:opacity-100",
									isResizing && "opacity-100",
								)}
							>
								<div className="h-4 w-0.5 rounded-full bg-muted-foreground/40" />
								<div className="h-4 w-0.5 rounded-full bg-muted-foreground/40" />
							</div>
						</div>

						{/* Collapse button (visible on hover) */}
						{isCollapsed && (
							<button
								aria-label="Expand panel"
								className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 rounded-full border bg-background p-1 shadow-md hover:bg-accent"
								onClick={() => setIsCollapsed(false)}
							>
								<svg
									className="h-4 w-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										d="M15 19l-7-7 7-7"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
									/>
								</svg>
							</button>
						)}
					</div>

					{/* Expand button (visible when collapsed) */}
					{isCollapsed && (
						<button
							aria-label="Expand panel"
							className="-translate-y-1/2 fixed top-1/2 left-0 z-20 rounded-r-lg border border-l-0 bg-background p-2 shadow-md hover:bg-accent"
							onClick={() => setIsCollapsed(false)}
						>
							<svg
								className="h-4 w-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									d="M9 5l7 7-7 7"
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
								/>
							</svg>
						</button>
					)}
				</>
			)}

			{/* Right Panel */}
			<div
				className={cn(
					"flex-1 overflow-hidden",
					"transition-all duration-200 ease-out",
					isCollapsed && "flex-1",
					isResizing && "transition-none",
				)}
			>
				{rightPanel}
			</div>
		</div>
	);
}

/**
 * Hook to get panel width from Ref
 * Useful for child components that need to know their container size
 */
export function usePanelWidth(
	containerRef: RefObject<HTMLElement>,
): number | null {
	const [width, setWidth] = useState<number | null>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setWidth(entry.contentRect.width);
			}
		});

		resizeObserver.observe(container);

		return () => resizeObserver.disconnect();
	}, [containerRef]);

	return width;
}
