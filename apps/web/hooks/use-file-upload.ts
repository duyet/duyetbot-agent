import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Attachment } from "@/lib/types";

interface UseFileUploadOptions {
	onAttachmentsChange: (attachments: Attachment[] | ((prev: Attachment[]) => Attachment[])) => void;
}

interface UseFileUploadReturn {
	uploadQueue: string[];
	handleFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
	handlePaste: (event: ClipboardEvent) => Promise<void>;
}

/**
 * Hook for handling file uploads in chat input.
 * Manages file upload queue, file selection, and paste-to-upload functionality.
 */
export function useFileUpload({
	onAttachmentsChange,
}: UseFileUploadOptions): UseFileUploadReturn {
	const [uploadQueue, setUploadQueue] = useState<string[]>([]);

	const uploadFile = useCallback(async (file: File) => {
		const formData = new FormData();
		formData.append("file", file);

		try {
			const response = await fetch("/api/files/upload", {
				method: "POST",
				body: formData,
			});

			if (response.ok) {
				const data = (await response.json()) as {
					url: string;
					pathname: string;
					contentType: string;
				};
				const { url, pathname, contentType } = data;

				return {
					url,
					name: pathname,
					contentType,
				};
			}
			const { error } = (await response.json()) as { error: string };
			toast.error(error);
		} catch (_error) {
			toast.error("Failed to upload file, please try again!");
		}
	}, []);

	const handleFileChange = useCallback(
		async (event: ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(event.target.files || []);

			setUploadQueue(files.map((file) => file.name));

			try {
				const uploadPromises = files.map((file) => uploadFile(file));
				const uploadedAttachments = await Promise.all(uploadPromises);
				const successfullyUploadedAttachments = uploadedAttachments.filter(
					(attachment): attachment is Attachment => attachment !== undefined,
				);

				onAttachmentsChange((currentAttachments) => [
					...currentAttachments,
					...successfullyUploadedAttachments,
				]);

				// Show success toast for uploaded files
				if (successfullyUploadedAttachments.length > 0) {
					const count = successfullyUploadedAttachments.length;
					toast.success(
						count === 1
							? "File uploaded successfully"
							: `${count} files uploaded successfully`,
					);
				}
			} catch (error) {
				console.error("Error uploading files!", error);
				toast.error("Failed to upload files");
			} finally {
				setUploadQueue([]);
			}
		},
		[onAttachmentsChange, uploadFile],
	);

	const handlePaste = useCallback(
		async (event: ClipboardEvent) => {
			const items = event.clipboardData?.items;
			if (!items) {
				return;
			}

			const imageItems = Array.from(items).filter((item) =>
				item.type.startsWith("image/"),
			);

			if (imageItems.length === 0) {
				return;
			}

			// Prevent default paste behavior for images
			event.preventDefault();

			setUploadQueue((prev) => [...prev, "Pasted image"]);

			try {
				const uploadPromises = imageItems
					.map((item) => item.getAsFile())
					.filter((file): file is File => file !== null)
					.map((file) => uploadFile(file));

				const uploadedAttachments = await Promise.all(uploadPromises);
				const successfullyUploadedAttachments = uploadedAttachments.filter(
					(attachment) =>
						attachment !== undefined &&
						attachment.url !== undefined &&
						attachment.contentType !== undefined,
				);

				onAttachmentsChange((curr) => [
					...curr,
					...(successfullyUploadedAttachments as Attachment[]),
				]);
			} catch (error) {
				console.error("Error uploading pasted images:", error);
				toast.error("Failed to upload pasted image(s)");
			} finally {
				setUploadQueue([]);
			}
		},
		[onAttachmentsChange, uploadFile],
	);

	return {
		uploadQueue,
		handleFileChange,
		handlePaste,
	};
}
