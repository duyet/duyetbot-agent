import { useState } from "react";
import { toast } from "sonner";
import { CopyIcon, ShareIcon } from "@/components/icons";
import { createArtifactShare } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";

interface ShareArtifactDialogProps {
	documentId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Dialog for sharing artifacts with a shareable link
 */
export function ShareArtifactDialog({
	documentId,
	open,
	onOpenChange,
}: ShareArtifactDialogProps) {
	const [shareUrl, setShareUrl] = useState<string>("");
	const [isCreating, setIsCreating] = useState(false);
	const [copied, setCopied] = useState(false);

	const handleCreateShare = async () => {
		setIsCreating(true);
		try {
			const result = await createArtifactShare({ documentId });
			if (result?.shareUrl) {
				setShareUrl(result.shareUrl);
			} else {
				toast.error("Failed to create share link");
			}
		} finally {
			setIsCreating(false);
		}
	};

	const handleCopy = () => {
		if (shareUrl) {
			navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			toast.success("Link copied to clipboard!");
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<ShareIcon size={18} />
						Share Artifact
					</DialogTitle>
					<DialogDescription>
						Create a shareable link to this artifact. Anyone with the link can
						view it.
					</DialogDescription>
				</DialogHeader>

				<div className="py-4">
					{!shareUrl ? (
						<Button
							className="w-full"
							disabled={isCreating}
							onClick={handleCreateShare}
							variant="default"
						>
							{isCreating ? "Creating link..." : "Create Share Link"}
						</Button>
					) : (
						<div className="flex gap-2">
							<Input className="flex-1" readOnly value={shareUrl} />
							<Button
								className={cn(
									"shrink-0",
									copied && "bg-green-600 hover:bg-green-700",
								)}
								onClick={handleCopy}
								variant="outline"
							>
								{copied ? "Copied!" : <CopyIcon size={16} />}
							</Button>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} variant="ghost">
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
