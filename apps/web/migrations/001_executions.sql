-- Create executions table to track token usage per execution
CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  finish_reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Index for querying executions by session_id
CREATE INDEX IF NOT EXISTS idx_executions_session_id ON executions(session_id);

-- Index for querying executions by user_id
CREATE INDEX IF NOT EXISTS idx_executions_user_id ON executions(user_id);

-- Index for querying executions by created_at (for ordering)
CREATE INDEX IF NOT EXISTS idx_executions_created_at ON executions(created_at DESC);
