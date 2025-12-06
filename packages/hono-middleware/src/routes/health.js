import { Hono } from 'hono';
/**
 * Create health check routes
 */
export function healthRoutes(name, version = '1.0.0') {
  const routes = new Hono();
  // Full health check
  routes.get('/health', (c) =>
    c.json({
      status: 'ok',
      name,
      version,
      timestamp: new Date().toISOString(),
    })
  );
  // Kubernetes liveness probe
  routes.get('/health/live', (c) => c.json({ status: 'ok' }));
  // Kubernetes readiness probe
  routes.get('/health/ready', (c) => c.json({ status: 'ok' }));
  return routes;
}
