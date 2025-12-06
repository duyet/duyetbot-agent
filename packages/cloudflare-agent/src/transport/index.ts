/**
 * Transport Module
 *
 * Provides platform-agnostic message transport abstraction.
 * Enables consistent agent communication across different platforms
 * (Telegram, GitHub, etc.) through a unified interface.
 */

export { TransportManager, type TransportManagerConfig } from './transport-manager.js';
export type { MessageRef, ParsedInput, Transport, TransportHooks } from './types.js';
