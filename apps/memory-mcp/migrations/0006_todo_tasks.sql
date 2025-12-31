-- Migration: 0006_todo_tasks
-- Description: Add task/todo support to memory_long_term table with task-specific columns
-- This enables per-user todo lists with status tracking, priorities, due dates, and tags

-- Add task-specific columns to existing memory_long_term table
ALTER TABLE memory_long_term ADD COLUMN status TEXT DEFAULT 'pending';
ALTER TABLE memory_long_term ADD COLUMN priority INTEGER DEFAULT 5;
ALTER TABLE memory_long_term ADD COLUMN due_date INTEGER;
ALTER TABLE memory_long_term ADD COLUMN completed_at INTEGER;
ALTER TABLE memory_long_term ADD COLUMN parent_task_id TEXT;
ALTER TABLE memory_long_term ADD COLUMN tags TEXT; -- JSON array string

-- Create indexes for efficient task queries
-- Category index for filtering tasks
CREATE INDEX IF NOT EXISTS idx_memory_long_term_tasks
ON memory_long_term(user_id, category)
WHERE category = 'task';

-- Status index for filtering by task state
CREATE INDEX IF NOT EXISTS idx_memory_long_term_task_status
ON memory_long_term(user_id, status)
WHERE category = 'task';

-- Due date index for time-based queries
CREATE INDEX IF NOT EXISTS idx_memory_long_term_task_due
ON memory_long_term(user_id, due_date)
WHERE category = 'task' AND due_date IS NOT NULL;

-- Parent task index for subtask queries
CREATE INDEX IF NOT EXISTS idx_memory_long_term_task_parent
ON memory_long_term(user_id, parent_task_id)
WHERE category = 'task' AND parent_task_id IS NOT NULL;
