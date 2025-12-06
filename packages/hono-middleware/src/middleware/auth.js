/**
 * Create authentication middleware
 *
 * Supports:
 * - bearer: Bearer token authentication
 * - api-key: API key authentication (custom header)
 *
 * Note: GitHub webhook signature verification is handled by
 * app-specific middleware. See github-bot/src/middlewares/signature.ts
 */
export function createAuth(options) {
  const { type, validate, headerName = 'x-api-key' } = options;
  return async (c, next) => {
    if (type === 'bearer') {
      const authHeader = c.req.header('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized', message: 'Missing bearer token' }, 401);
      }
      const token = authHeader.slice(7);
      if (validate) {
        const user = await validate(token, c);
        if (!user) {
          return c.json({ error: 'Unauthorized', message: 'Invalid token' }, 401);
        }
        c.set('user', user);
      }
    } else if (type === 'api-key') {
      const apiKey = c.req.header(headerName);
      if (!apiKey) {
        return c.json({ error: 'Unauthorized', message: 'Missing API key' }, 401);
      }
      if (validate) {
        const user = await validate(apiKey, c);
        if (!user) {
          return c.json({ error: 'Unauthorized', message: 'Invalid API key' }, 401);
        }
        c.set('user', user);
      }
    }
    await next();
  };
}
