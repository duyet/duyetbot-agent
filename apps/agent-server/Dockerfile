# Agent Server Dockerfile
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.* ./
COPY packages ./packages
COPY apps ./apps
COPY tests ./tests
RUN find . -name "*.ts" -o -name "*.tsx" -o -name "src" -type d | xargs rm -rf 2>/dev/null || true && \
    bun install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app .
COPY . .
RUN bun run build --filter @duyetbot/agent-server

# Production
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV WS_PORT=8080
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/providers/dist ./packages/providers/dist
COPY --from=builder /app/packages/providers/package.json ./packages/providers/
COPY --from=builder /app/packages/tools/dist ./packages/tools/dist
COPY --from=builder /app/packages/tools/package.json ./packages/tools/
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/apps/agent-server/dist ./apps/agent-server/dist
COPY --from=builder /app/apps/agent-server/package.json ./apps/agent-server/

EXPOSE 3000 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
CMD ["bun", "run", "apps/agent-server/dist/index.js"]
