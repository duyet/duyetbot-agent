/**
 * Mock for cloudflare:sockets
 * Used in tests to avoid cloudflare-specific imports
 */

export const connect = () => {
  throw new Error('cloudflare:sockets is not available in test environment');
};

export default { connect };
