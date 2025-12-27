-- Migration: Add chat branching and sharing features
-- Description: Add parent_chat_id, branch_point, share_id, and share_token columns to Chat table

-- Add branching columns
ALTER TABLE `Chat` ADD COLUMN `parentChatId` TEXT;
ALTER TABLE `Chat` ADD COLUMN `branchPoint` INTEGER;

-- Add sharing columns
ALTER TABLE `Chat` ADD COLUMN `shareId` TEXT UNIQUE;
ALTER TABLE `Chat` ADD COLUMN `shareToken` TEXT;

-- Create index for parent chat lookups
CREATE INDEX IF NOT EXISTS `chat_parent_chat_id_idx` ON `Chat`(`parentChatId`);

-- Create index for shared chat lookups
CREATE INDEX IF NOT EXISTS `chat_share_id_idx` ON `Chat`(`shareId`);
