---
title: Git Hooks
desc: Install pre-push hooks. Enforce Biome linting + Vitest tests. Cross-platform Bun script.
sidebar_position: 2
keywords: [hooks, pre-push, biome, vitest, lint, test]
slug: developer-hub/contribute/hooks
---

<!-- i18n: en -->

# Git Hooks

**TL;DR**: `bun scripts/install-hooks.ts`. Blocks push if `bun run check` or `bun run test` fails. ✅ Enforced.

## Table of Contents
- [Install](#install)
- [What It Runs](#what-it-runs)
- [Bypass](#bypass)

## Install

Run once:

```bash
bun scripts/install-hooks.ts
```

From [`scripts/install-hooks.ts`](scripts/install-hooks.ts:1):

- Creates `.git/hooks/pre-push`
- Copies `.claude/hooks/pre-push.sh`
- `chmod +x`

## What It Runs

Pre-push hook executes:

```bash
bun run check  # Biome lint + types
bun run test   # 700+ tests
```

From [`CLAUDE.md`](CLAUDE.md:97).

## Bypass

Temporary: `git push --no-verify`

**Quiz**: Hook blocks if?  
A: Tests fail ✅

**Pro Tip** ✅: Hooks ensure quality.

**CTA**: `bun scripts/install-hooks.ts` → Push safely!

**Next**: [DO Patterns →](../internals/do-patterns.md)