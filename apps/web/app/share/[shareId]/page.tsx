"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { chartArtifact } from "@/artifacts/chart/client";
import { codeArtifact } from "@/artifacts/code/client";
import { imageArtifact } from "@/artifacts/image/client";
import { sheetArtifact } from "@/artifacts/sheet/client";
import { textArtifact } from "@/artifacts/text/client";
import { SidebarLeftIcon } from "@/components/icons";
import { getSharedArtifact } from "@/lib/api-client";
import type { Document } from "@/lib/db/schema";

// Artifact definitions for content rendering
const artifactDefinitions = [
	textArtifact,
	codeArtifact,
	imageArtifact,
	sheetArtifact,
	chartArtifact,
] as const;

type ArtifactKind = (typeof artifactDefinitions)[number]["kind"];

type SharedArtifactState = {
	document: Document | null;
	isLoading: boolean;
	error: string | null;
};

export default function SharedArtifactPage() {
	const params = useParams();
	const shareId = params.shareId as string;

	const [state, setState] = useState<SharedArtifactState>({
		document: null,
		isLoading: true,
		error: null,
	});

	useEffect(() => {
		async function loadArtifact() {
			if (!shareId) {
				setState({
					document: null,
					isLoading: false,
					error: "Invalid share link",
				});
				return;
			}

			setState((prev) => ({ ...prev, isLoading: true, error: null }));

			const documents = await getSharedArtifact({ shareId });

			if (!documents || documents.length === 0) {
				setState({
					document: null,
					isLoading: false,
					error: "Artifact not found or link has expired",
				});
				return;
			}

			// Get the most recent document version
			const latestDocument = documents.at(-1) as Document;

			setState({
				document: latestDocument,
				isLoading: false,
				error: null,
			});
		}

		loadArtifact();
	}, [shareId]);

	if (state.isLoading) {
		return (
			<div className="flex h-dvh w-dvw items-center justify-center bg-background">
				<div className="text-center">
					<div className="text-muted-foreground mb-4 text-lg">
						Loading artifact...
					</div>
					<div className="text-muted-foreground text-sm">Please wait</div>
				</div>
			</div>
		);
	}

	if (state.error || !state.document) {
		return (
			<div className="flex h-dvh w-dvw items-center justify-center bg-background">
				<div className="max-w-md text-center">
					<div className="mb-4 text-6xl">🔗</div>
					<h1 className="mb-2 text-2xl font-semibold">
						{state.error || "Artifact not found"}
					</h1>
					<p className="text-muted-foreground mb-6">
						This shared artifact may have been deleted or the link has expired.
					</p>
					<a
						href="/"
						className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
					>
						<SidebarLeftIcon size={16} />
						Back to DuyetBot
					</a>
				</div>
			</div>
		);
	}

	const { document } = state;
	const kind = document.kind as ArtifactKind;

	const artifactDefinition = artifactDefinitions.find(
		(definition) => definition.kind === kind,
	);

	if (!artifactDefinition) {
		return (
			<div className="flex h-dvh w-dvw items-center justify-center bg-background">
				<div className="text-center">
					<h1 className="mb-2 text-2xl font-semibold">
						Unsupported artifact type
					</h1>
					<p className="text-muted-foreground mb-6">
						Artifact type "{kind}" is not supported.
					</p>
					<a
						href="/"
						className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
					>
						<SidebarLeftIcon size={16} />
						Back to DuyetBot
					</a>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-dvh w-dvw flex-col bg-background">
			{/* Header */}
			<header className="flex items-center justify-between border-b px-4 py-3 md:px-6">
				<div className="flex items-center gap-3">
					<a
						href="/"
						className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 transition-colors"
					>
						<SidebarLeftIcon size={18} />
						<span className="hidden md:inline">Back</span>
					</a>
					<div className="h-6 w-px bg-border" />
					<div>
						<h1 className="font-semibold">{document.title}</h1>
						<p className="text-muted-foreground text-sm">
							Shared artifact • {kind}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<a
						href="/"
						className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
					>
						<span className="hidden sm:inline">Try DuyetBot Chat</span>
						<span className="text-lg">↗</span>
					</a>
				</div>
			</header>

			{/* Content */}
			<div className="flex-1 overflow-y-auto">
				<artifactDefinition.content
					content={document.content ?? ""}
					currentVersionIndex={0}
					isCurrentVersion={true}
					isInline={false}
					isLoading={false}
					metadata={undefined as any}
					mode="edit"
					onSaveContent={() => {}}
					setMetadata={() => {}}
					status="idle"
					suggestions={[]}
					title={document.title}
					getDocumentContentById={() => ""}
				/>
			</div>

			{/* Footer */}
			<footer className="border-t px-4 py-3 text-center md:px-6">
				<p className="text-muted-foreground text-sm">
					Shared via{" "}
					<a href="/" className="hover:text-foreground underline">
						DuyetBot
					</a>{" "}
					• Create your own AI-generated artifacts
				</p>
			</footer>
		</div>
	);
}
