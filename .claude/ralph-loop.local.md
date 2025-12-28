---
active: true
iteration: 546
max_iterations: 0
completion_promise: null
started_at: "2025-12-28T04:28:04Z"
---

# 🚀 DuyetBot Web - Continuous Improvement Loop

## 🎯 Vision
Transform `apps/web` into the **world's best Chatbot UI** - a production-grade, feature-complete AI chat application that sets the standard for user experience, reliability, and innovation.

## 📋 Core Requirements

### 1. UI Excellence
- **Beautiful Design**: Modern, polished interface rivaling ChatGPT/Claude.ai
- **Dark/Light Themes**: Complete theme support with smooth transitions
- **Responsive**: Perfect experience on mobile, tablet, and desktop
- **Animations**: Smooth micro-interactions, message transitions, loading states
- **Accessibility**: WCAG 2.1 AA compliance (keyboard nav, screen readers, contrast)

### 2. Zero Bugs Policy
- **TypeScript Strict Mode**: No `any`, complete type safety
- **Error Boundaries**: Graceful error handling at every level
- **E2E Tests**: Comprehensive Playwright tests for all user flows
- **Production Health Checks**: Automated testing against live deployment
- **Biome Linting**: Clean code with zero warnings

### 3. Guest User Support
- **Instant Access**: No signup required for immediate chat experience
- **Rate Limiting**: 10 messages/day for guests via KV token bucket
- **Session Persistence**: 30-day cookie-based sessions
- **Usage Indicators**: Clear feedback on remaining messages
- **Smooth Upgrade Path**: Easy transition from guest to registered user

### 4. Duyet MCP Integration
- **8 Actions Available**: search, read, store, reinforce, list, timeline, context, batch
- **Rich Visualizations**: Beautiful result displays for each action type
- **Cross-Session Memory**: Persistent memory across conversations
- **Seamless UX**: Non-intrusive memory operations with feedback

### 5. Comprehensive Tool System
- **Built-in Tools**: web_search, url_fetch, weather, scratchpad, plan, code_execution
- **Custom Tool Builder**: Users create HTTP/MCP tools with parameter templates
- **Tool Approval UI**: User confirmation for sensitive operations
- **Rich Visualizers**: Beautiful displays for search results, weather, code output
- **File Attachments**: Images, documents, code files with preview

### 6. Web Search
- **DuckDuckGo Integration**: Privacy-focused search
- **Credibility Scoring**: Source reliability indicators
- **Rich Results**: Formatted with titles, snippets, sources
- **Citation Support**: Proper attribution in responses

### 7. Multi-Model Support (OpenRouter)
- **16+ Models**: Claude, GPT-4, Gemini, Grok, DeepSeek, etc.
- **Model Selector UI**: Fuzzy search, descriptions, provider info
- **Model Comparison**: Side-by-side response comparison at `/compare`
- **Custom Parameters**: Temperature, topP, maxTokens per conversation
- **Provider Fallback**: Graceful degradation on provider failures

### 8. TDD Approach
- **Test-First Development**: Write tests before implementation
- **Unit Tests**: 66+ tests for utils, crypto, JWT
- **API Tests**: 26+ vitest tests for backend endpoints
- **E2E Tests**: 31+ Playwright tests for user flows
- **Production Tests**: Health checks against live deployment

### 9. Clean Code Standards
- **TypeScript Strict**: Complete type safety
- **Biome Linting**: Consistent formatting and style
- **SOLID Principles**: Single responsibility, clean architecture
- **Component Design**: Composable, reusable UI components
- **Error Handling**: Comprehensive with user-friendly messages

### 10. Deployment & Monitoring
- **Cloudflare Workers**: Edge deployment for global performance
- **D1 Database**: Persistent storage with optimized indexes
- **Web Vitals**: LCP, INP, CLS tracking
- **Sentry Integration**: Error monitoring and replay
- **Automated Deploy**: `bun run deploy` from apps/web

## 🔄 Loop Protocol

### Phase 1: Assessment (Every Iteration Start)
1. Read `apps/web/TODO.md` to understand current state
2. Run `bun run check` to identify lint/type errors
3. Run `bun run test` to verify test health
4. Identify top 3 priority improvements

### Phase 2: Implementation
1. Select highest-impact task from priorities
2. Write/update tests FIRST (TDD)
3. Implement feature/fix with clean code
4. Fix any lint/type errors immediately
5. Verify all tests pass

### Phase 3: Quality Gate
1. Run `bun run check` - must pass with 0 errors
2. Run `bun run test` - all tests must pass
3. Run `bun run build` - production build must succeed
4. Fix any issues before proceeding

### Phase 4: Deploy & Verify
1. Deploy: `bun run deploy` from apps/web
2. Run production tests: `bun run test:production`
3. Verify deployment health manually if needed
4. Document any issues found

### Phase 5: Documentation
1. Update `apps/web/TODO.md` with completed items
2. Update this file with progress notes
3. Think about lessons learned, future improvements, etc.
3. Plan next iteration priorities and update to `apps/web/TODO.md`
4. Commit all changes with semantic messages

## 📊 Current Status (Dec 28, 2025)

### ✅ Completed Features
- Complete UI component library (152 components)
- Guest user support with rate limiting
- Duyet MCP integration (8 actions)
- 6 built-in tools with visualizers
- Custom tool builder
- Web search with DuckDuckGo
- 28 OpenRouter models with switcher (Claude Haiku 4.5, GPT-5, Gemini 3 Flash, Grok 4)
- Model comparison at /compare
- Dark/light themes
- Keyboard shortcuts
- Message editing, branching, deletion
- Chat export (MD/JSON/PDF)
- Token usage display
- Artifact rendering (text/code/image/sheet/chart)
- Authentication (email/password, GitHub OAuth)
- Privacy controls (GDPR compliant)
- 18 production health tests
- Voice input via Web Speech API (Chrome/Edge/Safari)
- Voice output (text-to-speech) via Web Speech Synthesis API (Chrome/Edge/Safari/Firefox)
- Voice settings UI (rate, pitch, volume, voice selection) with localStorage persistence
- Auto-read option for TTS (automatically read new AI messages aloud)

### 🔧 Known Issues
- All E2E tests passing ✅
- Could add more models from OpenRouter as they become available
- Consider adding visual regression tests (Percy/Chromatic)

### 🎯 Next Priorities (Iteration 540+)
1. Consider adding visual regression tests (Percy/Chromatic)
2. Implement load testing with k6
3. Add more OpenRouter models as they become available
4. Consider adding real-time collaboration features

## 🛠️ Commands Reference

```bash
# Development
cd apps/web
bun dev                     # Start dev server
bun run build              # Production build
bun run deploy             # Deploy to Cloudflare

# Quality Checks
bun run check              # Lint + typecheck
bun run test               # E2E tests (local)
bun run test:production    # E2E tests (production)
bun run test:api           # API tests
bun run test:unit          # Unit tests

# Database
bun run db:migrate         # Run migrations
```

---

**Remember**: Quality over quantity. Each iteration should leave the codebase better than before. No rushing, no shortcuts, no technical debt.
Clean up context for next iteration.
