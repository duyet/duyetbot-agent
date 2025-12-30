"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import {
	BrainIcon,
	CheckCircle2Icon,
	ChevronDownIcon,
	CircleDotIcon,
	Loader2Icon,
	type LucideIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, memo, useContext, useMemo } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * Chain of Thought display component.
 *
 * Displays a step-by-step reasoning process with visual indicators
 * for each step's status. Great for showing multi-step thinking processes.
 *
 * Features:
 * - Collapsible view for large chains
 * - Visual status indicators (pending, active, complete)
 * - Nested step support
 * - Search result badges
 * - Image preview support
 */

type ChainOfThoughtContextValue = {
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
};

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(
	null,
);

const useChainOfThought = () => {
	const context = useContext(ChainOfThoughtContext);
	if (!context) {
		throw new Error(
			"ChainOfThought components must be used within ChainOfThought",
		);
	}
	return context;
};

export type ChainOfThoughtProps = ComponentProps<"div"> & {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
};

export const ChainOfThought = memo(
	({
		className,
		open,
		defaultOpen = false,
		onOpenChange,
		children,
		...props
	}: ChainOfThoughtProps) => {
		const [isOpen, setIsOpen] = useControllableState({
			prop: open,
			defaultProp: defaultOpen,
			onChange: onOpenChange,
		});

		const chainOfThoughtContext = useMemo(
			() => ({ isOpen, setIsOpen }),
			[isOpen, setIsOpen],
		);

		return (
			<ChainOfThoughtContext.Provider value={chainOfThoughtContext}>
				<Collapsible open={isOpen} onOpenChange={setIsOpen}>
					<div
						className={cn("not-prose max-w-prose space-y-4", className)}
						data-testid="chain-of-thought"
						{...props}
					>
						{children}
					</div>
				</Collapsible>
			</ChainOfThoughtContext.Provider>
		);
	},
);

export type ChainOfThoughtHeaderProps = ComponentProps<
	typeof CollapsibleTrigger
> & {
	title?: ReactNode;
};

export const ChainOfThoughtHeader = memo(
	({ className, children, title, ...props }: ChainOfThoughtHeaderProps) => {
		const { isOpen, setIsOpen } = useChainOfThought();

		return (
			<CollapsibleTrigger
				className={cn(
					"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground",
					className,
				)}
				onClick={() => setIsOpen(!isOpen)}
				{...props}
			>
				<BrainIcon className="size-4" />
				<span className="flex-1 text-left">
					{title ?? children ?? "Chain of Thought"}
				</span>
				<ChevronDownIcon
					className={cn(
						"size-4 transition-transform",
						isOpen ? "rotate-180" : "rotate-0",
					)}
				/>
			</CollapsibleTrigger>
		);
	},
);

export type ChainOfThoughtStepProps = ComponentProps<"div"> & {
	icon?: LucideIcon;
	label: ReactNode;
	description?: ReactNode;
	status?: "pending" | "active" | "complete" | "error";
	children?: ReactNode;
};

const statusIcons = {
	pending: CircleDotIcon,
	active: Loader2Icon,
	complete: CheckCircle2Icon,
	error: CircleDotIcon,
};

const statusColors = {
	pending: "text-muted-foreground/50",
	active: "text-primary animate-spin",
	complete: "text-green-500",
	error: "text-red-500",
};

export const ChainOfThoughtStep = memo(
	({
		className,
		icon: Icon,
		label,
		description,
		status = "complete",
		children,
		...props
	}: ChainOfThoughtStepProps) => {
		const StatusIcon = Icon || statusIcons[status];

		return (
			<div
				className={cn(
					"flex gap-2 text-sm",
					statusColors[status],
					"fade-in-0 slide-in-from-top-2 animate-in",
					className,
				)}
				{...props}
			>
				<div className="relative mt-0.5">
					<StatusIcon className="size-4" />
					<div className="-mx-px absolute top-5 bottom-0 left-1/2 w-px bg-border last:hidden" />
				</div>
				<div className="flex-1 space-y-1 overflow-hidden">
					<div className="font-medium">{label}</div>
					{description && (
						<div className="text-muted-foreground text-xs">{description}</div>
					)}
					{children && <div className="mt-1">{children}</div>}
				</div>
			</div>
		);
	},
);

export type ChainOfThoughtSearchResultsProps = ComponentProps<"div">;

export const ChainOfThoughtSearchResults = memo(
	({ className, ...props }: ChainOfThoughtSearchResultsProps) => (
		<div
			className={cn("flex flex-wrap items-center gap-1.5 mt-1", className)}
			{...props}
		/>
	),
);

export type ChainOfThoughtSearchResultProps = ComponentProps<"span"> & {
	href?: string;
};

export const ChainOfThoughtSearchResult = memo(
	({
		className,
		children,
		href,
		...props
	}: ChainOfThoughtSearchResultProps) => {
		const content = (
			<span
				className={cn(
					"inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-primary text-[10px] font-medium",
					className,
				)}
				{...props}
			>
				{children}
			</span>
		);

		if (href) {
			return (
				<a
					href={href}
					target="_blank"
					rel="noreferrer noopener"
					className="hover:underline"
				>
					{content}
				</a>
			);
		}

		return content;
	},
);

export type ChainOfThoughtContentProps = ComponentProps<
	typeof CollapsibleContent
>;

export const ChainOfThoughtContent = memo(
	({ className, children, ...props }: ChainOfThoughtContentProps) => {
		// Using the hook to ensure context is available, even if not using the value directly
		useChainOfThought();

		return (
			<CollapsibleContent
				className={cn(
					"mt-2 space-y-3",
					"data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
					className,
				)}
				{...props}
			>
				{children}
			</CollapsibleContent>
		);
	},
);

export type ChainOfThoughtImageProps = ComponentProps<"div"> & {
	caption?: string;
};

export const ChainOfThoughtImage = memo(
	({ className, children, caption, ...props }: ChainOfThoughtImageProps) => (
		<div className={cn("mt-2 space-y-2", className)} {...props}>
			<div className="relative flex max-h-[22rem] items-center justify-center overflow-hidden rounded-lg bg-muted p-3">
				{children}
			</div>
			{caption && <p className="text-muted-foreground text-xs">{caption}</p>}
		</div>
	),
);

ChainOfThought.displayName = "ChainOfThought";
ChainOfThoughtHeader.displayName = "ChainOfThoughtHeader";
ChainOfThoughtStep.displayName = "ChainOfThoughtStep";
ChainOfThoughtSearchResults.displayName = "ChainOfThoughtSearchResults";
ChainOfThoughtSearchResult.displayName = "ChainOfThoughtSearchResult";
ChainOfThoughtContent.displayName = "ChainOfThoughtContent";
ChainOfThoughtImage.displayName = "ChainOfThoughtImage";
