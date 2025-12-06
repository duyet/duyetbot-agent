import type { Context } from 'hono';
/**
 * Global error handler
 */
export declare function errorHandler(
  err: Error,
  c: Context
): Response &
  import('hono').TypedResponse<
    {
      error: string;
      message: string;
    },
    500,
    'json'
  >;
//# sourceMappingURL=error-handler.d.ts.map
