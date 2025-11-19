/**
 * Test setup file
 * Configures global environment for all tests
 */

import { webcrypto } from 'node:crypto';

// Polyfill global crypto for Node 18 compatibility
// The jose library and other Web Crypto API users expect crypto to be globally available
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
}
