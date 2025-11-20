# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json ./

# Copy packages
COPY packages/types ./packages/types
COPY packages/mcp-memory ./packages/mcp-memory

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build packages
RUN pnpm --filter @duyetbot/types build
RUN pnpm --filter @duyetbot/mcp-memory build

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy built artifacts
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/mcp-memory/package.json ./packages/mcp-memory/
COPY --from=builder /app/packages/mcp-memory/dist ./packages/mcp-memory/dist

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile

# Create data directory
RUN mkdir -p /data

# Set environment
ENV NODE_ENV=production
ENV PORT=3001
ENV STORAGE_PATH=/data/memory.json

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "packages/mcp-memory/dist/index.js"]
