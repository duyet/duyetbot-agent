# Use Cases

**Related:** [Getting Started](getting-started.md) | [Architecture](architecture.md) | [API Reference](api.md) | [Deployment](deploy.md)

duyetbot is your personal AI assistant that helps automate daily workflows across CLI, GitHub, and Telegram.

---

## CLI & Terminal

### Interactive Chat
```bash
duyetbot chat
> Help me debug this error in my code
> Explain what this regex does: ^[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+$
```

### One-shot Questions
```bash
duyetbot ask "What's the best way to implement rate limiting in Node.js?"
duyetbot ask "Generate a SQL query to find duplicate emails"
```

### Code Generation
```bash
duyetbot run "Create a TypeScript function to validate credit card numbers"
duyetbot run "Write unit tests for the UserService class"
```

### Research & Analysis
```bash
duyetbot run "Compare React vs Vue vs Svelte for my next project"
duyetbot run "What's new in TypeScript 5.4?"
```

---

## GitHub Integration

### Code Review
```markdown
@duyetbot review this PR
@duyetbot check for security issues
@duyetbot suggest improvements for performance
@duyetbot review focusing on error handling
```

### PR Management
```markdown
@duyetbot merge this PR when CI passes
@duyetbot rebase and merge
@duyetbot squash and merge with message "feat: add user authentication"
@duyetbot close this PR with reason
```

### Issue Management
```markdown
@duyetbot triage this issue
@duyetbot add labels bug, high-priority
@duyetbot assign to @duyet
@duyetbot create subtasks for this feature request
@duyetbot find related issues
```

### Code Analysis
```markdown
@duyetbot explain this code
@duyetbot find where this function is called
@duyetbot what would break if I change this interface?
@duyetbot generate documentation for this module
```

### Testing & CI
```markdown
@duyetbot analyze why tests are failing
@duyetbot suggest tests for this function
@duyetbot check test coverage for this PR
@duyetbot run benchmarks and compare with master
```

### Release Management
```markdown
@duyetbot generate changelog for this release
@duyetbot create release notes from recent PRs
@duyetbot bump version and create tag
@duyetbot deploy to staging
```

---

## Telegram Bot

### Quick Queries
```
/chat What time is it in Tokyo?
/chat Convert 100 USD to EUR
/chat What's the weather forecast for tomorrow?
```

### Development Help
```
/chat How do I fix "cannot read property of undefined"?
/chat Best practices for Docker multi-stage builds
/chat Explain OAuth 2.0 flow
```

### Status & Monitoring
```
/status Check if my servers are up
/status Show recent deployments
/status Any failed CI builds?
```

### Notifications
- Get notified when PR is approved
- Alert on deployment failures
- Daily summary of GitHub activity
- Reminder for stale PRs

---

## Automation & Proactive Tasks

### Auto-merge PRs
```markdown
@duyetbot auto-merge when:
- All CI checks pass
- At least 1 approval
- No unresolved comments
```

### Morning Briefing
```
Every morning at 8am:
- Summary of overnight GitHub activity
- Important emails/messages
- Calendar events for the day
- Tech news highlights
- Weather forecast
```

### Code Quality
```markdown
@duyetbot setup:
- Auto-review all PRs for security issues
- Flag PRs with large diffs
- Suggest breaking into smaller PRs
- Check for missing tests
```

### Dependency Management
```markdown
@duyetbot weekly:
- Check for outdated dependencies
- Create PRs for security updates
- Summarize breaking changes
```

### Documentation
```markdown
@duyetbot on PR merge:
- Update API documentation
- Generate changelog entry
- Update README if needed
```

---

## Research & Information

### Tech Research
```bash
duyetbot run "Compare different vector databases for my RAG system"
duyetbot run "What are the trade-offs of microservices vs monolith?"
duyetbot run "Best practices for Kubernetes security"
```

### Learning
```bash
duyetbot run "Explain event sourcing with examples"
duyetbot run "How does the V8 garbage collector work?"
duyetbot run "Tutorial on building a language server"
```

### News & Updates
```bash
duyetbot run "What's new in the JavaScript ecosystem this week?"
duyetbot run "Latest security vulnerabilities in npm packages"
duyetbot run "AI/ML news summary for today"
```

---

## Development Workflow

### Project Setup
```bash
duyetbot run "Setup a new TypeScript project with ESLint, Prettier, and Vitest"
duyetbot run "Create a Dockerfile for this Node.js app"
duyetbot run "Generate GitHub Actions workflow for CI/CD"
```

### Debugging
```markdown
@duyetbot analyze this error log and suggest fixes
@duyetbot why is this test flaky?
@duyetbot profile this function for performance issues
```

### Refactoring
```markdown
@duyetbot refactor this function to be more readable
@duyetbot extract this into a reusable utility
@duyetbot convert this callback to async/await
@duyetbot apply SOLID principles to this class
```

### Database
```bash
duyetbot run "Generate migration for adding user roles"
duyetbot run "Optimize this SQL query"
duyetbot run "Create indexes for this table based on query patterns"
```

---

## Personal Assistant

### Task Management
```
/chat Add "Review PR #123" to my todo list
/chat What's on my agenda today?
/chat Remind me to deploy at 5pm
```

### Communication
```markdown
@duyetbot draft a response to this issue
@duyetbot summarize this long discussion
@duyetbot translate this to Japanese
```

### Organization
```bash
duyetbot run "Organize my notes on Kubernetes"
duyetbot run "Create a mind map for this feature"
duyetbot run "Summarize this meeting transcript"
```

---

## Example Workflows

### Morning Routine
1. Check Telegram for morning briefing
2. Review overnight PRs flagged by @duyetbot
3. Address any critical issues
4. Ask about daily schedule

### PR Review Flow
1. Open PR → @duyetbot auto-reviews
2. @duyetbot suggests improvements
3. Author addresses feedback
4. @duyetbot approves and auto-merges

### Research Flow
1. Ask @duyetbot to research a topic
2. Review summary and sources
3. Ask follow-up questions
4. Generate documentation from findings

### Incident Response
1. Alert received via Telegram
2. @duyetbot analyzes logs and suggests cause
3. Create issue with findings
4. @duyetbot monitors fix deployment

---

## Configuration Examples

### Auto-review all PRs
```json
{
  "github": {
    "autoReview": {
      "enabled": true,
      "focus": ["security", "performance", "tests"]
    }
  }
}
```

### Morning briefing schedule
```json
{
  "schedules": [
    {
      "name": "morning-briefing",
      "cron": "0 8 * * *",
      "task": "Generate morning summary with: GitHub activity, calendar, weather, news"
    }
  ]
}
```

### Auto-merge rules
```json
{
  "github": {
    "autoMerge": {
      "enabled": true,
      "conditions": {
        "ciPassing": true,
        "minApprovals": 1,
        "noUnresolved": true,
        "labels": ["auto-merge"]
      }
    }
  }
}
```

---

## Coming Soon

- Voice interface via Telegram
- Slack/Discord integration
- Custom tool creation
- Multi-agent workflows
- Memory search across all conversations
- Calendar integration
- Email management

---

## Next Steps

- [Getting Started](README.md) - Installation and setup
- [Architecture](ARCHITECTURE.md) - How it works
- [Deployment](DEPLOY.md) - Deploy your own instance
