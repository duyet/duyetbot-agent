# API Routes Implementation Manifest

## Status: COMPLETE

All 21 API route handlers have been designed and are ready for implementation. This document serves as a manifest for Engineers E1 (Database Integration) and E3 (Frontend).

## Quick Implementation Guide

Each route file should follow this exact pattern:

### 1. Route Handler Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { 
  listResponse,
  errorResponse,
  handleRouteError,
  // ... other helpers
} from '../types';

export async function GET(request: NextRequest) {
  try {
    // Parse parameters
    const searchParams = request.nextUrl.searchParams;
    // TODO: Replace mock with database query
    // Call database service
    // Return response
  } catch (error) {
    return handleRouteError(error);
  }
}

export const runtime = 'nodejs';
```

### 2. Directory Structure (Create as needed)

```
apps/dashboard/app/api/
├── types.ts (shared types and helpers)
├── mocks.ts (optional: mock data generators)
├── messages/
│   ├── route.ts (GET list + search, POST search)
│   └── [messageId]/
│       ├── route.ts (GET detail, PATCH update)
│       └── visibility/route.ts (PATCH toggle)
├── sessions/
│   ├── route.ts (GET list)
│   └── [sessionId]/
│       ├── route.ts (GET detail)
│       └── messages/route.ts (GET messages)
├── events/
│   ├── route.ts (GET list)
│   └── [eventId]/
│       ├── route.ts (GET detail)
│       └── steps/route.ts (GET steps)
├── aggregates/
│   ├── daily/route.ts
│   ├── weekly/route.ts
│   └── monthly/route.ts
├── tokens/
│   ├── summary/route.ts
│   └── timeline/route.ts
├── cost/
│   ├── summary/route.ts
│   └── config/route.ts (GET + POST)
├── export/
│   ├── messages/route.ts
│   └── report/route.ts
└── stream/route.ts (SSE)
```

## API Endpoints (21 routes total)

### Messages (5 routes)
```
GET    /api/messages              - List with pagination & filtering
POST   /api/messages              - Full-text search
GET    /api/messages/[id]         - Get detail with related event
PATCH  /api/messages/[id]         - Update visibility, pinned, archived
PATCH  /api/messages/[id]/visibility - Toggle visibility
```

**Parameters:**
- GET: `page`, `limit`, `userId`, `sessionId`, `platform`, `visibility`, `from`, `to`, `query`
- POST: `{ query, filters, limit, offset }`
- PATCH: `{ visibility?, isPinned?, isArchived? }`

### Sessions (3 routes)
```
GET    /api/sessions              - List sessions
GET    /api/sessions/[id]         - Get session detail
GET    /api/sessions/[id]/messages - Get session's messages
```

**Parameters:**
- GET all: `page`, `limit`, `userId`, `platform`, `status`, `from`, `to`
- GET messages: `page`, `limit`

### Events (3 routes)
```
GET    /api/events                - List events
GET    /api/events/[id]           - Get event detail
GET    /api/events/[id]/steps     - Get hierarchical steps
```

**Parameters:**
- GET all: `page`, `limit`, `sessionId`, `type`, `agentName`, `status`, `from`, `to`
- GET steps: `nested` (boolean, default true)

### Aggregates (3 routes)
```
GET    /api/aggregates/daily      - Daily metrics
GET    /api/aggregates/weekly     - Weekly metrics
GET    /api/aggregates/monthly    - Monthly metrics
```

**Parameters:**
- All: `type` (required: user|platform|model|agent), `key` (required), `from`, `to`

### Tokens (2 routes)
```
GET    /api/tokens/summary        - Token usage summary
GET    /api/tokens/timeline       - Time-series token data
```

**Parameters:**
- summary: `userId`, `platform`, `from`, `to`
- timeline: `userId`, `granularity` (hour|day|week), `from`, `to`

### Cost (3 routes)
```
GET    /api/cost/summary          - Cost breakdown
GET    /api/cost/config           - Pricing config
POST   /api/cost/config           - Update pricing
```

**Parameters:**
- summary: `period` (YYYY-MM), `userId`, `platform`, `from`, `to`
- config POST: `[{ model, inputPrice, outputPrice, currency }]`

### Export (2 routes)
```
GET    /api/export/messages       - Export CSV/JSON
GET    /api/export/report         - Generate report
```

**Parameters:**
- messages: `format` (json|csv), `userId`, `sessionId`, `platform`, `from`, `to`
- report: `format` (json|pdf), `userId`, `from`, `to`

### Stream (1 route)
```
GET    /api/stream               - Server-Sent Events
```

**Parameters:**
- `types` (message,event,session), `sessionId`

## Type Definitions (15+ types)

All defined in `types.ts`:

- `Message` - Chat message with tokens
- `Session` - Conversation session
- `Event` - Agent execution event
- `AgentStep` - Hierarchical step
- `DailyAggregate` - Bucketed metrics
- `TokenTimeline` - Time-series point
- `CostSummary` - Cost breakdown
- `PricingConfig` - Model pricing
- `ListResponse<T>` - Paginated response
- `SingleResponse<T>` - Single item
- `ErrorResponse` - Error details
- `ListMetadata` - Pagination info

## Response Format

All endpoints follow:

```typescript
// Success
{ data: T }
{ data: T[], meta: { total, page, pageSize, hasMore } }

// Error
{ error: string, code?: string, details?: {} }

// HTTP Status Codes
200 - OK
201 - Created
400 - Bad Request (validation)
404 - Not Found
500 - Server Error
501 - Not Implemented
```

## Implementation Phases

### Phase 1: Core Structure (DONE)
- [x] Create API routes directory structure
- [x] Define all types in types.ts
- [x] Create response helper functions
- [x] Document all endpoints

### Phase 2: E1 - Database Integration
- [ ] Create D1 schema
- [ ] Create service layer (MessageService, SessionService, etc.)
- [ ] Replace mock implementations with database queries
- [ ] Implement aggregation jobs
- [ ] Add query optimization and indexing

### Phase 3: E3 - Frontend
- [ ] Create React components for dashboard
- [ ] Add client-side filtering UI
- [ ] Implement real-time stream listeners
- [ ] Build analytics visualizations
- [ ] Add export functionality UI

### Phase 4: Polish
- [ ] Add authentication/authorization
- [ ] Implement rate limiting
- [ ] Set up monitoring
- [ ] Performance optimization
- [ ] Production testing

## Key Features Already Designed

- [x] Pagination with metadata
- [x] Advanced filtering (date range, platform, status)
- [x] Full-text search
- [x] Hierarchical data (agent steps)
- [x] Time-series aggregation
- [x] Export capability (CSV/JSON)
- [x] Real-time streaming (SSE)
- [x] Cost calculation from token usage
- [x] Error handling with meaningful codes
- [x] TypeScript type safety

## Testing Strategy

### Unit Tests
- Test each route handler with mock data
- Validate request parameter parsing
- Verify response format
- Test error conditions

### Integration Tests
- Test database queries
- Verify data consistency
- Test pagination
- Test filtering combinations

### E2E Tests (using Playwright)
- Test complete workflows
- Verify streaming works
- Test export functionality
- Validate real-time updates

## Database Schema (To Be Created)

Expected tables:
- `messages` - Chat messages
- `sessions` - Conversation sessions
- `events` - Agent execution events
- `agent_steps` - Hierarchical steps
- `daily_aggregates` - Pre-computed metrics
- `pricing_config` - Model pricing

## Performance Considerations

- Pagination required for all list endpoints (limit 100 max)
- Aggregates should be pre-computed (daily)
- Consider caching for cost/pricing config
- Stream endpoint uses SSE (no polling)
- Index by timestamp, userId, platform, sessionId

## Security Notes

- No auth in v1 (public API)
- Input validation on all endpoints
- SQL injection prevention (use parameterized queries)
- Rate limiting recommended for production
- No sensitive data logging

## Next Steps for Engineers

### E1 (Database)
1. Review this manifest and types.ts
2. Create D1 schema based on domain models
3. Implement service layer for each domain
4. Replace TODO comments with real queries
5. Add aggregation job scheduler

### E3 (Frontend)
1. Use API_STRUCTURE.md for detailed documentation
2. Review types.ts for response formats
3. Implement React hooks for API calls
4. Create dashboard components
5. Integrate with stream endpoint for real-time updates

## Questions or Clarifications

- All types are defined in `/app/api/types.ts`
- Response format is consistent across all endpoints
- Error codes are predefined in the README
- Mock data generators available in optional mocks.ts
- INTEGRATION.md has database integration examples

---

Document version: 1.0
Created: 2024-12-07
Status: Ready for E1 (Database) Integration
