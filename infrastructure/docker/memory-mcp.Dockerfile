# Memory MCP Server Dockerfile (Cloudflare Workers build test)
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/memory-mcp/package.json ./packages/memory-mcp/

RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/memory-mcp/node_modules ./packages/memory-mcp/node_modules

COPY . .
RUN pnpm run build --filter @duyetbot/memory-mcp

# Verify build output exists
RUN test -d packages/memory-mcp/dist && echo "Build successful"
