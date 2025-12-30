-- Migration to add database indexes for query optimization
-- These indexes significantly improve performance for common query patterns
-- Note: Only indexes for existing tables are included (ChatFolder/ChatTag tables not yet deployed)

-- User table indexes
-- Speeds up login/registration lookups by email
CREATE INDEX IF NOT EXISTS `idx_user_email` ON `User` (`email`);

-- Chat table indexes
-- Composite index for getChatsByUserId: WHERE userId = ? ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS `idx_chat_user_created` ON `Chat` (`userId`, `createdAt` DESC);

-- Index for finding chats by visibility (public chats for sharing)
CREATE INDEX IF NOT EXISTS `idx_chat_visibility` ON `Chat` (`visibility`);

-- Message_v2 table indexes
-- Composite index for getMessagesByChatId: WHERE chatId = ? ORDER BY createdAt ASC
CREATE INDEX IF NOT EXISTS `idx_message_chat_created` ON `Message_v2` (`chatId`, `createdAt` ASC);

-- Index for message role filtering (user messages for rate limiting)
CREATE INDEX IF NOT EXISTS `idx_message_role` ON `Message_v2` (`role`);

-- Vote_v2 table indexes
-- Index for getVotesByChatId: WHERE chatId = ?
CREATE INDEX IF NOT EXISTS `idx_vote_chat` ON `Vote_v2` (`chatId`);

-- Stream table indexes
-- Composite index for getStreamIdsByChatId: WHERE chatId = ? ORDER BY createdAt ASC
CREATE INDEX IF NOT EXISTS `idx_stream_chat_created` ON `Stream` (`chatId`, `createdAt` ASC);

-- Document table indexes
-- Index for getDocumentsById: WHERE id = ? ORDER BY createdAt ASC
CREATE INDEX IF NOT EXISTS `idx_document_id_created` ON `Document` (`id`, `createdAt` ASC);

-- Index for documents by user
CREATE INDEX IF NOT EXISTS `idx_document_user` ON `Document` (`userId`);

-- Suggestion table indexes
-- Index for getSuggestionsByDocumentId: WHERE documentId = ?
CREATE INDEX IF NOT EXISTS `idx_suggestion_document` ON `Suggestion` (`documentId`);

-- Index for suggestions by user
CREATE INDEX IF NOT EXISTS `idx_suggestion_user` ON `Suggestion` (`userId`);

-- Note: Indexes for ChatFolder, ChatToFolder, ChatTag, ChatToTag tables
-- will be added when those tables are created in a future migration
