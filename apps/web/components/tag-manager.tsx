"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SessionMetadata } from "@/lib/session-persistence";
import { cn } from "@/lib/utils";
import {
	CheckIcon,
	Edit2Icon,
	FolderIcon,
	FolderOpenIcon,
	PlusIcon,
	TagIcon,
	Trash2Icon,
	XIcon,
} from "./icons";

/**
 * Folder structure
 */
export interface Folder {
	id: string;
	name: string;
	icon?: string;
	color?: string;
	chatCount: number;
	createdAt: string;
}

/**
 * Tag structure
 */
export interface Tag {
	id: string;
	name: string;
	color?: string;
	chatCount: number;
	createdAt: string;
}

/**
 * Storage keys
 */
const STORAGE_KEYS = {
	FOLDERS: "chat-folders",
	TAGS: "chat-tags",
	CHAT_METADATA: "chat-session-metadata",
} as const;

/**
 * Tag manager component
 *
 * Features:
 * - Create and manage tags
 * - Create and manage folders
 * - Assign tags and folders to chats
 * - Color customization
 */
export function TagManager({ chatId }: { chatId: string }) {
	const [isOpen, setIsOpen] = useState(false);
	const [activeTab, setActiveTab] = useState<"tags" | "folders">("tags");
	const [tags, setTags] = useState<Tag[]>([]);
	const [folders, setFolders] = useState<Folder[]>([]);
	const [chatMetadata, setChatMetadata] = useState<SessionMetadata>({});

	useEffect(() => {
		if (isOpen) {
			loadData();
		}
	}, [isOpen, chatId]);

	const loadData = useCallback(() => {
		// Load tags
		const storedTags = localStorage.getItem(STORAGE_KEYS.TAGS);
		if (storedTags) {
			setTags(JSON.parse(storedTags));
		}

		// Load folders
		const storedFolders = localStorage.getItem(STORAGE_KEYS.FOLDERS);
		if (storedFolders) {
			setFolders(JSON.parse(storedFolders));
		}

		// Load chat metadata
		const storedMetadata = localStorage.getItem(
			`${STORAGE_KEYS.CHAT_METADATA}:${chatId}`,
		);
		if (storedMetadata) {
			setChatMetadata(JSON.parse(storedMetadata));
		}
	}, [chatId]);

	return (
		<Dialog onOpenChange={setIsOpen} open={isOpen}>
			<DialogTrigger asChild>
				<Button size="icon" title="Manage tags & folders" variant="ghost">
					<TagIcon size={18} />
				</Button>
			</DialogTrigger>

			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Organize</DialogTitle>
					<DialogDescription>
						Add tags and folders to organize your conversations
					</DialogDescription>
				</DialogHeader>

				{/* Tabs */}
				<div className="flex gap-2 border-b">
					<button
						className={cn(
							"px-4 py-2 font-medium text-sm transition-colors",
							activeTab === "tags"
								? "border-primary border-b-2 text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
						onClick={() => setActiveTab("tags")}
					>
						Tags
					</button>
					<button
						className={cn(
							"px-4 py-2 font-medium text-sm transition-colors",
							activeTab === "folders"
								? "border-primary border-b-2 text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
						onClick={() => setActiveTab("folders")}
					>
						Folders
					</button>
				</div>

				{activeTab === "tags" ? (
					<TagList
						chatId={chatId}
						chatTags={chatMetadata.tags || []}
						onTagsChange={loadData}
						tags={tags}
					/>
				) : (
					<FolderList
						chatFolderId={chatMetadata.folderId}
						chatId={chatId}
						folders={folders}
						onFoldersChange={loadData}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

/**
 * Tag list component
 */
interface TagListProps {
	tags: Tag[];
	chatTags: string[];
	onTagsChange: () => void;
	chatId: string;
}

function TagList({ tags, chatTags, onTagsChange, chatId }: TagListProps) {
	const [newTagName, setNewTagName] = useState("");
	const [isCreating, setIsCreating] = useState(false);

	const createTag = useCallback(() => {
		if (!newTagName.trim()) return;

		const newTag: Tag = {
			id: generateId(),
			name: newTagName.trim(),
			color: getRandomColor(),
			chatCount: 0,
			createdAt: new Date().toISOString(),
		};

		const updated = [...tags, newTag];
		localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(updated));
		setNewTagName("");
		setIsCreating(false);
		onTagsChange();
	}, [newTagName, tags, onTagsChange]);

	const toggleTag = useCallback(
		(tagId: string) => {
			const metadata = JSON.parse(
				localStorage.getItem(`${STORAGE_KEYS.CHAT_METADATA}:${chatId}`) || "{}",
			);

			const currentTags = metadata.tags || [];
			const updated = currentTags.includes(tagId)
				? currentTags.filter((t: string) => t !== tagId)
				: [...currentTags, tagId];

			metadata.tags = updated;
			localStorage.setItem(
				`${STORAGE_KEYS.CHAT_METADATA}:${chatId}`,
				JSON.stringify(metadata),
			);
			onTagsChange();
		},
		[chatId, onTagsChange],
	);

	const deleteTag = useCallback(
		(tagId: string) => {
			const updated = tags.filter((t) => t.id !== tagId);
			localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(updated));

			// Remove from all chats
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key?.startsWith(`${STORAGE_KEYS.CHAT_METADATA}:`)) {
					const metadata = JSON.parse(localStorage.getItem(key) || "{}");
					if (metadata.tags?.includes(tagId)) {
						metadata.tags = metadata.tags.filter((t: string) => t !== tagId);
						localStorage.setItem(key, JSON.stringify(metadata));
					}
				}
			}

			onTagsChange();
		},
		[tags, onTagsChange],
	);

	return (
		<div className="space-y-4">
			{/* Create tag input */}
			{isCreating ? (
				<div className="flex gap-2">
					<Input
						autoFocus
						onChange={(e) => setNewTagName(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && createTag()}
						placeholder="Tag name..."
						value={newTagName}
					/>
					<Button onClick={createTag} size="icon">
						<CheckIcon size={14} />
					</Button>
					<Button
						onClick={() => {
							setIsCreating(false);
							setNewTagName("");
						}}
						size="icon"
						variant="ghost"
					>
						<XIcon size={14} />
					</Button>
				</div>
			) : (
				<Button
					className="w-full justify-start"
					onClick={() => setIsCreating(true)}
					variant="outline"
				>
					<PlusIcon className="mr-2" size={14} />
					Create tag
				</Button>
			)}

			{/* Tag list */}
			<ScrollArea className="h-[300px]">
				<div className="space-y-2">
					{tags.length === 0 ? (
						<p className="py-8 text-center text-muted-foreground text-sm">
							No tags yet. Create one to get started.
						</p>
					) : (
						tags.map((tag) => {
							const isAssigned = chatTags.includes(tag.id);
							return (
								<div
									className="group flex items-center gap-2 rounded-lg p-2 hover:bg-accent"
									key={tag.id}
								>
									<button
										className="flex flex-1 items-center gap-2 text-left"
										onClick={() => toggleTag(tag.id)}
									>
										<div
											className="h-3 w-3 rounded-full"
											style={{ backgroundColor: tag.color }}
										/>
										<span className="flex-1">{tag.name}</span>
										<span className="text-muted-foreground text-xs">
											{tag.chatCount}
										</span>
									</button>

									{isAssigned && (
										<CheckIcon className="text-green-500" size={14} />
									)}

									<Button
										className="h-6 w-6 opacity-0 group-hover:opacity-100"
										onClick={() => deleteTag(tag.id)}
										size="icon"
										variant="ghost"
									>
										<Trash2Icon size={12} />
									</Button>
								</div>
							);
						})
					)}
				</div>
			</ScrollArea>
		</div>
	);
}

/**
 * Folder list component
 */
interface FolderListProps {
	folders: Folder[];
	chatFolderId?: string;
	onFoldersChange: () => void;
	chatId: string;
}

function FolderList({
	folders,
	chatFolderId,
	onFoldersChange,
	chatId,
}: FolderListProps) {
	const [newFolderName, setNewFolderName] = useState("");
	const [isCreating, setIsCreating] = useState(false);

	const createFolder = useCallback(() => {
		if (!newFolderName.trim()) return;

		const newFolder: Folder = {
			id: generateId(),
			name: newFolderName.trim(),
			icon: "folder",
			color: getRandomColor(),
			chatCount: 0,
			createdAt: new Date().toISOString(),
		};

		const updated = [...folders, newFolder];
		localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(updated));
		setNewFolderName("");
		setIsCreating(false);
		onFoldersChange();
	}, [newFolderName, folders, onFoldersChange]);

	const selectFolder = useCallback(
		(folderId: string | undefined) => {
			const metadata = JSON.parse(
				localStorage.getItem(`${STORAGE_KEYS.CHAT_METADATA}:${chatId}`) || "{}",
			);

			if (folderId) {
				metadata.folderId = folderId;
			} else {
				delete metadata.folderId;
			}

			localStorage.setItem(
				`${STORAGE_KEYS.CHAT_METADATA}:${chatId}`,
				JSON.stringify(metadata),
			);
			onFoldersChange();
		},
		[chatId, onFoldersChange],
	);

	const deleteFolder = useCallback(
		(folderId: string) => {
			const updated = folders.filter((f) => f.id !== folderId);
			localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(updated));

			// Remove from all chats
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key?.startsWith(`${STORAGE_KEYS.CHAT_METADATA}:`)) {
					const metadata = JSON.parse(localStorage.getItem(key) || "{}");
					if (metadata.folderId === folderId) {
						delete metadata.folderId;
						localStorage.setItem(key, JSON.stringify(metadata));
					}
				}
			}

			onFoldersChange();
		},
		[folders, onFoldersChange],
	);

	return (
		<div className="space-y-4">
			{/* Create folder input */}
			{isCreating ? (
				<div className="flex gap-2">
					<Input
						autoFocus
						onChange={(e) => setNewFolderName(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && createFolder()}
						placeholder="Folder name..."
						value={newFolderName}
					/>
					<Button onClick={createFolder} size="icon">
						<CheckIcon size={14} />
					</Button>
					<Button
						onClick={() => {
							setIsCreating(false);
							setNewFolderName("");
						}}
						size="icon"
						variant="ghost"
					>
						<XIcon size={14} />
					</Button>
				</div>
			) : (
				<Button
					className="w-full justify-start"
					onClick={() => setIsCreating(true)}
					variant="outline"
				>
					<PlusIcon className="mr-2" size={14} />
					Create folder
				</Button>
			)}

			{/* Folder list */}
			<ScrollArea className="h-[300px]">
				<div className="space-y-2">
					{/* No folder option */}
					<button
						className={cn(
							"flex w-full items-center gap-2 rounded-lg p-2",
							"text-left transition-colors hover:bg-accent",
							!chatFolderId && "bg-accent",
						)}
						onClick={() => selectFolder(undefined)}
					>
						<FolderIcon size={16} />
						<span className="flex-1">No folder</span>
					</button>

					{folders.map((folder) => {
						const isSelected = folder.id === chatFolderId;
						return (
							<div
								className={cn(
									"flex items-center gap-2 rounded-lg p-2",
									"group transition-colors hover:bg-accent",
									isSelected && "bg-accent",
								)}
								key={folder.id}
							>
								<button
									className="flex flex-1 items-center gap-2 text-left"
									onClick={() => selectFolder(folder.id)}
								>
									<span style={{ color: folder.color }}>
										<FolderIcon size={16} />
									</span>
									<span className="flex-1">{folder.name}</span>
									<span className="text-muted-foreground text-xs">
										{folder.chatCount}
									</span>
								</button>

								{isSelected && (
									<CheckIcon className="text-green-500" size={14} />
								)}

								<Button
									className="h-6 w-6 opacity-0 group-hover:opacity-100"
									onClick={() => deleteFolder(folder.id)}
									size="icon"
									variant="ghost"
								>
									<Trash2Icon size={12} />
								</Button>
							</div>
						);
					})}
				</div>
			</ScrollArea>
		</div>
	);
}

/**
 * Tag badge component
 */
export function TagBadge({ tagId }: { tagId: string }) {
	const [tag, setTag] = useState<Tag | null>(null);

	useEffect(() => {
		const tags = JSON.parse(
			localStorage.getItem(STORAGE_KEYS.TAGS) || "[]",
		) as Tag[];
		const found = tags.find((t) => t.id === tagId);
		setTag(found || null);
	}, [tagId]);

	if (!tag) return null;

	return (
		<Badge
			className="gap-1"
			style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
			variant="secondary"
		>
			<TagIcon size={10} />
			{tag.name}
		</Badge>
	);
}

/**
 * Folder badge component
 */
export function FolderBadge({ folderId }: { folderId: string }) {
	const [folder, setFolder] = useState<Folder | null>(null);

	useEffect(() => {
		const folders = JSON.parse(
			localStorage.getItem(STORAGE_KEYS.FOLDERS) || "[]",
		) as Folder[];
		const found = folders.find((f) => f.id === folderId);
		setFolder(found || null);
	}, [folderId]);

	if (!folder) return null;

	return (
		<Badge
			className="gap-1"
			style={{ borderColor: folder.color, color: folder.color }}
			variant="outline"
		>
			<FolderIcon size={10} />
			{folder.name}
		</Badge>
	);
}

/**
 * Generate random ID
 */
function generateId(): string {
	return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get random color for tags/folders
 */
function getRandomColor(): string {
	const colors = [
		"#ef4444", // red
		"#f97316", // orange
		"#eab308", // yellow
		"#22c55e", // green
		"#06b6d4", // cyan
		"#3b82f6", // blue
		"#8b5cf6", // violet
		"#ec4899", // pink
	];
	return colors[Math.floor(Math.random() * colors.length)];
}
