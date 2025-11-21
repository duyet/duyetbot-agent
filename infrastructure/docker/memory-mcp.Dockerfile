# Memory MCP Server Dockerfile (Cloudflare Workers build test)
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
COPY packages ./packages
COPY apps ./apps
RUN find . -name "*.ts" -o -name "*.tsx" -o -name "src" -type d | xargs rm -rf 2>/dev/null || true && \
    bun install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app .
COPY . .
RUN bun run build --filter @duyetbot/memory-mcp
