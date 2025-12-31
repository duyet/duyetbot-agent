-- Migration to add GitHub OAuth support to User table
-- Since SQLite doesn't support adding UNIQUE columns, we need to recreate the table

-- Create new User table with all columns
CREATE TABLE `User_new` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password` text,
	`name` text,
	`githubId` text UNIQUE,
	`createdAt` integer NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
	`updatedAt` integer NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
--> statement-breakpoint
-- Copy existing data to new table
INSERT INTO `User_new` (id, email, password, createdAt, updatedAt)
SELECT id, email, password, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000 FROM `User`;
--> statement-breakpoint
-- Drop old table
DROP TABLE `User`;
--> statement-breakpoint
-- Rename new table
ALTER TABLE `User_new` RENAME TO `User`;

