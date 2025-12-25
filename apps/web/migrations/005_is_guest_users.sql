-- Migration: 005_is_guest_users
-- Description: Add is_guest column to users table for guest user support

ALTER TABLE users ADD COLUMN is_guest INTEGER DEFAULT 0;
