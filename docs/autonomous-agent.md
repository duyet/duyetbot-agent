---
title: Autonomous Agent System
description: AI-powered repository maintenance and improvement system
---

# Autonomous Agent System

The **duyetbot-action** autonomous agent system provides AI-powered repository maintenance and improvement.

## Quick Start

### Manual Task
```bash
gh workflow run duyetbot-action.yml \
  --task "Analyze the codebase and suggest improvements" \
  -f dry_run=false
```

### From Issue
Add `agent-task` label to any GitHub issue.

### From PR Comment
Comment `@duyetbot <task description>` on any PR.

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `duyetbot-action.yml` | Manual / Issue / PR comment | Main workflow with multiple triggers |
| `duyetbot-action-cronjob.yml` | Scheduled | Automated maintenance jobs |

### duyetbot-action.yml Triggers

| Trigger Type | Activation | Behavior |
|--------------|------------|----------|
| Manual Dispatch | `gh workflow run` | Run custom tasks with model/source selection |
| Issue Label | `agent-task` label added | Auto-processes issue content as task |
| PR Comment | `@duyetbot` mention | Responds to comment with task execution |

## Scheduled Jobs

| Job | Schedule (UTC) | Description |
|-----|----------------|-------------|
| security | Daily 6 AM | Security vulnerability scan |
| deps | Monday 10 AM | Dependency updates |
| quality | Wednesday 2 PM | Code quality improvements |
| sota | Friday 6 PM | Latest AI tech research |
| coverage | Tuesday 4 PM | Test coverage improvement |
| performance | Thursday 8 AM | Performance profiling |
| docs | Sunday 12 PM | Documentation generation |
| triage | Every 4 hours | Issue labeling |
| api-review | Daily 8 PM | API change detection |
| cleanup | Monthly 1st 3 AM | Repository cleanup |
| nightly | Daily 2 AM | Comprehensive analysis |

## Usage

### Run Scheduled Job Manually
```bash
gh workflow run duyetbot-action-cronjob.yml \
  -f job_type=security \
  -f dry_run=true
```

### Create Task Issue
```bash
gh issue create \
  --title "Security audit needed" \
  --body "Please check for security vulnerabilities" \
  --label "agent-task,priority-1"
```

### PR Comment
```
@duyetbot fix the type error in this function
```

## Templates

See `.github/duyetbot-action-templates/README.md` for available job templates.
