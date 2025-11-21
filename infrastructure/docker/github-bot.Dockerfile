# GitHub Bot Dockerfile
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/providers/package.json ./packages/providers/
COPY packages/tools/package.json ./packages/tools/
COPY packages/core/package.json ./packages/core/
COPY apps/github-bot/package.json ./apps/github-bot/

RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/providers/node_modules ./packages/providers/node_modules
COPY --from=deps /app/packages/tools/node_modules ./packages/tools/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/apps/github-bot/node_modules ./apps/github-bot/node_modules

COPY . .
RUN pnpm run build --filter @duyetbot/github-bot

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

CMD ["node", "apps/github-bot/dist/index.js"]
