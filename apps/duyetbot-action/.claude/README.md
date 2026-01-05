# Claude Plugins and Skills

This directory contains Claude Code plugins and skills for the duyetbot-action agent.

## Directory Structure

```
.claude/
├── agents/           # Subagent definitions
├── skills/           # Skill definitions
└── README.md         # This file
```

## Agents

Subagents that can be spawned for parallel task execution:

| Agent | Description |
|-------|-------------|
| `leader.md` | Technical Lead agent for coordinating complex tasks |
| `senior-engineer.md` | Senior Engineer agent for complex implementation work |
| `junior-engineer.md` | Junior Engineer agent for well-defined implementation tasks |

## Skills

Specialized knowledge modules for different domains:

### Team Agent Skills
- **task-decomposition** - Break down complex tasks into parallel workstreams
- **backend-api-patterns** - Backend and API implementation patterns
- **typescript-patterns** - TypeScript best practices and type safety
- **react-nextjs-patterns** - React and Next.js implementation patterns
- **quality-gates** - Quality verification procedures

### Domain Skills
- **frontend-design** - Frontend UI design with shadcn/ui and Recharts
- **terminal-ui-design** - Terminal/TUI design patterns
- **interview** - Socratic requirements discovery
- **orchestration** - Parallel agent orchestration patterns

## Auto-Update

Plugins are automatically synced from external sources:

**Manual sync:**
```bash
bun run sync:plugins
```

**Auto-sync:**
- GitHub cron workflow runs weekly on Sundays at midnight UTC
- Can be triggered manually via GitHub Actions UI

## Plugin Sources

- https://github.com/duyet/claude-plugins - Team agents, frontend design, terminal UI, interview
- https://github.com/numman-ali/cc-mirror - Orchestration skill

## Usage

These skills and agents are available as reference for the Claude agent. The agent can read them using the Read tool to understand patterns and best practices.

Future integration will include programmatic loading of skills into the agent execution loop.
