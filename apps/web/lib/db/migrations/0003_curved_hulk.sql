CREATE TABLE `CustomTool` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`inputSchema` text NOT NULL,
	`actionType` text NOT NULL,
	`actionConfig` text NOT NULL,
	`needsApproval` integer DEFAULT false NOT NULL,
	`isEnabled` integer DEFAULT true NOT NULL,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_Chat` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`title` text NOT NULL,
	`userId` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`parentChatId` text,
	`branchPoint` integer,
	`shareId` text,
	`shareToken` text,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parentChatId`) REFERENCES `Chat`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_Chat`("id", "createdAt", "title", "userId", "visibility", "parentChatId", "branchPoint", "shareId", "shareToken") SELECT "id", "createdAt", "title", "userId", "visibility", "parentChatId", "branchPoint", "shareId", "shareToken" FROM `Chat`;--> statement-breakpoint
DROP TABLE `Chat`;--> statement-breakpoint
ALTER TABLE `__new_Chat` RENAME TO `Chat`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `Chat_shareId_unique` ON `Chat` (`shareId`);--> statement-breakpoint
DROP INDEX IF EXISTS `idx_user_email`;--> statement-breakpoint
CREATE UNIQUE INDEX `User_githubId_unique` ON `User` (`githubId`);--> statement-breakpoint
DROP INDEX IF EXISTS `idx_message_chat_created`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_message_role`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_vote_chat`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_stream_chat_created`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_document_id_created`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_document_user`;--> statement-breakpoint
ALTER TABLE `Document` ADD `shareId` text;--> statement-breakpoint
ALTER TABLE `Document` ADD `shareToken` text;--> statement-breakpoint
ALTER TABLE `Document` ADD `isPublic` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `Document_shareId_unique` ON `Document` (`shareId`);--> statement-breakpoint
DROP INDEX IF EXISTS `idx_suggestion_document`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_suggestion_user`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_folder_user`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_chat_folder_folder`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_tag_user`;--> statement-breakpoint
CREATE UNIQUE INDEX `ChatTag_name_unique` ON `ChatTag` (`name`);--> statement-breakpoint
DROP INDEX IF EXISTS `idx_chat_tag_tag`;