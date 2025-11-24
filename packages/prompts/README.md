# System Prompts for duyetbot-agent

This directory contains system prompts following Anthropic's prompt engineering best practices.

## Overview

System prompts define the agent's role, capabilities, and behavior guidelines. They use:

- **Role assignment** for domain expertise
- **XML tags** for structured responses
- **Clear guidelines** for task handling
- **Error handling** patterns
- **Safety restrictions**

## Available Prompts

### 1. Main Agent (`system-prompt.md`)
**Role**: Software development specialist

**Expertise**:
- Code analysis and architecture
- Git workflows and version control
- Task automation and planning
- DevOps and CI/CD

**Tools**: bash, git, plan, sleep

**Use for**: General development tasks, code analysis, automation

### 2. Research Specialist
**Role**: Information gathering and synthesis expert

**Expertise**:
- Web research and source validation
- Multi-source synthesis
- Technical documentation analysis
- Academic research

**Use for**: Investigating topics, gathering requirements, competitive analysis

### 3. Code Reviewer
**Role**: Senior software engineer focused on quality assurance

**Expertise**:
- Security vulnerabilities
- Performance optimization
- Code maintainability
- Best practices adherence

**Use for**: Pull request reviews, code audits, refactoring suggestions

### 4. Task Planner
**Role**: Project decomposition specialist

**Expertise**:
- Breaking down complex tasks
- Dependency analysis
- Risk assessment
- Execution strategy

**Use for**: Sprint planning, feature scoping, project estimation

## Usage

### TypeScript/JavaScript

```typescript
import { getSystemPrompt, buildSystemPrompt } from '@/prompts/system';

// Get a specific agent type
const defaultPrompt = getSystemPrompt('default');
const researchPrompt = getSystemPrompt('research');
const reviewerPrompt = getSystemPrompt('reviewer');
const plannerPrompt = getSystemPrompt('planner');

// Build with additional context
const customPrompt = buildSystemPrompt({
  type: 'default',
  additionalContext: 'This project uses TypeScript strict mode and follows TDD.',
});

// Use custom prompt
const fullyCustomPrompt = buildSystemPrompt({
  type: 'default',
  customPrompt: 'You are a specialized agent for...',
  additionalContext: 'Additional project-specific context...',
});
```

### With Agent

```typescript
import { Agent } from '@/agent/core';
import { getSystemPrompt } from '@/prompts/system';

const agent = new Agent({
  provider,
  sessionManager,
  toolRegistry,
});

// Add system message at session start
await agent.addMessage(sessionId, {
  role: 'system',
  content: getSystemPrompt('default'),
});
```

### With Provider

```typescript
import { ClaudeProvider } from '@/providers/claude';
import { getSystemPrompt } from '@/prompts/system';

const provider = new ClaudeProvider();
provider.configure({
  provider: 'claude',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Include system message in conversation
const messages = [
  { role: 'system', content: getSystemPrompt('default') },
  { role: 'user', content: 'Analyze this code...' },
];

for await (const response of provider.query(messages)) {
  console.log(response.content);
}
```

## Prompt Engineering Best Practices

Based on [Anthropic's official guidance](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview):

### 1. XML Tags for Structure
Use XML tags to organize complex prompts and responses:

```xml
<thinking>
  Step-by-step reasoning
</thinking>

<plan>
  Task breakdown
</plan>

<execution>
  Implementation
</execution>

<result>
  Summary
</result>
```

### 2. Chain of Thought
For complex reasoning, ask Claude to show its thinking:

```typescript
const messages = [
  { role: 'system', content: getSystemPrompt('default') },
  { role: 'user', content: 'Solve this complex problem: ...' },
  { role: 'assistant', content: '<thinking>' }, // Prefill to encourage reasoning
];
```

### 3. Role Specificity
More specific roles yield better results:

```typescript
// Generic (less effective)
'You are a data scientist.'

// Specific (more effective)
'You are a data scientist specializing in customer behavior analysis for SaaS companies, with expertise in Python, SQL, and statistical modeling.'
```

### 4. Few-Shot Examples
Include 2-3 examples for format/style guidance:

```typescript
const promptWithExamples = `${getSystemPrompt('default')}

## Example Interactions

<example>
User: Analyze the Agent class
Assistant:
<thinking>
Need to identify:
- Core responsibilities
- Key methods
- Dependencies
</thinking>

<result>
The Agent class (src/agent/core.ts:30) orchestrates:
1. LLM provider communication
2. Session lifecycle management
3. Tool execution and tracking
...
</result>
</example>
`;
```

### 5. Prompt Chaining
Break complex workflows into sequential prompts:

```typescript
// Step 1: Research
const researchResponse = await agent.sendMessage(sessionId, [
  { role: 'system', content: getSystemPrompt('research') },
  { role: 'user', content: 'Research best practices for...' },
]);

// Step 2: Plan
const planResponse = await agent.sendMessage(sessionId, [
  { role: 'system', content: getSystemPrompt('planner') },
  { role: 'user', content: `Based on research:\n${researchResponse}\n\nCreate implementation plan.` },
]);

// Step 3: Review
const reviewResponse = await agent.sendMessage(sessionId, [
  { role: 'system', content: getSystemPrompt('reviewer') },
  { role: 'user', content: `Review this plan:\n${planResponse}` },
]);
```

## Customization

### Project-Specific Context

Add project-specific guidelines via `additionalContext`:

```typescript
const prompt = buildSystemPrompt({
  type: 'default',
  additionalContext: `
## Project Context

This is a TypeScript project with:
- Strict mode enabled
- Biome for linting/formatting
- Vitest for testing
- TDD workflow (tests first)

## Code Standards

- Use functional programming patterns
- Prefer immutability
- Include JSDoc comments for public APIs
- Follow semantic commit format
`,
});
```

### Tool-Specific Instructions

Extend prompts with tool usage guidelines:

```typescript
const prompt = buildSystemPrompt({
  type: 'default',
  additionalContext: `
## Tool Usage Guidelines

### Git Operations
- Always use semantic commit messages
- Run tests before committing
- Never force push to main branch

### Bash Commands
- Validate paths before file operations
- Use dry-run mode for destructive operations
- Check command success with exit codes
`,
});
```

## Testing

Run tests for system prompts:

```bash
npm test tests/unit/prompts/system.test.ts
```

Tests verify:
- ✅ All prompts contain required sections
- ✅ XML tag structure is correct
- ✅ Agent types return appropriate prompts
- ✅ Custom prompts and context work correctly
- ✅ No trailing whitespace

## References

- [Anthropic Prompt Engineering Guide](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview)
- [Chain of Thought](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/chain-of-thought)
- [XML Tags](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags)
- [System Prompts](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/system-prompts)
- [Prompt Chaining](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/chain-prompts)
