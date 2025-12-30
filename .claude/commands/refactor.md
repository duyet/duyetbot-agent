# Refactor Target Module

Refactor a specific module following established patterns from the codebase.

## Pattern

This command is based on successful refactoring sessions where you:
- Specified the target module with `@module-name`
- Referenced a pattern or architecture to follow
- Applied the refactor systematically
- Deployed and verified changes

## Usage

/refactor @<module-name> --pattern <pattern-name>

/refactor @packages/cloudflare-agent/src/cloudflare-agent.ts --pattern transport-layer

/refactor @apps/telegram-bot/src/ --pattern transport-abstraction

/refactor @packages/core/src/ --pattern modular-architecture

## What This Does

1. **Read and understand** the target module structure
2. **Analyze** the specified pattern from docs/architecture.md or PLAN.md
3. **Identify** files and components that need refactoring
4. **Apply** the refactor following the pattern
5. **Run** `bun run check` to verify no type errors
6. **Run** relevant tests with `bun run test --filter <package>`
7. **Show** summary of changes made

## Available Patterns

- `transport-layer` - Platform abstraction pattern (~50 lines per app)
- `modular-architecture` - Extract modules with clear boundaries
- `discriminated-unions` - Use TypeScript discriminated unions for types
- `loop-based-agent` - Single agent with tool iteration loop
- `mcp-integration` - MCP server integration pattern

## Examples from Your History

### November 22 (11 commits)
```
refactoring @apps/telegram-bot/ as following the transport layer pattern
```
Result: Successfully refactored telegram-bot to use transport abstraction.

### December 14 (8 commits)
```
refactoring @packages/cloudflare-agent/src/cloudflare-agent.ts
continue about stronger types refactor, no need backward compatibility
```
Result: Completed modular architecture migration with discriminated unions.

## Success Indicators

Based on your successful sessions:
- Clear module target with `@` syntax
- Reference to existing pattern/docs
- Focus on one architectural change at a time
- Followed by deployment and testing
