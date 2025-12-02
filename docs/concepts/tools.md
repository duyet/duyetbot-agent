---
title: Tools
desc: "MCP servers (github-mcp/duyet-mcp/memory-mcp). Platform filters (Telegram/GitHub). Registry auto-discovers/registers."
sidebar_position: 6
keywords: [tools, mcp-servers, platform-filters, registry, github-mcp, memory-mcp]
slug: /core-concepts/tools
---

<!-- i18n: en -->

# Tools ✅

**TL;DR**: MCP servers provide tools. Filtered by platform. Registry auto-registers. Agents call via SDK.

## Table of Contents
- [MCP Servers](#mcp-servers)
- [Platform Filters](#platform-filters)
- [Registry](#registry)
- [Code Snippet](#code-snippet)

## MCP Servers

| Server | Tools | Platform | Status |
|--------|-------|----------|--------|
| github-mcp | GitHub API ops | GitHub | ✅ Live |
| duyet-mcp | Blog/CV/search | All | 🔄 Disabled (timeout) |
| memory-mcp | authenticate/save/get/search/list_sessions | All | ✅ D1-backed |

**Memory Tools**: See [Memory MCP →](./memory-mcp.md)

## Platform Filters

Tools filtered per-platform:

```typescript
getPlatformTools('telegram') // bash/git excluded
getPlatformTools('github')   // web_search prioritized
```

Reduces token waste. Registry handles.

## Registry

Agents auto-register MCP:

[`packages/mcp-servers/src/registry.ts`](packages/mcp-servers/src/registry.ts:63)
```typescript
await registerMcpServer(agent, 'github-mcp', env);
```

## Code Snippet

Dynamic tool list:

**Quiz**: MCP vs Built-in Tools?  
A: MCP external servers; Built-in local funcs ✅

**Glossary**: [MCP →](https://modelcontextprotocol.io/)

**Related**: [Memory →](./memory-mcp.md) | [Transports →](./transports.md)

**Try**: Deploy → Agents auto-use github-mcp tools!