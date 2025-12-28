# DuyetBot Web Architecture

This document describes the architecture of the DuyetBot Web application, a modern AI chat interface built on Cloudflare Workers.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Browser                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Next.js   │  │  AI SDK     │  │   Pyodide   │  │  SWR Cache  │     │
│  │  Static UI  │  │   React     │  │   (WASM)    │  │             │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
└─────────┼────────────────┼────────────────┼────────────────┼────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge Network                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     Hono API Worker                              │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │    │
│  │  │   Auth   │  │   Chat   │  │  Tools   │  │   Files  │        │    │
│  │  │  Routes  │  │  Routes  │  │  Routes  │  │  Routes  │        │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │    │
│  └───────┼─────────────┼─────────────┼─────────────┼───────────────┘    │
│          │             │             │             │                     │
│  ┌───────▼─────────────▼─────────────▼─────────────▼───────────────┐    │
│  │                     Cloudflare Bindings                          │    │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐    │    │
│  │  │   D1   │  │   KV   │  │   R2   │  │   AI   │  │ Assets │    │    │
│  │  │  (DB)  │  │ (Rate) │  │(Files) │  │Gateway │  │(Static)│    │    │
│  │  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          External Services                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  OpenRouter  │  │  Duyet MCP   │  │   GitHub     │                   │
│  │   (LLMs)     │  │   Server     │  │   OAuth      │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend (Next.js Static Export)

The frontend is a statically exported Next.js application served via Cloudflare Workers Assets.

```
┌────────────────────────────────────────────────────────────────┐
│                    Frontend Components                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    App Layout                            │   │
│  │  ┌─────────────┐  ┌─────────────────────────────────┐   │   │
│  │  │   Sidebar   │  │         Main Content            │   │   │
│  │  │  ┌───────┐  │  │  ┌─────────────────────────┐   │   │   │
│  │  │  │History│  │  │  │        Chat.tsx         │   │   │   │
│  │  │  ├───────┤  │  │  │  ┌───────────────────┐  │   │   │   │
│  │  │  │Folders│  │  │  │  │   Messages.tsx    │  │   │   │   │
│  │  │  ├───────┤  │  │  │  ├───────────────────┤  │   │   │   │
│  │  │  │ Tags  │  │  │  │  │  Message.tsx (n)  │  │   │   │   │
│  │  │  └───────┘  │  │  │  └───────────────────┘  │   │   │   │
│  │  └─────────────┘  │  │  ┌───────────────────┐  │   │   │   │
│  │                   │  │  │MultimodalInput.tsx│  │   │   │   │
│  │                   │  │  └───────────────────┘  │   │   │   │
│  │                   │  └─────────────────────────┘   │   │   │
│  │                   └─────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Artifact System                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │  Text    │ │  Code    │ │  Sheet   │ │  Chart   │   │   │
│  │  │Artifact  │ │Artifact  │ │Artifact  │ │Artifact  │   │   │
│  │  │(Prose-   │ │(Pyodide) │ │(DataGrid)│ │(Recharts)│   │   │
│  │  │ Mirror)  │ │          │ │          │ │          │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### Backend (Hono Worker)

The backend is a Hono-based API running on Cloudflare Workers.

```
┌────────────────────────────────────────────────────────────────┐
│                      Hono Worker                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Middleware Stack                      │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌───────┐ │   │
│  │  │ Logger │→│ CORS   │→│Secure  │→│ Cache  │→│ Auth  │ │   │
│  │  │        │ │        │ │Headers │ │        │ │       │ │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └───────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────▼─────────────────────────────┐   │
│  │                     Route Handlers                       │   │
│  │                                                          │   │
│  │  /api/auth/*     → authRoutes      (login, register,    │   │
│  │                                      OAuth, session)     │   │
│  │  /api/chat/*     → chatRoutes      (streaming, CRUD,    │   │
│  │                                      branching)          │   │
│  │  /api/history/*  → historyRoutes   (pagination, delete) │   │
│  │  /api/document/* → documentRoutes  (artifacts)          │   │
│  │  /api/files/*    → filesRoutes     (R2 upload)          │   │
│  │  /api/vote/*     → voteRoutes      (feedback)           │   │
│  │  /api/tools/*    → customToolsRouter (CRUD)             │   │
│  │  /api/docs/*     → docsRouter      (OpenAPI, Swagger)   │   │
│  │  /health         → health check                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────▼─────────────────────────────┐   │
│  │                   Service Layer                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │  AI Service  │  │ Auth Service │  │ Rate Limiter │   │   │
│  │  │  (stream,    │  │  (JWT, CSRF) │  │ (KV-based)   │   │   │
│  │  │   fallback)  │  │              │  │              │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Chat Message Flow

```
┌──────┐    ┌─────────┐    ┌──────────┐    ┌───────────┐    ┌────────┐
│Client│───▶│POST /api│───▶│Rate Limit│───▶│   Auth    │───▶│  Chat  │
│      │    │  /chat  │    │  Check   │    │Middleware │    │Handler │
└──────┘    └─────────┘    └──────────┘    └───────────┘    └────┬───┘
                                                                  │
    ┌─────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         Chat Handler                                  │
│  1. Parse messages and attachments                                   │
│  2. Load custom instructions                                         │
│  3. Build context with tool definitions                              │
│  4. Call AI provider (OpenRouter via AI Gateway)                     │
│  5. Stream response with tool calls                                  │
│  6. Execute tools (web_search, url_fetch, duyet_mcp, etc.)          │
│  7. Save messages to D1                                              │
│  8. Generate title if first message                                  │
└──────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Response Streaming                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Text    │  │  Tool    │  │ Artifact │  │ Metadata │            │
│  │  Delta   │  │  Result  │  │  Delta   │  │ (tokens) │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
└──────────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Authentication Methods                            │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Email/Password                              │  │
│  │  Client → POST /api/auth/login → PBKDF2 verify → JWT token   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   GitHub OAuth                                │  │
│  │  Client → /api/auth/github → GitHub → Callback → JWT token  │  │
│  │                    ↓                     ↓                    │  │
│  │              State param           Verify state               │  │
│  │            (CSRF protect)          Exchange code              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Guest Session                               │  │
│  │  Client → /api/auth/guest → Auto-create user → JWT token     │  │
│  │                              Rate limit: 10 msgs/day          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Token Storage                               │  │
│  │  Bearer Token: Authorization header (preferred)               │  │
│  │  Cookie: session cookie (fallback for backward compat)        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema

```
┌─────────────────────────────────────────────────────────────────────┐
│                        D1 Database Schema                            │
│                                                                      │
│  ┌──────────────┐       ┌──────────────┐       ┌──────────────┐    │
│  │     User     │       │     Chat     │       │   Message    │    │
│  ├──────────────┤       ├──────────────┤       ├──────────────┤    │
│  │ id (PK)      │◄──────│ userId (FK)  │       │ id (PK)      │    │
│  │ email        │       │ id (PK)      │◄──────│ chatId (FK)  │    │
│  │ passwordHash │       │ title        │       │ role         │    │
│  │ isGuest      │       │ visibility   │       │ parts (JSON) │    │
│  │ createdAt    │       │ createdAt    │       │ createdAt    │    │
│  └──────────────┘       │ parentId     │       └──────────────┘    │
│         │               │ branchPoint  │              │             │
│         │               └──────────────┘              │             │
│         │                      │                      │             │
│         │               ┌──────▼───────┐       ┌──────▼───────┐    │
│         │               │   Document   │       │     Vote     │    │
│         │               ├──────────────┤       ├──────────────┤    │
│         │               │ id (PK)      │       │ chatId (FK)  │    │
│         │               │ chatId (FK)  │       │ messageId(FK)│    │
│         │               │ kind         │       │ type (up/dn) │    │
│         │               │ content      │       └──────────────┘    │
│         │               └──────────────┘                            │
│         │                                                           │
│  ┌──────▼───────┐       ┌──────────────┐       ┌──────────────┐    │
│  │  CustomTool  │       │    Folder    │       │     Tag      │    │
│  ├──────────────┤       ├──────────────┤       ├──────────────┤    │
│  │ id (PK)      │       │ id (PK)      │       │ id (PK)      │    │
│  │ userId (FK)  │       │ userId (FK)  │       │ userId (FK)  │    │
│  │ name         │       │ name         │       │ name         │    │
│  │ description  │       │ parentId     │       │ color        │    │
│  │ inputSchema  │       └──────────────┘       └──────────────┘    │
│  │ actionType   │                                                   │
│  │ actionConfig │                                                   │
│  └──────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Tool System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI Tool System                                │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Built-in Tools                            │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐   │   │
│  │  │web_search │ │ url_fetch │ │ duyet_mcp │ │getWeather │   │   │
│  │  │(DuckDuck) │ │(HTML→txt) │ │(8 actions)│ │(OpenMeteo)│   │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘   │   │
│  │  ┌───────────┐ ┌───────────┐                               │   │
│  │  │   plan    │ │scratchpad │  Tool Approval UI:            │   │
│  │  │(task list)│ │(KV notes) │  - url_fetch                  │   │
│  │  └───────────┘ └───────────┘  - getWeather                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────▼─────────────────────────────────┐   │
│  │                    Custom Tools                              │   │
│  │  ┌───────────────────────────────────────────────────────┐  │   │
│  │  │              CustomToolExecutor                        │  │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │   │
│  │  │  │ HTTP Fetch  │  │  MCP Call   │  │    Code     │   │  │   │
│  │  │  │ (template   │  │ (external   │  │ Execution   │   │  │   │
│  │  │  │  {{params}})│  │  server)    │  │(browser via │   │  │   │
│  │  │  │             │  │             │  │  Pyodide)   │   │  │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘   │  │   │
│  │  └───────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────▼─────────────────────────────────┐   │
│  │                 Tool Visualizers                             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │ Search   │ │ Weather  │ │  Plan    │ │Scratchpad│       │   │
│  │  │ Results  │ │ Display  │ │ Viewer   │ │ Editor   │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Rate Limiting Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Rate Limiting System                              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  Identifier Resolution                       │   │
│  │                                                              │   │
│  │  Authenticated User → user:{userId}                          │   │
│  │  Guest User        → session:{sessionToken}                  │   │
│  │  Unauthenticated   → ip:{clientIP}                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────▼─────────────────────────────────┐   │
│  │                   Token Bucket (KV)                          │   │
│  │                                                              │   │
│  │  Key: rate:{identifier}:{limiterName}                        │   │
│  │  Value: { count: number, resetAt: timestamp }                │   │
│  │  TTL: Matches rate limit window                              │   │
│  │                                                              │   │
│  │  Limiters:                                                   │   │
│  │  ┌────────────────────┬─────────────┬───────────────────┐   │   │
│  │  │      Type          │   Limit     │      Window       │   │   │
│  │  ├────────────────────┼─────────────┼───────────────────┤   │   │
│  │  │ Guest Chat         │ 10 msgs     │ 24 hours          │   │   │
│  │  │ Auth Chat          │ 60 msgs     │ 1 minute          │   │   │
│  │  │ Auth Attempts      │ 5 attempts  │ 5 minutes         │   │   │
│  │  │ API Requests       │ 100 reqs    │ 1 minute          │   │   │
│  │  └────────────────────┴─────────────┴───────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────▼─────────────────────────────────┐   │
│  │                    Error Response                            │   │
│  │                                                              │   │
│  │  HTTP 429 Too Many Requests                                  │   │
│  │  Headers: Retry-After, X-RateLimit-Remaining                │   │
│  │  Body: { error, resetAt, resetInSeconds }                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Cloudflare Deployment                             │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Build Pipeline                             │   │
│  │                                                              │   │
│  │  1. next build     → Static export to /out                   │   │
│  │  2. wrangler deploy → Upload to Workers + Assets             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────▼─────────────────────────────────┐   │
│  │                   Runtime Flow                               │   │
│  │                                                              │   │
│  │  Request → Edge Location → Worker                           │   │
│  │                              │                               │   │
│  │              ┌───────────────┼───────────────┐               │   │
│  │              ▼               ▼               ▼               │   │
│  │         /api/*          /health        /* (static)          │   │
│  │            │                │               │                │   │
│  │            ▼                ▼               ▼                │   │
│  │       Hono Router      Health Check    Assets Fetcher       │   │
│  │            │                                │                │   │
│  │            ▼                                ▼                │   │
│  │     D1/KV/R2/AI                    Return static file       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Bindings                                   │   │
│  │                                                              │   │
│  │  DB: D1Database              - SQLite at the edge           │   │
│  │  RATE_LIMIT_KV: KVNamespace  - Distributed rate limiting    │   │
│  │  UPLOADS_BUCKET: R2Bucket    - Object storage for files     │   │
│  │  AI: Ai                      - AI Gateway connection        │   │
│  │  ASSETS: Fetcher             - Static file serving          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Static Export + Worker API
- Next.js static export for optimal caching and CDN distribution
- Hono worker handles all API routes at the edge
- Single deployment unit (worker + assets)

### 2. Bearer Token Authentication
- JWT tokens stored in localStorage on client
- Authorization header for API requests
- Cookie fallback for backward compatibility
- Stateless authentication at edge scale

### 3. Streaming Response Architecture
- AI SDK data stream protocol for real-time responses
- Tool results streamed inline with text
- Artifact deltas for progressive rendering
- Metadata (token usage) at stream end

### 4. Security-First Custom Tools
- No server-side code execution
- HTTP fetch with safe template interpolation
- MCP calls to external servers only
- Code execution runs in browser via Pyodide

### 5. Rate Limiting Strategy
- KV-based for distributed edge deployment
- Fail-open on KV errors (prefer availability)
- Different limits for guests vs authenticated
- Per-action granularity (chat, auth, API)

## File Structure

```
apps/web/
├── app/                    # Next.js app router
│   ├── (auth)/            # Auth pages (login, register)
│   ├── (chat)/            # Chat pages (main, compare)
│   ├── layout.tsx         # Root layout with providers
│   └── globals.css        # Tailwind + custom styles
├── components/            # React components
│   ├── ui/               # shadcn/ui primitives
│   ├── chat.tsx          # Main chat component
│   ├── message.tsx       # Message rendering
│   └── ...               # 50+ components
├── artifacts/            # Artifact renderers
│   ├── text/            # ProseMirror editor
│   ├── code/            # Pyodide executor
│   ├── sheet/           # DataGrid
│   └── chart/           # Recharts
├── hooks/               # Custom React hooks
├── lib/                 # Utilities and services
│   ├── ai/             # AI SDK configuration
│   ├── auth/           # Auth helpers
│   ├── db/             # Drizzle schema + queries
│   └── ...
├── worker/              # Cloudflare Worker
│   ├── index.ts        # Hono app entry
│   ├── routes/         # API route handlers
│   ├── lib/            # Worker utilities
│   └── openapi.ts      # OpenAPI specification
├── tests/               # Test suites
│   └── e2e/            # Playwright E2E tests
└── docs/               # Documentation
```

## API Reference

Full API documentation available at:
- **Swagger UI**: `/api/docs`
- **OpenAPI JSON**: `/api/docs/openapi.json`
- **OpenAPI YAML**: `/api/docs/openapi.yaml`

Total: 31 endpoints across 10 route modules.
