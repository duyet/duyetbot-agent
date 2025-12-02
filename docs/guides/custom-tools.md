---
title: Custom MCP Tools
description: "Add MCP tool: Create in packages/tools/src/. Export index.ts. Register registry.ts. Test Vitest."
---

<!-- i18n: en -->

**TL;DR**: `packages/tools/src/my-tool.ts` → export `index.ts` → register `registry.ts`. `bun run test`. ✅ MCP live.

## Table of Contents
- [Tutorial](#tutorial)
- [Snippet](#snippet)
- [Register](#register)

## Tutorial

From [`contributing.md`](/docs/community/contributing):

1. Create tool [`packages/tools/src/my-tool.ts`](packages/tools/src/my-tool.ts):
2. Export [`packages/tools/src/index.ts`](packages/tools/src/index.ts)
3. Register [`packages/tools/src/registry.ts`](packages/tools/src/registry.ts)
4. Test: `bun run test --filter @duyetbot/tools`

## Snippet

```typescript
import { tool } from '@anthropic/claude-sdk';
import { z } from 'zod';

export const myTool = tool(
  'my_tool',
  'Description of what it does',
  z.object({
    input: z.string().describe('Input parameter'),
  }),
  async ({ input }) => {
    // Implementation
    return { result: 'output' };
  }
);
```

## MCP Context

[`CLAUDE.md`](CLAUDE.md:180): Model Context Protocol tools.

**Quiz**: Register where?  
A: packages/tools/src/registry.ts ✅

**Pro Tip** ✅: 10+ built-in tools.

**CTA**: Build tool → [Fork/PR](https://github.com/duyet/duyetbot-agent/fork)

**Contrib**: "Added X MCP tool via Y!"

**Next**: [Custom DO →](custom-do.md)