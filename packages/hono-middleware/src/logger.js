/**
 * Structured Logger for Cloudflare Workers Observability
 *
 * Provides consistent JSON logging format for better querying in CF dashboard
 */
function log(level, message, context) {
  const output = context ? `${message} ${JSON.stringify(context)}` : message;
  switch (level) {
    case 'debug':
      console.debug(output);
      break;
    case 'info':
      console.info(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'error':
      console.error(output);
      break;
  }
}
export const logger = {
  debug: (message, context) => log('debug', message, context),
  info: (message, context) => log('info', message, context),
  warn: (message, context) => log('warn', message, context),
  error: (message, context) => log('error', message, context),
};
