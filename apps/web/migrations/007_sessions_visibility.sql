-- Add visibility column to sessions table
ALTER TABLE sessions ADD COLUMN visibility TEXT DEFAULT 'private' CHECK(visibility IN ('private', 'public'));
CREATE INDEX IF NOT EXISTS idx_sessions_visibility ON sessions(visibility);
