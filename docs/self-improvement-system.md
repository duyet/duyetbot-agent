# Self-Improvement System Design

## Vision

The agent learns from its failures and improves over time, becoming more capable with each task it completes.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Self-Improvement Loop                        │
│                                                                  │
│  Task Start → Execute → [Verify] → Success? → PR                │
│                     │          │                                │
│                     │          └── No ──► [Error Analyzer]      │
│                     │                      │                    │
│                     │                      ▼                    │
│                     │                 [Fix Generator]          │
│                     │                      │                    │
│                     │                      ▼                    │
│                     │◄───────────────── [Retry]                │
│                     │                                            │
│                     └──► After PR ──► [Post-Mortem]             │
│                                        │                        │
│                                        ▼                        │
│                                   [Store Patterns]             │
│                                        │                        │
│                                        ▼                        │
│                                   [Failure Memory]             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Error Analyzer (`error-analyzer.ts`)

**Purpose**: Parse and categorize errors to understand what went wrong.

**Error Categories**:
- **Build Errors**: Compilation, dependency issues
- **Type Errors**: TypeScript type mismatches
- **Lint Errors**: Code style violations
- **Test Failures**: Specific test failures
- **Runtime Errors**: Execution failures

**Features**:
- Parse error messages from various tools
- Extract file location, line number, error code
- Categorize by severity and type
- Suggest potential fixes based on patterns

### 2. Fix Generator (`fix-generator.ts`)

**Purpose**: Generate targeted fixes for common errors.

**Fix Strategies**:
- **Type Fix**: Add/move type definitions, fix type annotations
- **Import Fix**: Add missing imports, remove unused ones
- **Syntax Fix**: Correct syntax errors
- **Logic Fix**: Fix bugs based on test failures
- **Pattern Fix**: Apply known working patterns

**Features**:
- Generate code patches using AST analysis
- Apply fixes automatically or suggest for review
- Validate fixes before applying
- Rollback on failure

### 3. Verification Loop (`verification-loop.ts`)

**Purpose**: Ensure quality before creating PRs.

**Checks**:
- `bun run type-check` - TypeScript validation
- `bun run lint` - Code style checks
- `bun run test` - Run test suite
- `bun run build` - Verify build succeeds

**Flow**:
```typescript
async function verifyAndPR(workDir: string): Promise<boolean> {
  const checks = [
    { name: 'type-check', command: 'bun run type-check' },
    { name: 'lint', command: 'bun run lint' },
    { name: 'test', command: 'bun run test' },
    { name: 'build', command: 'bun run build' },
  ];

  for (const check of checks) {
    const result = await runCommand(check.command, { cwd: workDir });
    if (!result.success) {
      // Trigger error recovery
      await recoverFromError(check.name, result.output);
      return false;
    }
  }

  // All checks passed, create PR
  await createPR();
  return true;
}
```

### 4. Failure Memory (`failure-memory.ts`)

**Purpose**: Store and retrieve learned patterns from past failures.

**Schema**:
```typescript
interface FailurePattern {
  id: string;
  category: ErrorCategory;
  pattern: string;        // Error pattern regex
  symptom: string;        // What the error looks like
  solution: string;       // How to fix it
  frequency: number;      // How often this occurs
  lastSeen: number;       // Timestamp
  successRate: number;    // How often the fix works
}

interface LearnedFix {
  errorSignature: string;
  fix: CodeChange;
  appliedAt: number;
  worked: boolean;
}
```

**Features**:
- Store error patterns and successful fixes
- Retrieve based on error similarity
- Update success rates over time
- Prune ineffective patterns

### 5. Post-Mortem Analyzer (`post-mortem.ts`)

**Purpose**: Review completed tasks and extract lessons learned.

**Analysis**:
- What errors were encountered?
- What fixes were successful?
- What could have been done better?
- What patterns should be remembered?

**Output**:
- Updated failure patterns
- New successful strategies
- Improved prompts for similar tasks

## Integration with Existing System

### Checkpoint Enhancement

Extend checkpoints to include error recovery state:

```typescript
interface Checkpoint {
  // ... existing fields ...
  recoveryAttempts?: number;
  lastError?: {
    type: ErrorCategory;
    message: string;
    fixAttempted?: string;
  };
}
```

### Agent Loop Enhancement

```typescript
class AgentLoop {
  async run(): Promise<AgentResult> {
    // ... existing code ...

    try {
      const result = await this.execute();

      // Verify before returning
      if (result.success && !this.options.dryRun) {
        const verification = await this.verify(result);
        if (!verification.passed) {
          return await this.recover(verification.errors);
        }
      }

      // Post-mortem analysis
      await this.postMortem(result);

      return result;
    } catch (error) {
      return await this.recover([error]);
    }
  }
}
```

## Implementation Phases

### Phase 1: Error Detection & Verification (Immediate)
- Add verification loop before PR creation
- Detect and report common errors
- No auto-fix yet, just better error messages

### Phase 2: Simple Auto-Fix (Short-term)
- Fix common issues automatically:
  - Missing imports
  - Type errors
  - Lint violations
- Store successful fixes in memory

### Phase 3: Pattern Learning (Medium-term)
- Build failure pattern database
- Learn from multiple similar errors
- Suggest fixes based on past success

### Phase 4: Full Self-Improvement (Long-term)
- Continuous learning from all tasks
- Automatic prompt improvement
- Self-optimization of strategies
- Cross-task knowledge transfer

## Success Metrics

- **Error Recovery Rate**: % of errors automatically fixed
- **PR Success Rate**: % of PRs that pass CI on first try
- **Reduced Iterations**: Fewer retry cycles needed
- **Knowledge Growth**: Number of stored patterns grows over time
- **Time Savings**: Less human intervention needed

## File Structure

```
apps/duyetbot-action/src/
├── self-improvement/
│   ├── index.ts                    # Main export
│   ├── error-analyzer.ts           # Error parsing & categorization
│   ├── fix-generator.ts            # Generate and apply fixes
│   ├── verification-loop.ts        # Pre-PR checks
│   ├── failure-memory.ts           # Pattern storage & retrieval
│   ├── post-mortem.ts              # Post-task analysis
│   └── types.ts                    # Shared types
├── agent/
│   ├── loop.ts                     # Enhanced with recovery
│   └── checkpoint.ts               # Enhanced with error state
└── prompts/
    └── sections/
        └── self-improvement.ts     # Enhanced instructions
```
