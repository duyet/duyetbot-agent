# Troubleshooting Guide

Common issues and solutions for DuyetBot Web.

## Table of Contents

- [Development Issues](#development-issues)
- [Build Issues](#build-issues)
- [Deployment Issues](#deployment-issues)
- [Database Issues](#database-issues)
- [Authentication Issues](#authentication-issues)
- [Chat and AI Issues](#chat-and-ai-issues)
- [Performance Issues](#performance-issues)

---

## Development Issues

### Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 bun dev
```

### Module Not Found

**Error:**
```
Cannot find module '@duyetbot/xyz'
```

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules bun.lockb
bun install

# Build workspace packages
bun run build
```

### TypeScript Errors

**Error:**
```
Type 'X' is not assignable to type 'Y'
```

**Solution:**
1. Check if types are up to date:
   ```bash
   bun run type-check
   ```
2. Rebuild packages:
   ```bash
   bun run build
   ```
3. Restart TypeScript server in your IDE

### Environment Variables Not Loading

**Symptoms:** API keys not working, undefined values

**Solution:**
1. Check file exists:
   ```bash
   ls -la .env.local
   ```
2. Verify format (no spaces around `=`):
   ```bash
   OPENROUTER_API_KEY=sk-xxx  # Correct
   OPENROUTER_API_KEY = sk-xxx  # Wrong
   ```
3. Restart dev server after changes

---

## Build Issues

### Next.js Build Fails

**Error:**
```
Build error occurred
```

**Solution:**
1. Check for type errors:
   ```bash
   bun run type-check
   ```
2. Clear Next.js cache:
   ```bash
   rm -rf .next out
   bun run build
   ```

### Wrangler Build Errors

**Error:**
```
Could not resolve "xyz"
```

**Solution:**
1. Check compatibility flags in `wrangler.toml`:
   ```toml
   compatibility_flags = ["nodejs_compat"]
   ```
2. Ensure module is worker-compatible
3. Check for Node.js-specific APIs not available in Workers

### Bundle Size Too Large

**Error:**
```
Total Upload: 5000 KiB (exceeds 3 MiB limit)
```

**Solution:**
1. Check bundle composition:
   ```bash
   wrangler deploy --dry-run
   ```
2. Remove unused dependencies
3. Use dynamic imports for large modules
4. Split code into worker and client bundles

---

## Deployment Issues

### Cloudflare API Errors

**Error:**
```
A request to the Cloudflare API failed
```

**Solution:**
1. Check Wrangler authentication:
   ```bash
   wrangler whoami
   ```
2. Re-authenticate:
   ```bash
   wrangler login
   ```
3. Verify API token permissions

### D1 Database Not Found

**Error:**
```
D1_ERROR: no such table: User
```

**Solution:**
1. List databases:
   ```bash
   wrangler d1 list
   ```
2. Apply migrations:
   ```bash
   wrangler d1 migrations apply duyetbot --remote
   ```
3. Verify `wrangler.toml` database_id matches

### KV Namespace Errors

**Error:**
```
KV GET failed: Namespace not found
```

**Solution:**
1. List namespaces:
   ```bash
   wrangler kv:namespace list
   ```
2. Verify binding in `wrangler.toml`
3. Create if missing:
   ```bash
   wrangler kv:namespace create "RATE_LIMIT_KV"
   ```

### R2 Bucket Not Found

**Error:**
```
R2 bucket not found
```

**Solution:**
```bash
# Create bucket
wrangler r2 bucket create duyetbot-web-uploads

# Verify
wrangler r2 bucket list
```

### Static Assets 404

**Symptoms:** Pages load but show blank or missing styles

**Solution:**
1. Verify build output:
   ```bash
   ls out/
   ```
2. Check `wrangler.toml` assets config:
   ```toml
   assets = { directory = "./out", binding = "ASSETS" }
   ```
3. Ensure export mode in `next.config.ts`:
   ```typescript
   output: "export"
   ```

---

## Database Issues

### Migration Fails

**Error:**
```
SQLITE_ERROR: no such column: xyz
```

**Solution:**
1. Generate fresh migration:
   ```bash
   bun run db:generate
   ```
2. Check migration order in `_journal.json`
3. Apply step by step:
   ```bash
   wrangler d1 execute duyetbot --remote --file=./lib/db/migrations/0001_xyz.sql
   ```

### Connection Errors

**Error:**
```
D1_ERROR: Connection failed
```

**Solution:**
1. Verify D1 binding:
   ```bash
   wrangler d1 info duyetbot
   ```
2. Check region availability
3. Retry with backoff

### Query Timeout

**Error:**
```
D1_ERROR: Query execution time exceeded
```

**Solution:**
1. Add indexes for slow queries
2. Optimize query (reduce JOINs, add LIMIT)
3. Check schema indexes in `lib/db/schema.ts`

---

## Authentication Issues

### Session Expires Immediately

**Symptoms:** User logged out after each request

**Solution:**
1. Check `SESSION_SECRET` is set:
   ```bash
   wrangler secret list
   ```
2. Verify JWT configuration in `lib/auth/jwt.ts`
3. Check cookie settings (domain, secure flag)

### GitHub OAuth Fails

**Error:**
```
OAuth error: redirect_uri_mismatch
```

**Solution:**
1. Verify redirect URI in GitHub OAuth app settings
2. Match production URL exactly:
   ```
   https://duyetbot-web.duyet.workers.dev/api/auth/github/callback
   ```
3. Check secrets are set:
   ```bash
   wrangler secret put GITHUB_CLIENT_ID
   wrangler secret put GITHUB_CLIENT_SECRET
   ```

### Rate Limit Hit

**Error:**
```json
{"error": "Rate limit exceeded", "retryAfter": 3600}
```

**Solution:**
1. Check rate limit status:
   ```bash
   curl https://your-worker.workers.dev/api/rate-limit/status
   ```
2. Wait for reset or authenticate for higher limits
3. Guest users: 10 messages/day
4. Authenticated users: 60 messages/minute

---

## Chat and AI Issues

### No Response from AI

**Symptoms:** Message sent but no response

**Solution:**
1. Check API key:
   ```bash
   wrangler secret list | grep OPENROUTER
   ```
2. Verify model availability on OpenRouter
3. Check browser console for errors
4. Try different model from selector

### Streaming Not Working

**Symptoms:** Entire response appears at once

**Solution:**
1. Check CORS headers in `worker/index.ts`
2. Verify SSE connection not blocked by proxy
3. Check browser supports ReadableStream

### Tool Execution Fails

**Error:**
```
Tool execution failed: web_search
```

**Solution:**
1. Check tool configuration in `worker/lib/tools.ts`
2. Verify external API availability
3. Check tool approval if required
4. Review error in console

### Custom Tool Not Working

**Symptoms:** Custom tool created but not appearing

**Solution:**
1. Check tool saved in database
2. Verify user is authenticated
3. Check tool schema is valid JSON
4. Try recreating the tool

---

## Performance Issues

### Slow Page Load

**Symptoms:** Page takes >3s to load

**Solution:**
1. Check Web Vitals in console
2. Optimize images (use WebP, lazy load)
3. Reduce JavaScript bundle size
4. Enable caching for static assets

### High API Latency

**Symptoms:** API responses >500ms

**Solution:**
1. Check Cloudflare analytics for latency
2. Optimize database queries (add indexes)
3. Use edge caching for static responses
4. Check AI provider latency

### Memory Issues

**Symptoms:** Worker restarts frequently

**Solution:**
1. Reduce global state
2. Stream large responses
3. Paginate large datasets
4. Check for memory leaks

---

## Debug Commands

### View Live Logs

```bash
wrangler tail
```

### Filter Error Logs

```bash
wrangler tail --status error
```

### Check Worker Status

```bash
wrangler deployments list
```

### Test Specific Endpoint

```bash
curl -v https://your-worker.workers.dev/health
```

### Run Health Check

```bash
curl https://your-worker.workers.dev/health
# Expected: {"status":"healthy","timestamp":"..."}
```

---

## Getting Help

1. Check [API Documentation](/api/docs) for endpoint details
2. Review [Architecture](./ARCHITECTURE.md) for system understanding
3. See [Deployment Guide](./DEPLOYMENT.md) for config issues
4. Open [GitHub Issue](https://github.com/duyet/duyetbot-agent/issues) with:
   - Error message
   - Steps to reproduce
   - Environment details (OS, Node version)
   - Relevant logs
