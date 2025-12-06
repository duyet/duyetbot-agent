/**
 * Global error handler
 */
export function errorHandler(err, c) {
  console.error('Error:', err.message, err.stack);
  const status = 'status' in err && typeof err.status === 'number' ? err.status : 500;
  return c.json(
    {
      error: status === 500 ? 'Internal Server Error' : err.name || 'Error',
      message: err.message || 'An unexpected error occurred',
    },
    status
  );
}
