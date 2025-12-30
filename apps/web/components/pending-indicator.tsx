/**
 * Visual indicator for pending optimistic operations.
 *
 * Shows a small indicator when an optimistic update is in progress,
 * allowing users to see that their action is being processed.
 */

import type { PendingOperation } from "@/hooks/use-optimistic-update";
import { cn } from "@/lib/utils";

/**
 * Props for the pending indicator
 */
export interface PendingIndicatorProps {
	operations: PendingOperation[];
	className?: string;
	position?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
}

/**
 * Get icon for operation type
 */
function getOperationIcon(type: PendingOperation["type"]): string {
	switch (type) {
		case "append":
			return "➕";
		case "update":
			return "✏️";
		case "delete":
			return "🗑️";
		case "regenerate":
			return "🔄";
		default:
			return "⏳";
	}
}

/**
 * Get label for operation type
 */
function getOperationLabel(type: PendingOperation["type"]): string {
	switch (type) {
		case "append":
			return "Sending...";
		case "update":
			return "Updating...";
		case "delete":
			return "Deleting...";
		case "regenerate":
			return "Regenerating...";
		default:
			return "Processing...";
	}
}

/**
 * Pending operation indicator component
 *
 * Displays a small badge showing the number of pending operations
 * and a tooltip with details.
 */
export function PendingIndicator({
	operations,
	className,
	position = "bottom-right",
}: PendingIndicatorProps) {
	if (operations.length === 0) {
		return null;
	}

	const positionClasses = {
		"top-right": "top-4 right-4",
		"bottom-right": "bottom-4 right-4",
		"top-left": "top-4 left-4",
		"bottom-left": "bottom-4 left-4",
	};

	const latestOperation = operations[operations.length - 1];

	return (
		<div
			className={cn(
				"fixed z-50 flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs backdrop-blur-sm",
				"border border-primary/20 shadow-sm",
				"animate-in fade-in slide-in-from-bottom-2 duration-200",
				positionClasses[position],
				className,
			)}
			title={`${operations.length} pending ${operations.length === 1 ? "operation" : "operations"}: ${operations.map((op) => getOperationLabel(op.type)).join(", ")}`}
		>
			{/* Animated loading spinner */}
			<span className="relative flex h-3 w-3">
				<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
				<span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
			</span>

			{/* Operation icon */}
			<span className="text-[10px]" aria-hidden="true">
				{getOperationIcon(latestOperation.type)}
			</span>

			{/* Count */}
			<span className="font-medium text-primary">
				{operations.length}{" "}
				{operations.length === 1 ? "operation" : "operations"}
			</span>

			{/* Latest operation label */}
			<span className="text-muted-foreground">
				{getOperationLabel(latestOperation.type)}
			</span>
		</div>
	);
}

/**
 * Inline pending indicator for message-level operations
 */
export function MessagePendingIndicator({
	type,
	className,
}: {
	type: PendingOperation["type"];
	className?: string;
}) {
	return (
		<div
			className={cn(
				"inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs",
				"bg-muted/50 text-muted-foreground",
				className,
			)}
		>
			<span className="relative flex h-2 w-2">
				<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
				<span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
			</span>
			<span>{getOperationLabel(type)}</span>
		</div>
	);
}

/**
 * Rollback warning banner - shown when operation failed and rollback is pending
 */
export function RollbackWarning({
	operation,
	onCancelRollback,
	timeRemaining,
	className,
}: {
	operation: PendingOperation;
	onCancelRollback?: () => void;
	timeRemaining?: number;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400",
				className,
			)}
		>
			<span className="text-amber-500" aria-hidden="true">
				⚠️
			</span>
			<div className="flex-1">
				<p className="font-medium">Operation failed</p>
				<p className="text-xs opacity-80">
					{getOperationLabel(operation.type)} failed. Rolling back...
					{timeRemaining !== undefined && ` ${timeRemaining}s`}
				</p>
			</div>
			{onCancelRollback && (
				<button
					type="button"
					onClick={onCancelRollback}
					className="text-xs underline hover:text-amber-600 dark:hover:text-amber-300"
				>
					Cancel rollback
				</button>
			)}
		</div>
	);
}
