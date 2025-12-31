# Parallel Task Execution

Delegate tasks to multiple agents working in parallel based on task complexity.

## Pattern

This command is based on your successful pattern of:
- Assigning simple/straightforward tasks to junior engineers
- Keeping complex/architectural work for senior engineers
- Running agents in parallel to maximize speed
- Coordinating results from multiple agents

## Usage

/parallel-task "<simple-task>" "<complex-task>"

/parallel-task "run the tests and deploy" "implement the core refactoring logic"

/parallel-task "fix lint issues" "design the new architecture"

/parallel-task "update documentation" "implement the feature"

## What This Does

1. **Spawns junior engineer agent** for the simple task:
   - Testing, deployment, linting, documentation
   - Clear, well-defined scope
   - Straightforward execution

2. **Spawns senior engineer agent** for the complex task:
   - Architecture design, core implementation
   - Requires experience and judgment
   - May involve multiple steps

3. **Runs both agents in parallel** to maximize speed

4. **Collects results** and presents coordinated summary

## Task Types

### Simple Tasks (Junior Engineer)
- Run tests: `bun run test`
- Deploy: `bun run deploy:telegram`
- Fix lint: `bun run check`
- Update docs
- Create boilerplate
- Run type-check

### Complex Tasks (Senior Engineer)
- Architecture design
- Core feature implementation
- Complex debugging
- Refactoring logic
- Performance optimization
- Security considerations

## Examples from Your History

### December 14 (8 refactor commits)
```
asking multiple senior and junior engineer agents

simple one can assign to junior engineer, complex to senior
```
Result: Successfully completed multiple refactors in parallel.

### December 14 (Parallel deployment)
```
#when run tests and deploy in parallel using senior engineer

#test, deploy and git push can run in parallel....
```
Result: Established pattern for parallel test/deploy/push workflows.

## Coordination

The command ensures:
- No overlapping file modifications
- Proper dependency ordering (core before apps)
- Coordinated git operations
- Unified reporting

## Success Indicators

Based on your successful sessions:
- Clear separation of simple vs complex tasks
- Both tasks can run independently
- Junior tasks are mechanical/well-defined
- Senior tasks require judgment/experience
- Results combined into single commit or PR
