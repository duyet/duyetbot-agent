/**
 * Section Composers
 *
 * Reusable prompt sections for composing agent prompts.
 * Each section handles a specific aspect of prompt construction.
 */
// Capabilities & Tools
export { capabilitiesSection, DEFAULT_CAPABILITIES } from './capabilities.js';
export { codingStandardsSection, extendedCodingStandardsSection } from './coding.js';
// Formatting & Guidelines
export { guidelinesSection } from './guidelines.js';
// Context Handling
export { historyContextSection } from './history.js';
// Identity & Core
export { identitySection } from './identity.js';
export { policySection } from './policy.js';
export { COMMON_TOOLS, toolsSection } from './tools.js';
