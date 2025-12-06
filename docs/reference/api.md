---
title: API Reference
description: Complete endpoint documentation including authentication, user management, chat, webhooks, and MCP memory
---

**Related:** [Getting Started](getting-started.md) | [Architecture](architecture.md) | [Deployment](deploy.md)

Complete API reference for duyetbot-agent endpoints.

---

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: `https://your-domain.com`

---

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### OAuth Endpoints

#### Start GitHub OAuth

```http
POST /auth/github
```

Returns OAuth URL for GitHub login.

#### GitHub OAuth Callback

```http
GET /auth/github/callback?code=<code>&state=<state>
```

Handles OAuth callback and returns access/refresh tokens.

#### Start Google OAuth

```http
POST /auth/google
```

Returns OAuth URL for Google login.

#### Google OAuth Callback

```http
GET /auth/google/callback?code=<code>&state=<state>
```

Handles OAuth callback and returns access/refresh tokens.

#### Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "your_refresh_token"
}
```

Returns new access token.

#### Logout

```http
POST /auth/logout
Authorization: Bearer <token>
```

Invalidates current session.

---

## User Management

#### Get Current User

```http
GET /users/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://...",
  "provider": "github",
  "created_at": "2024-01-01T00:00:00Z",
  "settings": {}
}
```

#### Update User

```http
PATCH /users/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Name",
  "settings": {
    "default_provider": "claude:claude-3-5-sonnet-20241022"
  }
}
```

#### Delete Account

```http
DELETE /users/me
Authorization: Bearer <token>
```

Deletes user and all associated data (GDPR compliant).

#### List Sessions

```http
GET /users/me/sessions
Authorization: Bearer <token>
```

Returns all active sessions for the user.

#### Revoke All Sessions

```http
DELETE /users/me/sessions
Authorization: Bearer <token>
```

Invalidates all sessions except current.

---

## Agent Interaction

#### Send Message

```http
POST /agent/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Help me debug this error",
  "session_id": "optional_session_id",
  "provider": "claude:claude-3-5-sonnet-20241022"
}
```

**Response:** Server-Sent Events (SSE) stream

```
event: message
data: {"type": "text", "content": "I'll help you..."}

event: message
data: {"type": "tool_use", "name": "bash", "input": {"command": "ls"}}

event: done
data: {"session_id": "session_123"}
```

#### List Chat Sessions

```http
GET /agent/sessions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "sessions": [
    {
      "id": "session_123",
      "title": "Debug Error",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T01:00:00Z",
      "message_count": 10
    }
  ]
}
```

#### Get Session Details

```http
GET /agent/sessions/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "session_123",
  "title": "Debug Error",
  "messages": [
    {
      "role": "user",
      "content": "Help me debug this error"
    },
    {
      "role": "assistant",
      "content": "I'll help you..."
    }
  ],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T01:00:00Z"
}
```

#### Delete Session

```http
DELETE /agent/sessions/:id
Authorization: Bearer <token>
```

#### Query Memory

```http
GET /agent/memory?query=<search_term>&limit=10
Authorization: Bearer <token>
```

Searches across all sessions for relevant context.

---

## Health Checks

#### Basic Health

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### Readiness Probe

```http
GET /health/ready
```

Returns 200 if all dependencies are ready.

#### Liveness Probe

```http
GET /health/live
```

Returns 200 if service is alive.

#### Database Health

```http
GET /health/db
```

Checks D1 database connectivity.

#### KV Health

```http
GET /health/kv
```

Checks KV store connectivity.

---

## GitHub Webhook

#### Webhook Handler

```http
POST /webhook
X-Hub-Signature-256: sha256=<signature>
X-GitHub-Event: <event_type>
Content-Type: application/json

{
  // GitHub webhook payload
}
```

Handles GitHub events (issue_comment, pull_request, etc.).

---

## MCP Memory Server

The MCP memory server provides session persistence.

#### List Sessions

```http
GET /api/sessions
Authorization: Bearer <token>
```

#### Get Session

```http
GET /api/sessions/:id
Authorization: Bearer <token>
```

#### Create/Update Session

```http
PUT /api/sessions/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "messages": [...],
  "metadata": {}
}
```

#### Delete Session

```http
DELETE /api/sessions/:id
Authorization: Bearer <token>
```

#### Search Sessions

```http
GET /api/sessions/search?q=<query>
Authorization: Bearer <token>
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

- **Default**: 100 requests/minute per user
- **Agent chat**: 20 requests/minute
- **OAuth**: 10 requests/minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  picture TEXT,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  settings TEXT,
  UNIQUE(provider, provider_id)
);
```

### Sessions Table

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  messages TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

---

## Next Steps

- [Getting Started](GETTING_STARTED.md) - Installation guide
- [Architecture](ARCHITECTURE.md) - System design
- [Deployment](DEPLOY.md) - Production deployment
