---
title: Fork & PR
description: Fork repo. Create feat/fix branch. Semantic commits. Run checks/tests. Push. Open PR. Sign CLA.
---

<!-- i18n: en -->

**TL;DR**: Fork duyetbot-agent. `git checkout -b feat/my-feature`. `bun run check && bun run test`. Semantic commit. Push. PR. ✅ CLA auto.

## Table of Contents
- [Fork Repo](#fork-repo)
- [Create Branch](#create-branch)
- [Make Changes](#make-changes)
- [Test & Commit](#test--commit)
- [Push & PR](#push--pr)
- [CLA](#cla)

## Fork Repo

1. Click **Fork** on [GitHub](https://github.com/duyet/duyetbot-agent).
2. Clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/duyetbot-agent.git
cd duyetbot-agent
bun install
```

## Create Branch

From [`CLAUDE.md`](CLAUDE.md:94):

```bash
git checkout -b feat/your-feature-name
```

## Make Changes

- Follow patterns in [`PLAN.md`](PLAN.md).
- Update [`PLAN.md`](PLAN.md) checkboxes.

## Test & Commit

Pre-push enforces:

```bash
bun run check  # Lint + types
bun run test   # All tests
git add .
git commit -m "feat: add your feature"
```

Types: `feat` | `fix` | `docs` | `test` | `refactor`.

## Push & PR

```bash
git push origin feat/your-feature-name
```

Open PR on GitHub. Link issues.

## CLA

By contributing, agree MIT License per [`contributing.md`](/docs/community/contributing).

**Quiz**: Commit for docs update?  
A: `docs: update guide` ✅

**Pro Tip** ✅: Read [`PLAN.md`](PLAN.md) first.

**CTA**: [Fork & PR now](https://github.com/duyet/duyetbot-agent/fork){{t('cta.fork')}}

**Next**: [Git Hooks ->](hooks.md)