# Plan First Workflow

Update documentation (PLAN.md, architecture docs) before implementing changes.

## Pattern

This command is based on your successful pattern of documenting requirements first:
- State the requirement clearly
- Update PLAN.md to reflect the plan
- Update architecture docs if needed
- Create permanent record of the decision
- Then implement

## Usage

/plan-first "<requirement-or-feature>"

/plan-first "Add MCP server integration for Slack"

/plan-first "Implement rate limiting for guest users"

/plan-first "Refactor to use discriminated unions for ExecutionStep types"

## What This Does

1. **Captures the requirement**:
   - What needs to be done
   - Why it's needed
   - Success criteria

2. **Updates PLAN.md**:
   - Adds task to appropriate phase
   - Marks as `[ ]` (not started)
   - Includes context and rationale

3. **Updates architecture docs** if needed:
   - docs/architecture.md for system changes
   - CLAUDE.md for workflow changes
   - Package-specific READMEs

4. **Creates implementation plan**:
   - Files to modify
   - Dependencies to consider
   - Testing strategy

5. **Prompts for confirmation** before implementation

## Examples from Your History

### November 22 (MCP Server Planning)
```
update the plan, packages/mcp-servers will be created

there are two kind of agents in the system
```
Result: Updated PLAN.md, documented architecture, then implemented.

### December 14 (Requirement Documentation)
```
this is my requirement, must note it somewhere permanent
```
Result: Created permanent record in PLAN.md before coding.

### November 22 (Architecture Documentation)
```
/sc:design now update the PLAN.md and @docs/architecture.md
```
Result: Updated both PLAN.md and architecture docs before implementation.

## Documentation Locations

The command updates the appropriate docs:

- **PLAN.md**: Implementation roadmap and tasks
- **docs/architecture.md**: System design and patterns
- **CLAUDE.md**: Project-specific guidance for Claude Code
- **Package READMEs**: Package-specific documentation
- **docs/deployment.md**: Deployment procedures

## Why This Pattern Works

Based on your successful sessions:
- **Clarifies thinking**: Writing requirements forces clarity
- **Permanent record**: Anyone (including future you) can understand why
- **Reduced rework**: Planning prevents scope creep
- **Better commits**: Implementation follows documented plan
- **Easier handoff**: Clear documentation for collaboration

## After Documentation

Once documentation is updated:
1. Review the plan
2. Adjust if needed
3. Use `/refactor`, `/parallel-task`, or `/fix-and-push` to implement
4. Mark tasks as `[x]` in PLAN.md as you complete them
