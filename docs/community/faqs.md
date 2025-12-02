---
title: FAQs
description: Deploy? Docker? LLM rates? Memory? Accordion answers from deployment/PLAN.md.
---

<!-- i18n: en -->

**TL;DR**: Deploy: `bun run deploy`. No Docker (Cloudflare Workers). LLM: OpenRouter via AI Gateway. Memory: D1/KV. ✅ Edge-first.

<details>
<summary>How deploy?</summary>

`bun install && bunx wrangler login && bun scripts/config.ts telegram && bun run deploy:telegram`

From [`guides/deployment`](/docs/guides/deployment).

</details>

<details>
<summary>Docker support?</summary>

No native Docker. Cloudflare Workers/DO/D1. Future: docker-compose.yml planned.

</details>

<details>
<summary>LLM rates/costs?</summary>

OpenRouter via AI Gateway. Free tier Grok. Pay-per-token. Monitor `tokensUsed`.

</details>

<details>
<summary>Memory limits?</summary>

D1 (SQLite) + KV. Cross-session MCP. User-isolated. Vectorize future [`PLAN.md`](PLAN.md:662).

</details>

**Quiz**: Deploy command?  
A: `bun run deploy` ✅

**Pro Tip** ✅: Cloudflare free idle.

**CTA**: Stuck? [Troubleshooting](troubleshooting.md) | [Feedback ↓](feedback.md)