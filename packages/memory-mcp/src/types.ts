import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ENVIRONMENT: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

export interface User {
  id: string;
  github_id: string;
  github_login: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  created_at: number;
  updated_at: number;
}

export interface Session {
  id: string;
  user_id: string;
  title: string | null;
  state: 'active' | 'paused' | 'completed';
  created_at: number;
  updated_at: number;
  metadata: Record<string, unknown> | null;
}

export interface SessionToken {
  token: string;
  user_id: string;
  expires_at: number;
  created_at: number;
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface AuthResult {
  user_id: string;
  session_token: string;
  expires_at: number;
}

export interface MemoryData {
  session_id: string;
  messages: LLMMessage[];
  metadata: Record<string, unknown>;
}

export interface SaveMemoryResult {
  session_id: string;
  saved_count: number;
  updated_at: number;
}

export interface SearchResult {
  session_id: string;
  message: LLMMessage;
  score: number;
  context: LLMMessage[];
}

export interface SessionListItem {
  id: string;
  title: string | null;
  state: string;
  created_at: number;
  updated_at: number;
  message_count: number;
}
