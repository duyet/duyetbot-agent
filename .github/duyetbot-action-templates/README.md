# duyetbot-action Templates

This directory contains templates for duyetbot-action jobs.

## Available Job Templates

### Security Scan
```yaml
job_type: security
```
Performs comprehensive security audit including dependency vulnerabilities, code security issues, secrets detection, and configuration security.

### Dependency Updates
```yaml
job_type: deps
```
Updates dependencies to latest stable versions with priority: security > bug fixes > minor > major.

### Code Quality
```yaml
job_type: quality
```
Improves code quality through TypeScript fixes, lint resolution, refactoring, and documentation.

### Documentation
```yaml
job_type: docs
```
Generates and improves documentation including API docs (JSDoc), usage guides, README improvements.

### Test Coverage
```yaml
job_type: coverage
```
Analyzes test coverage and adds meaningful tests for uncovered code paths.

### Performance
```yaml
job_type: performance
```
Profiles and optimizes performance including bundle size, runtime bottlenecks, memory usage.

### SOTA Research
```yaml
job_type: sota
```
Researches latest AI tech including new LLM models, agent frameworks, developer tools, MCP servers.

### Cleanup
```yaml
job_type: cleanup
```
Cleans up repository including stale branches, issues, unused dependencies, orphaned files.

### Issue Triage
```yaml
job_type: triage
```
Triages GitHub issues with labels (bug/enhancement/question/docs), priority (1-5), categorization.

### API Review
```yaml
job_type: api-review
```
Reviews API changes including breaking changes, experimental APIs, deprecated usage, type changes.

### Nightly Analysis
```yaml
job_type: nightly
```
Comprehensive repository analysis: fix bugs, implement features, improve quality/tests/docs.

## Usage

### Manual Trigger
```bash
gh workflow run duyetbot-action.yml \
  --task "Analyze the codebase and suggest improvements" \
  -f dry_run=false
```

### Scheduled Trigger
See `.github/workflows/duyetbot-action-cronjob.yml` for schedule configuration.

### Issue Trigger
Add `agent-task` label to any GitHub issue.

### PR Comment Trigger
Comment `@duyetbot <task description>` on any PR.

## Custom Job Prompts

To create a custom job, use the `task` input in `duyetbot-action.yml`:

```bash
gh workflow run duyetbot-action.yml \
  --task "Your custom task description here"
```

## Schedule Reference

| Job Type | Schedule (UTC) |
|----------|----------------|
| security | Daily 6 AM |
| deps | Monday 10 AM |
| quality | Wednesday 2 PM |
| sota | Friday 6 PM |
| coverage | Tuesday 4 PM |
| performance | Thursday 8 AM |
| docs | Sunday 12 PM |
| triage | Every 4 hours |
| api-review | Daily 8 PM |
| cleanup | Monthly 1st 3 AM |
| nightly | Daily 2 AM |
