# DuyetBot Web App - Implementation Roadmap

## Vision: Best Chatbot UI in the World
**Goals:** Nice UI, no bugs, guest users, MCP integration, many tools, web search, any model from OpenRouter with model switching. TDD approach, clean code, production E2E testing.

---

## ✅ Completed (Phase 1)

### E2E Testing Infrastructure
- [x] Comprehensive chat UI test suite (31 passing tests)
- [x] Enhanced ChatPage Page Object Model (30+ helper methods)
- [x] Test coverage: input, message flow, model selection, accessibility
- [x] Production E2E test configuration (`--project=production`)
- [x] Fixed OTel instrumentation for dev mode

### Test Categories Covered
1. Page Load & Initial State (5 tests)
2. Chat Input (5 tests)
3. Chat Message Flow (3 tests)
4. Model Selection (3 tests)
5. Suggested Actions (2 tests)
6. Stop Generation (1 test)
7. File Attachments (2 tests)
8. Keyboard Navigation (2 tests)
9. URL & Routing (2 tests)
10. Responsive Design (3 tests)
11. Error Handling (2 tests)
12. Accessibility (2 tests)

---

## ✅ Completed (Phase 2 - Dec 28, 2025)

### Production Testing & Deployment
- [x] Production health test suite (13 tests, ~7s execution)
- [x] Fixed Playwright config to skip dev server for production tests
- [x] Separate test scripts: `bun run test` (local) vs `bun run test:production`
- [x] Deployed to https://duyetbot-web.duyet.workers.dev

### Model Selector Enhancement
- [x] Enhanced model selector with descriptions for each model
- [x] Wider selector (360px) for better readability
- [x] Fuzzy search across model ID, name, and description
- [x] 16 models across 5 providers (Anthropic, OpenAI, Google, xAI, DeepSeek)
- [x] Provider metadata with descriptions

### UI/UX Improvements
- [x] Dark mode toggle with Sun/Moon icons in user nav
- [x] Keyboard shortcuts dialog (press ? to open)
- [x] Shortcuts: Ctrl+N (new chat), Ctrl+B (sidebar), / (focus input)
- [x] Shortcuts: Ctrl+M (model selector), Ctrl+Shift+T (theme toggle)

---

## ✅ Completed (Phase 3 - Dec 28, 2025)

### Core Chat Features
- [x] **Message persistence** - Messages saved to D1 database via `saveMessages()`
- [x] **Chat history sidebar** - SWR infinite pagination with date grouping (Today/Yesterday/Last 7 days)
- [x] **Title auto-generation** - AI-powered title generation after first response via `/api/chat/title`
- [x] **Custom model parameters** - Temperature, maxTokens, topP, frequency/presence penalty via settings UI
- [x] **Chat branching** - Create parallel conversation branches via `/api/chat/branch`
- [x] **Chat export** - Export conversations as Markdown, JSON, or PDF with clipboard copy
- [x] **Message editing** - Edit user messages with inline editor, regenerates AI response
- [x] **Message deletion** - Delete individual messages via `/api/chat/messages/:id`

---

## 🚧 Next Phase (Priority Order)

### 1. Core Chat Features Completion
**Goal:** Complete remaining chat functionality

- [x] **Message persistence** - Messages saved to database ✅
- [x] **Chat history** - Sidebar with previous conversations ✅
- [x] **Title auto-generation** - Generate titles from first message ✅
- [x] **Chat branching** - Create parallel conversation branches ✅
- [x] **Chat export** - Export conversations (Markdown, JSON, PDF) ✅
- [x] **Message editing** - Edit user messages and regenerate response ✅
- [x] **Message deletion** - Delete messages via `/api/chat/messages/:id` ✅

### 2. Model & Provider Integration
**Goal:** Seamless model switching and provider management

- [x] **OpenRouter integration** - Full API integration with all models ✅
- [x] **Model selector UI** - Enhanced model picker with search and categories ✅
- [x] **Custom model parameters** - Temperature, max tokens, topP via settings UI ✅
- [x] **Provider fallback** - Graceful degradation when provider fails (streamWithFallback, executeWithFallback with fallback chains) ✅
- [x] **Model comparison** - Compare responses from multiple models side-by-side via `/compare` route ✅

### 4. Tool System Enhancement
**Goal:** Rich tool ecosystem for AI capabilities

- [x] **Duyet MCP integration** - Connected via duyetMCPTool with rich visualization ✅
- [x] **Web search tool** - DuckDuckGo search with credibility scoring ✅
- [x] **Tool approval UI** - User confirmation for url_fetch and getWeather ✅
- [x] **Tool visualizers** - Rich components for search, URL fetch, scratchpad, plan, weather ✅
- [x] **File upload tool** - Support for images (JPEG/PNG/GIF/WebP/SVG), documents (PDF/text/markdown/CSV), and code files (JS/TS/JSON/HTML/CSS/XML) ✅
- [x] **Code execution tool** - Safe Python execution with Pyodide (auto package loading, matplotlib rendering, console output) ✅
- [x] **Custom tool builder** - UI for users to create custom tools (HTTP fetch, MCP call support with parameter templates) ✅

### 5. Advanced Chat Features
**Goal:** Advanced AI chat capabilities

- [x] **Streaming responses** - Real-time token streaming with @ai-sdk/react ✅
- [x] **Token usage display** - Show prompt/completion tokens per message with metadata streaming ✅
- [x] **Artifact rendering** - 5 types complete (text/code/image/sheet/chart) ✅
  - Text: ProseMirror with suggestions, diff view, version control
  - Code: Python execution via Pyodide, matplotlib visualization
  - Image: Base64 PNG with version history
  - Sheet: react-data-grid with CSV import/export
  - Chart: Recharts with line/bar/area/pie, auto yKey detection, SVG download
- [x] **Thinking display** - Show AI reasoning process via extractReasoningMiddleware (partial) ✅
- [x] **Multi-turn conversations** - Full history loaded with branching and editing support ✅
- [x] **Mention parsing** - @ mentions for tools with autocomplete (6 tools, aliases, keyboard nav) ✅
- [x] **Conversation context** - Threaded/branching via ChatBranch component and /api/chat/branch endpoint ✅

### 6. User Management & Authentication
**Goal:** Seamless user experience with proper auth

- [x] **Guest user support** - Temporary sessions with rate limiting (10 msgs/day, auto-session, usage indicator) ✅
- [x] **Email/password auth** - Complete registration/login flow with PBKDF2 hashing, rate limiting, JWT sessions ✅
- [x] **GitHub OAuth** - Social login integration with CSRF protection ✅
- [x] **Session persistence** - 30-day guest sessions via cookie Max-Age ✅
- [x] **User settings** - Custom instructions, AI settings (temperature, maxTokens, topP, penalties), instruction templates ✅
- [x] **Privacy controls** - GDPR-compliant data export (JSON/HTML), deletion, consent, retention policies ✅

### 7. UI/UX Polish
**Goal:** Beautiful, intuitive interface

- [x] **Dark mode** - Full theme support with Sun/Moon toggle ✅
- [x] **Responsive design** - Centralized breakpoint system (use-responsive.ts), tablet hooks, optimized spacing ✅
- [x] **Loading states** - ChatSkeleton, MessageSkeleton, SidebarSkeleton with full layout mimicking ✅
- [x] **Error handling** - ErrorBoundary component, Next.js error.tsx pages, stream error recovery, graceful fallback UI ✅
- [x] **Keyboard shortcuts** - Power user navigation (?, Ctrl+N, Ctrl+B, /) ✅
- [x] **Toast notifications** - Context-aware feedback for file uploads, settings, tags, visibility changes ✅
- [x] **Accessibility** - WCAG 2.1 AA compliance (aria-labels for icon buttons, alt text fallbacks, role attributes for tool approval UI) ✅
- [x] **Animations** - CSS keyframes (shake, slide-up-fade, bounce-in, glow-pulse), button micro-interactions, message stagger, input focus glow, skeleton stagger ✅

### 8. Performance & Reliability
**Goal:** Fast, reliable, scalable

- [x] **Performance monitoring** - Web Vitals tracking (LCP, INP, CLS, FCP, TTFB) with sessionStorage metrics and optional beacon analytics ✅
- [x] **Error tracking** - Sentry integration with client/edge configs, replay, and filtered errors ✅
- [x] **Rate limiting** - KV-based token bucket for guests (10/day) and users (60/min) ✅
- [x] **Caching strategy** - Cloudflare Cache API for API responses, immutable headers for hashed assets, SWR for HTML ✅
- [x] **CDN deployment** - Cloudflare Workers Assets for global distribution ✅
- [x] **Database optimization** - 11 indexes added for query optimization (user_email, chat_user_created, message_chat_created, etc.) ✅

### 9. Testing & Quality Assurance
**Goal:** Comprehensive test coverage

- [x] **Unit tests** - 66 tests for utils, crypto (PBKDF2), and JWT modules (`bun run test:unit`) ✅
- [x] **Integration tests** - 26 API endpoint tests via vitest (`bun run test:api`) ✅
- [x] **E2E tests** - 31 tests across chat, model-selector, production health (`bun run test`, `bun run test:production`) ✅
- [ ] **Visual regression tests** - Percy/Chromatic for UI testing
- [ ] **Load testing** - k6 for performance testing
- [ ] **Security audit** - OWASP ZAP security scanning

### 10. Documentation & Developer Experience
**Goal:** Easy to understand and contribute to

- [x] **API documentation** - OpenAPI 3.1 spec with Swagger UI at /api/docs ✅
- [ ] **Component documentation** - Storybook for component catalog
- [x] **Architecture documentation** - System design diagrams in docs/ARCHITECTURE.md ✅
- [x] **Deployment guide** - Step-by-step deployment instructions in docs/DEPLOYMENT.md ✅
- [ ] **Contributing guide** - How to contribute to the project
- [ ] **Troubleshooting guide** - Common issues and solutions

---

## 🎯 Immediate Next Steps

### ✅ Priority 1: Tool System Enhancement (COMPLETED)
- DuyetMCP integration with rich visualization
- Web search via DuckDuckGo with credibility scoring
- Tool approval UI for url_fetch and getWeather
- Rich tool visualizers for all tools

### Priority 2: Guest User Flow (COMPLETED)
Complete rate limiting and guest session management:
- [x] Add per-IP rate limiting for guest users (10 messages/day via KV-based token bucket)
- [x] Implement session expiry (30-day guest sessions via cookie Max-Age)
- [x] Add request throttling middleware (integrated into chat route with 429 responses)
- [x] Guest user usage dashboard (GuestUsageIndicator component with /api/rate-limit/status API)

### Priority 3: Model Comparison
Allow comparing responses from different models side-by-side.

---

## 📊 Success Metrics

### Technical Metrics
- [ ] 95%+ test coverage for critical paths
- [ ] <2s page load time (p95)
- [ ] <500ms API response time (p95)
- [ ] 99.9% uptime
- [ ] Zero critical security vulnerabilities

### User Experience Metrics
- [ ] <3s time to first message
- [ ] 0% crash rate
- [ ] 95%+ successful chat completion rate
- [ ] <1% error rate
- [ ] 4.5+ user satisfaction rating

---

## 🔧 Quick Reference

### Development Commands
```bash
# Development
bun dev                    # Start dev server
bun run build            # Build for production
bun run deploy           # Deploy to Cloudflare

# Testing
bun run test             # Run E2E tests (dev)
bun run test:production  # Run E2E tests (production)
bun run test:api         # Run API tests

# Database
bun run db:generate      # Generate migrations
bun run db:migrate       # Run migrations
bun run db:studio        # Open Drizzle Studio
```

### Environment Variables
```bash
# Required
OPENROUTER_API_KEY=xxx   # For OpenRouter models

# Optional
PRODUCTION_URL=https://duyetbot-web.duyet.workers.dev
```

---

*Last Updated: 2025-12-28*
