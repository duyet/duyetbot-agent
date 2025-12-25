-- Migration: 003_user_settings
-- Description: Create user settings table for model, tools, and preferences

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY NOT NULL,
  default_model TEXT NOT NULL DEFAULT 'xiaomi/mimo-v2-flash:free',
  enabled_tools TEXT NOT NULL DEFAULT '[]', -- JSON array
  theme TEXT DEFAULT 'system',
  accent_color TEXT DEFAULT '#e65100',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
