---
title: MCP Tool Naming Convention & Auto-Discovery
---

# MCP Tool Naming Convention & Auto-Discovery

## Overview

Implement a standardized tool naming convention `<mcp>__<tool>` for all MCP-sourced tools and enable agent auto-discovery of available MCPs and their tools.

## Goals

1. **Consistent naming**: All MCP tools follow `<mcp>__<tool>` format (e.g., `duyet__get_cv`, `memory__save`)
2. **Auto-discovery**: Agent can discover MCPs and tools at runtime
3. **Transparency**: Agent can list all MCPs and available tools to user
4. **Clean separation**: Built-in tools remain without prefix, MCP tools have prefix

## Current State Analysis

### Existing Tools
| Tool | Type | Current Name | New Name |
|------|------|--------------|----------|
| plan | Built-in | `plan` | `plan` (no change) |
| research | Built-in | `research` | `research` (no change) |
