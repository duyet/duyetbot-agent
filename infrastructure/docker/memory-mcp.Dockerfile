# Memory MCP Server Dockerfile (Cloudflare Workers build test)
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/*/package.json ./packages/
COPY apps/*/package.json ./apps/
RUN for f in packages/*.json apps/*.json; do \
      dir=$(basename "$f" .json); \
      if echo "$f" | grep -q "^packages/"; then mkdir -p "packages/$dir" && mv "$f" "packages/$dir/package.json"; \
      else mkdir -p "apps/$dir" && mv "$f" "apps/$dir/package.json"; fi; \
    done && bun install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY . .
RUN bun run build --filter @duyetbot/memory-mcp && \
    test -d packages/memory-mcp/dist && echo "Build successful"
