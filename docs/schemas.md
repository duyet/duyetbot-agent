---
title: MCP Tool Schemas
desc: Zod schemas for memory-mcp tools: authenticate/get/save/list/search. Input/output tables/examples.
sidebar_position: 1
keywords: [mcp,memory,zod,schema,authenticate]
slug: /api-reference/mcp-tools/schemas
---

<!-- i18n: en -->

# MCP Tool Schemas ✅

**TL;DR**: Zod-validated inputs. Auth → GitHub token → session. CRUD sessions/messages.

## Table of Contents
- [authenticate](#authenticate)
- [get-memory](#get-memory)
- [save-memory](#save-memory)
- [list-sessions](#list-sessions)
- [search-memory](#search-memory)
- [Auth Flow](#auth-flow)

## authenticate [`authenticate.ts`](apps/memory-mcp/src/tools/authenticate.ts:11)

**Input**:

| Param | Type | Req | Desc |
|-------|------|-----|------|
| github_token | string | opt | Direct token |
| oauth_code | string | opt | OAuth flow |

```typescript
const authenticateSchema = z.object({
  github_token: z.string().optional(),
  oauth_code: z.string().optional(),
});
```

**Output**: `{user_id, session_token, expires_at}`

**Example**:

```json
{"github_token": "ghp_ABC123"}
// → {"user_id": "user_123", "session_token": "sess_XYZ", "expires_at": 1735689600000}
```

## get-memory [`get-memory.ts`](apps/memory-mcp/src/tools/get-memory.ts:5)

| Param | Type | Req | Desc |
|-------|------|-----|------|
| session_id | string | ✅ | Session |
| limit | number | opt | Paginate |
| offset | number | opt | Paginate |

**Output**: `{session_id, messages[], metadata}`

## save-memory [`save-memory.ts`](apps/memory-mcp/src/tools/save-memory.ts:13)

| Param | Type | Req | Desc |
|-------|------|-----|------|
| session_id | string | opt | Create/update |
| messages | LLMMessage[] | ✅ | History |
| metadata | object | opt | Extra |

**Output**: `{session_id, saved_count, updated_at}`

## list-sessions [`list-sessions.ts`](apps/memory-mcp/src/tools/list-sessions.ts:5)

| Param | Type | Req | Desc |
|-------|------|-----|------|
| limit | number | opt=20 | Paginate |
| offset | number | opt=0 | Paginate |
| state | enum | opt | active/paused/completed |

**Output**: `{sessions[], total}`

## search-memory [`search-memory.ts`](apps/memory-mcp/src/tools/search-memory.ts:5)

| Param | Type | Req | Desc |
|-------|------|-----|------|
| query | string | ✅ | Search term |
| limit | number | opt=10 | Results |
| filter | object | opt | session/date |

**Output**: `{results[]}` w/ score/context

## Auth Flow

```mermaid
graph LR
  Client[Client] --> Auth[authenticate(github_token)]
  Auth --> Session[Create session_token]
  Session --> Tools[get/save/list/search]
  Tools --> D1[memory_* tables]
```

**Quiz**: No token? → ?
A: Error: token required ✅

**Use**: Connect MCP → `use_mcp_tool('memory-mcp', 'authenticate', {...})`

**Related**: [Tables →](./tables.md)