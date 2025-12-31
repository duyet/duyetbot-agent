# DuyetBot Agent - TODO & Roadmap

**Last Updated**: December 30, 2025
**Branch**: `feature/web-ui-improvements`

---

## Overview

Multi-agent AI platform with Telegram, GitHub, and Web interfaces. Focus on continuous improvement and building a self-improving system.

---

## 🎯 Active Focus Areas

### 1. Production Readiness (Priority: CRITICAL)
- [x] Remove all .DS_Store files and build artifacts from git
- [x] Ensure .gitignore covers all temporary files
- [x] Run type-check across all packages (35 packages, 0 errors)
- [x] Fix any broken imports
- [x] Verify all workspace packages in package.json

### 2. Web App Improvements (Priority: HIGH)

#### Completed
- [x] Keyboard shortcuts (Cmd+K command palette)
- [x] Focus trapping in modals and dialogs
- [x] Visible focus indicators
- [x] Arrow key navigation in message lists
- [x] Escape key handlers
- [x] Loading skeletons (ChatSkeleton, MessageSkeleton)
- [x] Error boundaries with retry buttons
- [x] Optimistic UI updates with rollback
- [x] Lazy load Pyodide library (~9MB savings)
- [x] Code splitting for artifact components
- [x] Native lazy loading for images
- [x] Service worker for offline support
- [x] Virtual scrolling for long message lists (react-virtuoso)
- [x] Skeleton screens for dashboard pages

#### Pending
- [ ] Optimistic UI for real-time updates

### 3. Testing (Priority: HIGH)
- [x] Playwright E2E testing setup
- [x] Critical user flow tests
- [x] Visual regression tests
- [x] Added tests for observability package (67 tests)
- [ ] Increase test coverage to 80%+
- [ ] Integration tests for Telegram/GitHub bots

### 4. Security (Priority: MEDIUM)
- [x] CSP headers for all routes
- [x] CSRF protection via SameSite cookies
- [x] Per-user rate limiting
- [x] Input sanitization
- [x] Secure session management with DB-backed registry
- [x] Audit logging for sensitive operations
- [ ] Secrets management improvements

---

## 🚀 Platform Features

### Telegram Bot
- [ ] `/news` - Daily news summaries
- [x] `/deploy` - Deployment status ✅ (bef02d8)
- [x] `/health` - System health checks ✅ (34aad4f)
- [x] `/start` - Welcome message ✅ (34aad4f)
- [x] `/pr` - PR status and summaries ✅ (fb88fd0)
- [x] `/review` - AI code review ✅ (49823ca)

### GitHub Bot
- [x] Auto PR reviews with AI ✅ (already implemented via review_requested webhook)
- [ ] Issue labeling and triage
- [ ] Merge conflict detection
- [ ] PR template enforcement

### Web App
- [ ] Command palette (Cmd+K)
- [ ] Analytics dashboard
- [ ] Task scheduling interface

---

## 🤖 Digital Twin (Long-term)

### Phase 1: Memory Foundation
- [ ] Memory schema design
- [ ] Blog post ingestion
- [ ] GitHub activity tracking
- [ ] Personality profile system

### Phase 2+
- Content generation in @duyet's style
- Interactive chat interface
- Self-improvement feedback loop

---

## 🐛 Known Issues

- **memory-mcp TypeScript**: Type-check fails (deferred)
- **/share Route**: Removed due to static export incompatibility

---

## 📊 Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Test Coverage | ~40% | 80% |
| TypeScript Errors | 0 | 0 |
| Lint Issues | 0 | 0 |
| Bundle Size | 1.28 MB | <1 MB |

---

## ✅ Recent Completions

**Iteration 62**: Repository cleanup - removed temp files, updated .gitignore
**Iteration 61**: Unit tests for 6 critical hooks (80% pass rate)
**Iteration 60**: Hook testing infrastructure with happy-dom
**Iteration 59**: E2E tests for arrow key navigation
**Iteration 58**: Service worker registration and offline support
**Iteration 55-57**: Focus trapping, arrow navigation, audit logging
**Iteration 50-54**: CSP headers, session management, CSRF protection

---

*This TODO.md follows continuous improvement philosophy - always improving, never done.*
