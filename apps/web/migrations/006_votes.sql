-- Votes table for message feedback
CREATE TABLE IF NOT EXISTS votes (
  session_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  is_upvoted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  PRIMARY KEY (session_id, message_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_votes_session_id ON votes(session_id);
