# Memory MCP Server Dockerfile (Cloudflare Workers build test)
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/types/package.json packages/types/
COPY packages/providers/package.json packages/providers/
COPY packages/tools/package.json packages/tools/
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/server/package.json packages/server/
COPY packages/memory-mcp/package.json packages/memory-mcp/
COPY packages/config-typescript/package.json packages/config-typescript/
COPY packages/config-vitest/package.json packages/config-vitest/
COPY apps/github-bot/package.json apps/github-bot/
RUN bun install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app .
COPY . .
RUN bun run build --filter @duyetbot/memory-mcp && \
    test -d packages/memory-mcp/dist && echo "Build successful"
