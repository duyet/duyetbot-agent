# GitHub Bot Dockerfile
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
RUN bun run build --filter @duyetbot/github-bot

# Production
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/providers/dist ./packages/providers/dist
COPY --from=builder /app/packages/providers/package.json ./packages/providers/
COPY --from=builder /app/packages/tools/dist ./packages/tools/dist
COPY --from=builder /app/packages/tools/package.json ./packages/tools/
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/apps/github-bot/dist ./apps/github-bot/dist
COPY --from=builder /app/apps/github-bot/package.json ./apps/github-bot/
COPY --from=builder /app/apps/github-bot/templates ./apps/github-bot/templates

EXPOSE 3001
CMD ["bun", "run", "apps/github-bot/dist/index.js"]
