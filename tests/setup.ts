/**
 * Test setup file
 * Configures global environment for all tests
 */

import { webcrypto } from 'node:crypto';

// Polyfill global crypto for Node 18 compatibility
// The jose library and other Web Crypto API users expect crypto to be globally available
if (!(globalThis as typeof globalThis & { crypto?: Crypto }).crypto) {
  (globalThis as typeof globalThis & { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
}
