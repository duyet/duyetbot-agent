-- Migration: Add folders and tags for chat organization
-- Description: Create ChatFolder, ChatToFolder, ChatTag, and ChatToTag tables

-- Create chat folders table
CREATE TABLE IF NOT EXISTS `ChatFolder` (
  `id` TEXT PRIMARY KEY,
  `name` TEXT NOT NULL,
  `userId` TEXT NOT NULL,
  `color` TEXT NOT NULL DEFAULT '#3b82f6',
  `createdAt` INTEGER NOT NULL,
  `updatedAt` INTEGER NOT NULL,
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create chat to folder junction table
CREATE TABLE IF NOT EXISTS `ChatToFolder` (
  `chatId` TEXT NOT NULL,
  `folderId` TEXT NOT NULL,
  `createdAt` INTEGER NOT NULL,
  PRIMARY KEY (`chatId`, `folderId`),
  FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY (`folderId`) REFERENCES `ChatFolder`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create chat tags table
CREATE TABLE IF NOT EXISTS `ChatTag` (
  `id` TEXT PRIMARY KEY,
  `name` TEXT NOT NULL UNIQUE,
  `userId` TEXT NOT NULL,
  `color` TEXT NOT NULL DEFAULT '#10b981',
  `createdAt` INTEGER NOT NULL,
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create chat to tag junction table
CREATE TABLE IF NOT EXISTS `ChatToTag` (
  `chatId` TEXT NOT NULL,
  `tagId` TEXT NOT NULL,
  `createdAt` INTEGER NOT NULL,
  PRIMARY KEY (`chatId`, `tagId`),
  FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY (`tagId`) REFERENCES `ChatTag`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS `chat_folder_user_id_idx` ON `ChatFolder`(`userId`);
CREATE INDEX IF NOT EXISTS `chat_to_folder_chat_id_idx` ON `ChatToFolder`(`chatId`);
CREATE INDEX IF NOT EXISTS `chat_to_folder_folder_id_idx` ON `ChatToFolder`(`folderId`);
CREATE INDEX IF NOT EXISTS `chat_tag_user_id_idx` ON `ChatTag`(`userId`);
CREATE INDEX IF NOT EXISTS `chat_to_tag_chat_id_idx` ON `ChatToTag`(`chatId`);
CREATE INDEX IF NOT EXISTS `chat_to_tag_tag_id_idx` ON `ChatToTag`(`tagId`);
