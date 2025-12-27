import { type Dispatch, memo, type SetStateAction, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { artifactDefinitions, type UIArtifact } from "./artifact";
import type { ArtifactActionContext } from "./create-artifact";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

function getActionErrorMessage(
	error: unknown,
	actionDescription: string,
): string {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		if (message.includes("network") || message.includes("fetch")) {
			return "Network error. Please check your connection and try again.";
		}
		if (message.includes("timeout")) {
			return "The action timed out. Please try again.";
		}
		if (message.includes("permission") || message.includes("denied")) {
			return "Permission denied. You may not have access to perform this action.";
		}
	}
	return `Failed to ${actionDescription.toLowerCase()}. Please try again.`;
}

type ArtifactActionsProps = {
	artifact: UIArtifact;
	handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
	currentVersionIndex: number;
	isCurrentVersion: boolean;
	mode: "edit" | "diff";
	metadata: any;
	setMetadata: Dispatch<SetStateAction<any>>;
};

function PureArtifactActions({
	artifact,
	handleVersionChange,
	currentVersionIndex,
	isCurrentVersion,
	mode,
	metadata,
	setMetadata,
}: ArtifactActionsProps) {
	const [isLoading, setIsLoading] = useState(false);

	const artifactDefinition = artifactDefinitions.find(
		(definition) => definition.kind === artifact.kind,
	);

	if (!artifactDefinition) {
		console.warn(
			`[ArtifactActions] No definition found for artifact kind: ${artifact.kind}`,
		);
		return null;
	}

	const actionContext: ArtifactActionContext = {
		content: artifact.content,
		handleVersionChange,
		currentVersionIndex,
		isCurrentVersion,
		mode,
		metadata,
		setMetadata,
	};

	return (
		<div className="flex flex-row gap-1">
			{artifactDefinition.actions.map((action) => (
				<Tooltip key={action.description}>
					<TooltipTrigger asChild>
						<Button
							className={cn("h-fit dark:hover:bg-zinc-700", {
								"p-2": !action.label,
								"px-2 py-1.5": action.label,
							})}
							disabled={
								isLoading || artifact.status === "streaming"
									? true
									: action.isDisabled
										? action.isDisabled(actionContext)
										: false
							}
							onClick={async () => {
								setIsLoading(true);

								try {
									await Promise.resolve(action.onClick(actionContext));
								} catch (error) {
									const errorMessage = getActionErrorMessage(
										error,
										action.description,
									);
									toast.error(errorMessage);
									console.error(
										`[ArtifactAction] Failed to execute "${action.description}":`,
										error,
									);
								} finally {
									setIsLoading(false);
								}
							}}
							variant="outline"
						>
							{action.icon}
							{action.label}
						</Button>
					</TooltipTrigger>
					<TooltipContent>{action.description}</TooltipContent>
				</Tooltip>
			))}
		</div>
	);
}

export const ArtifactActions = memo(
	PureArtifactActions,
	(prevProps, nextProps) => {
		if (prevProps.artifact.status !== nextProps.artifact.status) {
			return false;
		}
		if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex) {
			return false;
		}
		if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) {
			return false;
		}
		if (prevProps.artifact.content !== nextProps.artifact.content) {
			return false;
		}

		return true;
	},
);
