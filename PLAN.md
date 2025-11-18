# Implementation Plan: duyetbot-agent

## Overview
This document outlines the phased implementation plan for the duyetbot-agent project - an autonomous bot agent system running on Cloudflare Workers with multi-LLM support and background task scheduling.

---

## ⚠️ IMPORTANT: Keeping This Plan Updated

**This is a living document that MUST be maintained throughout development.**

When working on this project:
1. **Read this plan before starting any work** to understand current phase and dependencies
2. **Mark tasks complete `[x]` immediately** as you finish them (don't batch updates)
3. **Add new tasks** discovered during implementation to the appropriate phase
4. **Update the Revision History** table at the bottom when making changes
5. **Commit PLAN.md along with your code changes**

📖 **See CLAUDE.md "Development Workflow" section for detailed instructions.**

---

## Project Goals
- ✅ Multi-LLM provider support (Claude, OpenAI, OpenRouter)
- ✅ Background task execution with scheduling
- ✅ Natural language task input and parsing
- ✅ Sub-agent system with custom model configuration
- ✅ Markdown-based configuration
- ✅ Simple, clean web UI for task management
- ✅ Cloudflare Workers deployment with Sandbox SDK
- 🎯 **CLI tool distribution** (`npx @duyetbot/agent`)
- 🎯 **GitHub Actions integration**
- 🎯 **Cross-platform support** (Mac & Linux)

---

## Architecture Overview

**Multi-Deployment Model**:
The system is designed to run in multiple environments:

1. **CLI Tool** (`npx @duyetbot/agent`)
   - Published to npm as `@duyetbot/agent`
   - Interactive mode: `npx @duyetbot/agent`
   - Direct execution: `npx @duyetbot/agent "task or question"`
   - Local execution with Node.js runtime

2. **GitHub Actions Integration**
   - Easy to integrate in workflows
   - Environment variable configuration
   - Structured output for CI/CD

3. **Web UI** (Cloudflare Workers)
   - Web interface for task management
   - Cloudflare Workers deployment
   - Cloudflare Sandbox SDK for isolated execution

**Core Design Principle**:
The agent core is deployment-agnostic. CLI, GitHub Actions, and Web UI are different frontends to the same core system.

---

## Phase 1: Project Foundation ⚡ (1-2 days)

### 1.1 Project Initialization
**Goal**: Set up TypeScript project structure and tooling

**Tasks**:
- [x] Initialize npm project with TypeScript
- [x] Install core dependencies:
  - `@anthropic-ai/claude-agent-sdk`
  - `@cloudflare/workers-types`
  - `zod` for schema validation
  - `vitest` for testing
  - Development tools (typescript, biome)
- [x] Create `tsconfig.json` with strict settings
- [x] Create `.gitignore` for Node.js/TypeScript
- [x] Set up Biome configuration for linting and formatting
- [x] Create `vitest.config.ts` for testing
- [x] Create basic `README.md`

**Output**: Working TypeScript environment with linting ✅

### 1.2 Cloudflare Workers Setup
**Goal**: Configure Cloudflare Workers deployment

**Tasks**:
- [x] Create `wrangler.jsonc` configuration
- [x] Define KV namespace bindings
- [x] Define D1 database bindings
- [x] Set up environment variables structure
- [x] Create basic worker entry point (`src/index.ts`)
- [ ] Test local development with `wrangler dev`

**Output**: Deployable Cloudflare Worker skeleton

### 1.3 Project Structure
**Goal**: Establish directory structure

**Tasks**:
- [x] Create directory structure:
  ```
  src/
    ├── agent/          # Agent core
    ├── tools/          # Tool implementations
    ├── providers/      # LLM providers
    ├── agents/         # Sub-agent system
    ├── scheduler/      # Task scheduling
    ├── config/         # Configuration parsing
    ├── storage/        # Persistence layer
    ├── ui/             # Web interface
    └── index.ts        # Entry point
  agents/               # Agent configs
  tasks/                # Task templates
  tests/
    ├── unit/
    └── integration/
  ```
- [x] Create index files for each module
- [x] Set up path aliases in tsconfig.json

**Output**: Organized codebase structure ✅

---

## Phase 2: Core Agent System 🤖 (3-4 days)

### 2.1 LLM Provider Abstraction ✅
**Goal**: Create unified interface for multiple LLM providers

**Tasks**:
- [x] Define `LLMProvider` interface with streaming support
- [x] Create provider factory with format parser `<provider>:<model_id>`
- [x] Add provider configuration validation
- [x] Write unit tests for provider types and factory (35 tests passing)
- [x] Implement Claude provider adapter (32 tests passing)
  - Anthropic SDK integration (`@anthropic-ai/sdk`)
  - Streaming async generator responses
  - System message handling
  - Error handling with LLMProviderError
  - Support for Claude 3.5 Sonnet, Opus, and Haiku
- [ ] Implement OpenAI provider adapter
  - Use OpenAI SDK
  - Match interface with Claude provider
- [ ] Implement OpenRouter provider adapter
  - Use OpenRouter API
  - Support multiple models

**Output**: Working multi-provider LLM system (Partial - Claude complete, 67 tests passing)

### 2.2 Agent Core
**Goal**: Build agent execution engine

**Tasks**:
- [ ] Implement agent core class
- [ ] Add session management
  - Session creation and persistence
  - Session state tracking
  - Session resumption
- [ ] Implement tool execution engine
  - Tool registration system
  - Input validation with Zod
  - Error handling and recovery
- [ ] Add streaming response handling
- [ ] Implement permission system
- [ ] Add hooks support (PreToolUse, PostToolUse, etc.)
- [ ] Write integration tests

**Output**: Functional agent that can execute tools

### 2.3 Basic Tools Implementation ✅
**Goal**: Implement essential tools

**Tasks**:
- [x] Implement `bash` tool (32 tests passing)
  - Sandbox command execution
  - Output capture
  - Timeout handling
  - Environment variable support
- [ ] Implement `git` tool
  - Clone, commit, push, pull operations
  - Status and diff commands
- [x] Implement `plan` tool (23 tests passing)
  - Task decomposition with intelligent step generation
  - Planning output formatting as markdown
  - Complexity estimation
- [x] Implement `sleep` tool (19 tests passing)
  - Delay execution with timeout support
  - AbortSignal cancellation support
  - Multiple time units (ms, seconds, minutes)
- [x] Create tool registry (30 tests passing)
  - Registration with override support
  - Tool validation and execution
  - Filtering and metadata management
- [x] Write tests for each tool (104 tests for tools)

**Output**: Working toolset for agent operations ✅

**Status**: 3/4 core tools complete. Git tool pending.

---

## Phase 3: Storage & Persistence 💾 (2-3 days)

### 3.1 Cloudflare KV Integration
**Goal**: Implement key-value storage for tasks and sessions

**Tasks**:
- [ ] Create KV namespace in wrangler.jsonc
- [ ] Implement KV storage adapter
- [ ] Create task storage module
  - Save/load task definitions
  - List tasks with filters
  - Update task status
- [ ] Create session storage module
  - Persist conversation history
  - Store agent state
- [ ] Add caching layer
- [ ] Write storage tests

**Output**: Persistent task and session storage

### 3.2 Cloudflare D1 Integration
**Goal**: Set up relational database for complex queries

**Tasks**:
- [ ] Define D1 database schema
  - Tasks table
  - Executions table
  - Logs table
  - Users table (for auth)
- [ ] Create migration scripts
- [ ] Implement D1 query builders
- [ ] Add indexes for performance
- [ ] Create database seed scripts
- [ ] Write database tests

**Output**: Relational database for structured data

---

## Phase 4: Task Scheduler 📅 (3-4 days)

### 4.1 Scheduler Engine
**Goal**: Build background task execution system

**Tasks**:
- [ ] Implement task queue
  - Priority-based queuing
  - Task status tracking
  - Execution history
- [ ] Create scheduler core
  - Cron expression parsing
  - Next execution calculation
  - Trigger management
- [ ] Add execution engine
  - Task runner with timeout
  - Concurrent execution limits
  - Retry logic with exponential backoff
- [ ] Implement Cloudflare Cron Triggers
- [ ] Add manual task triggering
- [ ] Write scheduler tests

**Output**: Working background task scheduler

### 4.2 Natural Language Task Parsing
**Goal**: Parse user input into structured tasks

**Tasks**:
- [ ] Create NLP parsing module using LLM
- [ ] Define task extraction schema
  - Task name and description
  - Schedule information
  - Agent/tool requirements
  - Priority level
- [ ] Implement schedule parser
  - Natural language → cron expression
  - Relative time handling (e.g., "in 2 hours")
- [ ] Add validation and confirmation flow
- [ ] Create example prompts for parsing
- [ ] Write parsing tests with various inputs

**Output**: AI-powered task creation from natural language

---

## Phase 5: Sub-Agent System 🔄 (2-3 days)

### 5.1 Agent Registry
**Goal**: Dynamic agent loading and management

**Tasks**:
- [ ] Create agent registry system
- [ ] Implement agent definition loader
- [ ] Add agent validation
- [ ] Create default agents:
  - Researcher agent
  - Developer agent
  - Reviewer agent
- [ ] Implement agent caching
- [ ] Write registry tests

**Output**: Extensible agent management system

### 5.2 Sub-Agent Execution
**Goal**: Enable hierarchical agent delegation

**Tasks**:
- [ ] Implement sub-agent spawning
- [ ] Add context passing between agents
- [ ] Create agent communication protocol
- [ ] Implement model override per agent
- [ ] Add tool inheritance with overrides
- [ ] Create delegation strategies
- [ ] Write sub-agent integration tests

**Output**: Working multi-agent collaboration

### 5.3 Markdown Configuration Parser
**Goal**: Load agents and tasks from markdown files

**Tasks**:
- [ ] Create markdown parser
- [ ] Define agent configuration format
- [ ] Define task configuration format
- [ ] Implement validation with schemas
- [ ] Add hot-reloading for development
- [ ] Create example configurations
- [ ] Write parser tests

**Output**: Markdown-based configuration system

---

## Phase 6: Web UI 🎨 (3-4 days)

### 6.1 UI Framework Setup
**Goal**: Set up minimal web interface

**Tasks**:
- [ ] Choose UI framework (vanilla JS/React/Solid)
- [ ] Set up build system (esbuild/vite)
- [ ] Create base HTML template
- [ ] Implement dark theme CSS
  - Use design inspiration from homelab.duyet.net
  - Monospace fonts for code-friendly interface
  - Grid-based layout
- [ ] Set up routing
- [ ] Configure asset bundling for Cloudflare Workers

**Output**: UI build pipeline and base styles

### 6.2 Core UI Components
**Goal**: Build essential UI components

**Tasks**:
- [ ] Create task input component
  - Text area for natural language
  - Quick action buttons
- [ ] Create task list component
  - Grid/card layout
  - Status indicators
  - Action buttons (run, edit, delete)
- [ ] Create task detail view
  - Execution history
  - Logs display
  - Configuration editor
- [ ] Create schedule visualizer
  - Timeline view
  - Next execution indicators
- [ ] Add loading states and error handling
- [ ] Implement responsive design

**Output**: Functional task management UI

### 6.3 Real-Time Updates
**Goal**: Live execution status updates

**Tasks**:
- [ ] Implement WebSocket connection (or Server-Sent Events)
- [ ] Create event streaming from worker
- [ ] Add real-time log streaming
- [ ] Update UI on task status changes
- [ ] Show execution progress
- [ ] Handle connection errors and reconnection

**Output**: Live-updating interface

---

## Phase 7: API Layer 🔌 (2-3 days)

### 7.1 REST API Endpoints
**Goal**: Create HTTP API for UI and external access

**Tasks**:
- [ ] Implement API routes in worker:
  ```
  GET  /api/tasks              # List all tasks
  POST /api/tasks              # Create new task
  GET  /api/tasks/:id          # Get task details
  PUT  /api/tasks/:id          # Update task
  DELETE /api/tasks/:id        # Delete task
  POST /api/tasks/:id/execute  # Trigger execution
  GET  /api/executions/:id     # Get execution logs
  GET  /api/agents             # List available agents
  POST /api/parse              # Parse natural language
  ```
- [ ] Add request validation
- [ ] Implement response formatting
- [ ] Add CORS handling
- [ ] Create API documentation
- [ ] Write API tests

**Output**: Complete REST API

### 7.2 Webhook Support
**Goal**: Allow external triggers

**Tasks**:
- [ ] Implement webhook endpoints
- [ ] Add webhook signature verification
- [ ] Create webhook → task mapping
- [ ] Add webhook management UI
- [ ] Write webhook tests

**Output**: Webhook-triggered task execution

---

## Phase 8: Authentication & Security 🔐 (2-3 days)

### 8.1 Authentication System
**Goal**: Secure UI and API access

**Tasks**:
- [ ] Choose auth strategy (JWT, OAuth, API keys)
- [ ] Implement authentication middleware
- [ ] Create login/logout flow
- [ ] Add session management
- [ ] Implement user storage
- [ ] Create auth UI components
- [ ] Write auth tests

**Output**: Secure authentication system

### 8.2 Authorization & Security
**Goal**: Implement access control and security measures

**Tasks**:
- [ ] Add role-based access control (RBAC)
- [ ] Implement rate limiting
  - Per-user limits
  - Per-endpoint limits
  - LLM API rate limiting
- [ ] Add input sanitization
- [ ] Implement API key rotation
- [ ] Add security headers
- [ ] Create audit logging
- [ ] Run security audit
- [ ] Write security tests

**Output**: Hardened security posture

---

## Phase 9: Advanced Tools 🛠️ (2-3 days)

### 9.1 Research Tool
**Goal**: Web research and information gathering

**Tasks**:
- [ ] Implement web search integration
- [ ] Add web scraping capability
- [ ] Create content extraction
- [ ] Implement source citation
- [ ] Add result ranking
- [ ] Write research tool tests

**Output**: Functional research tool

### 9.2 Additional Tools
**Goal**: Expand tool library

**Tasks**:
- [ ] Implement file operations tool
  - Read, write, edit files
  - Directory operations
- [ ] Create database query tool
- [ ] Add HTTP request tool
- [ ] Implement code analysis tool
- [ ] Create notification tool (email, Slack, etc.)
- [ ] Write tests for all tools

**Output**: Comprehensive tool library

---

## Phase 10: Testing & Quality 🧪 (2-3 days)

### 10.1 Comprehensive Testing
**Goal**: Ensure code quality and reliability

**Tasks**:
- [ ] Achieve >80% unit test coverage
- [ ] Create integration test suite
  - End-to-end task execution
  - Multi-agent workflows
  - API endpoint testing
- [ ] Add E2E UI tests
- [ ] Implement load testing
- [ ] Create test fixtures and mocks
- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Add test reporting

**Output**: Well-tested codebase

### 10.2 Performance Optimization
**Goal**: Optimize for Cloudflare Workers constraints

**Tasks**:
- [ ] Profile and optimize cold start time
- [ ] Optimize bundle size
- [ ] Add code splitting
- [ ] Implement caching strategies
- [ ] Optimize database queries
- [ ] Add performance monitoring
- [ ] Load test and optimize

**Output**: Performant application

---

## Phase 11: Documentation 📚 (1-2 days)

### 11.1 User Documentation
**Goal**: Create comprehensive user guides

**Tasks**:
- [ ] Write README.md
  - Project overview
  - Quick start guide
  - Installation instructions
- [ ] Create user guide
  - Task creation tutorial
  - Agent configuration guide
  - Tool usage examples
- [ ] Add API documentation
- [ ] Create troubleshooting guide
- [ ] Write deployment guide

**Output**: Complete user documentation

### 11.2 Developer Documentation
**Goal**: Enable contributor onboarding

**Tasks**:
- [ ] Update CLAUDE.md with final architecture
- [ ] Create architecture diagrams
- [ ] Write contributing guide
- [ ] Document code conventions
- [ ] Add inline code documentation
- [ ] Create example configurations
- [ ] Write changelog template

**Output**: Developer-friendly documentation

---

## Phase 12: Deployment & Operations 🚀 (1-2 days)

### 12.1 Production Deployment
**Goal**: Deploy to Cloudflare Workers

**Tasks**:
- [ ] Create production wrangler configuration
- [ ] Set up environment secrets
- [ ] Configure KV and D1 in production
- [ ] Deploy to production
- [ ] Set up custom domain
- [ ] Configure CDN caching
- [ ] Verify health checks

**Output**: Live production deployment

### 12.2 Monitoring & Logging
**Goal**: Observability for production

**Tasks**:
- [ ] Set up logging infrastructure
  - Structured logging
  - Log aggregation
- [ ] Add metrics and monitoring
  - Task execution metrics
  - LLM API usage tracking
  - Error rates
- [ ] Create alerting rules
- [ ] Set up uptime monitoring
- [ ] Create operational dashboard
- [ ] Write runbook for common issues

**Output**: Production-ready monitoring

---

## Success Metrics

### Technical Metrics
- [ ] Cold start time < 500ms
- [ ] API response time p95 < 200ms
- [ ] Test coverage > 80%
- [ ] Zero critical security vulnerabilities
- [ ] Uptime > 99.9%

### Functional Metrics
- [ ] Successfully parse natural language tasks
- [ ] Execute scheduled tasks reliably
- [ ] Support all three LLM providers
- [ ] Sub-agents can be dynamically configured
- [ ] UI responsive on mobile and desktop

---

## Risk Mitigation

### Technical Risks
- **Cloudflare Worker CPU/memory limits**: Use Sandbox SDK for heavy operations
- **LLM API rate limits**: Implement exponential backoff and queuing
- **Cold start latency**: Optimize bundle size, use warming strategies

### Operational Risks
- **Cost overruns**: Implement usage monitoring and limits
- **Security vulnerabilities**: Regular security audits, dependency updates
- **Data loss**: Regular backups, transaction logging

---

## Timeline Estimate

**Total Duration**: 6-8 weeks

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Foundation | 1-2 days | None |
| Phase 2: Core Agent | 3-4 days | Phase 1 |
| Phase 3: Storage | 2-3 days | Phase 1 |
| Phase 4: Scheduler | 3-4 days | Phase 2, 3 |
| Phase 5: Sub-Agents | 2-3 days | Phase 2 |
| Phase 6: Web UI | 3-4 days | Phase 1 |
| Phase 7: API Layer | 2-3 days | Phase 2, 3, 4 |
| Phase 8: Auth & Security | 2-3 days | Phase 6, 7 |
| Phase 9: Advanced Tools | 2-3 days | Phase 2 |
| Phase 10: Testing | 2-3 days | All phases |
| Phase 11: Documentation | 1-2 days | All phases |
| Phase 12: Deployment | 1-2 days | Phase 10, 11 |

**Note**: Phases can be parallelized where dependencies allow.

---

## Next Steps

1. ✅ Review and approve this plan
2. ✅ Phase 1.1: Project Initialization - Complete
3. ✅ Phase 1.2: Cloudflare Workers Setup - Mostly complete (pending wrangler dev test)
4. ✅ Phase 1.3: Project Structure - Complete
5. ⏳ Start Phase 2: Core Agent System
6. Set up project tracking (GitHub Projects/Issues)
7. Schedule regular progress reviews

---

## Phase 13: CLI Tool & GitHub Actions 💻 (2-3 days)

### 13.1 CLI Package
**Goal**: Create npm package for command-line usage

**Tasks**:
- [ ] Create CLI entry point (`src/cli/index.ts`)
- [ ] Implement command parser (using `commander` or `yargs`)
- [ ] Add interactive mode with prompts
- [ ] Add direct execution mode for single tasks
- [ ] Implement output formatting for CLI
- [ ] Add progress indicators and spinners
- [ ] Create package.json bin configuration
- [ ] Write CLI tests
- [ ] Test with `npm link` locally
- [ ] Publish to npm as `@duyetbot/agent`

**Output**: Published CLI tool (`npx @duyetbot/agent`)

### 13.2 GitHub Actions Integration
**Goal**: Enable CI/CD usage

**Tasks**:
- [ ] Create action.yml for GitHub Actions
- [ ] Add environment variable configuration
- [ ] Implement structured output for workflows
- [ ] Create example workflow files
- [ ] Add success/failure exit codes
- [ ] Test in actual GitHub Actions
- [ ] Write GitHub Actions documentation
- [ ] Publish to GitHub Actions marketplace

**Output**: GitHub Actions-ready package

### 13.3 Cross-Platform Support
**Goal**: Ensure Mac and Linux compatibility

**Tasks**:
- [ ] Test on macOS
- [ ] Test on Linux (Ubuntu, Debian)
- [ ] Handle platform-specific paths
- [ ] Test shell execution on both platforms
- [ ] Add platform detection
- [ ] Create platform-specific documentation
- [ ] Set up CI for both platforms

**Output**: Cross-platform verified package

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-18 | 1.5 | Phase 2 major progress: 186 tests passing. Completed Phase 2.1 (Claude provider), Phase 2.3 (3/4 tools + registry) |
| 2025-11-18 | 1.4 | Added Architecture Overview and Phase 13 for CLI tool & GitHub Actions support |
| 2025-11-18 | 1.3 | Phase 2.1 (partial): TDD implementation of provider types and factory with 35 tests |
| 2025-11-18 | 1.2 | Completed Phase 1.1-1.3: Project foundation with Biome linting, TypeScript, Vitest, and Cloudflare Workers setup |
| 2025-11-18 | 1.1 | Added maintenance workflow section with reference to CLAUDE.md |
| 2025-11-18 | 1.0 | Initial plan created |
