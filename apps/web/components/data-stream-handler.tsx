"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { initialArtifactData, useArtifact } from "@/hooks/use-artifact";
import { type ArtifactKind, artifactDefinitions } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { getChatHistoryPaginationKey } from "./sidebar-history";

// Valid artifact kinds for type-safe assertion
const VALID_ARTIFACT_KINDS: Set<string> = new Set([
	"code",
	"image",
	"text",
	"sheet",
]);

function isValidArtifactKind(value: unknown): value is ArtifactKind {
	return typeof value === "string" && VALID_ARTIFACT_KINDS.has(value);
}

export function DataStreamHandler() {
	const { dataStream, setDataStream } = useDataStream();
	const { mutate } = useSWRConfig();

	const { artifact, setArtifact, setMetadata } = useArtifact();

	useEffect(() => {
		if (!dataStream?.length) {
			return;
		}

		const newDeltas = dataStream.slice();
		setDataStream([]);

		for (const delta of newDeltas) {
			try {
				// Handle chat title updates
				if (delta.type === "data-chat-title") {
					mutate(unstable_serialize(getChatHistoryPaginationKey));
					continue;
				}

				const artifactDefinition = artifactDefinitions.find(
					(currentArtifactDefinition) =>
						currentArtifactDefinition.kind === artifact.kind,
				);

				if (artifactDefinition?.onStreamPart) {
					try {
						artifactDefinition.onStreamPart({
							streamPart: delta,
							setArtifact,
							setMetadata,
						});
					} catch (error) {
						console.error(
							`[DataStreamHandler] Error in onStreamPart for kind "${artifact.kind}":`,
							error,
						);
					}
				}

				setArtifact((draftArtifact) => {
					if (!draftArtifact) {
						return { ...initialArtifactData, status: "streaming" };
					}

					switch (delta.type) {
						case "data-id":
							return {
								...draftArtifact,
								documentId: delta.data,
								status: "streaming",
							};

						case "data-title":
							return {
								...draftArtifact,
								title: delta.data,
								status: "streaming",
							};

						case "data-kind": {
							// Validate artifact kind before updating
							if (!isValidArtifactKind(delta.data)) {
								console.warn(
									`[DataStreamHandler] Invalid artifact kind: ${delta.data}`,
								);
								return draftArtifact;
							}
							return {
								...draftArtifact,
								kind: delta.data,
								status: "streaming",
							};
						}

						case "data-clear":
							return {
								...draftArtifact,
								content: "",
								status: "streaming",
							};

						case "data-finish":
							return {
								...draftArtifact,
								status: "idle",
							};

						default:
							return draftArtifact;
					}
				});
			} catch (error) {
				// Catch any unexpected errors during delta processing
				console.error("[DataStreamHandler] Error processing delta:", {
					delta,
					error: error instanceof Error ? error.message : error,
				});
				// Don't crash - continue processing remaining deltas
			}
		}
	}, [dataStream, setArtifact, setMetadata, artifact, setDataStream, mutate]);

	return null;
}
