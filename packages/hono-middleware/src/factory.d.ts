import { Hono } from 'hono';
import type { AppOptions } from './types.js';
/**
 * Create a Hono app with standard middleware and routes
 *
 * @example
 * ```typescript
 * const app = createBaseApp<Env>({
 *   name: 'telegram-bot',
 *   version: '1.0.0',
 *   logger: true,
 *   rateLimit: { limit: 100, window: 60000 },
 *   health: true,
 * });
 *
 * app.post('/webhook', async (c) => {
 *   // Handle webhook
 * });
 *
 * export default app;
 * ```
 */
export declare function createBaseApp<TEnv extends object = object>(
  options: AppOptions
): Hono<{
  Bindings: TEnv;
}>;
//# sourceMappingURL=factory.d.ts.map
