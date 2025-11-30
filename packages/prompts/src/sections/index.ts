/**
 * Section Composers
 *
 * Reusable prompt sections for composing agent prompts.
 * Each section handles a specific aspect of prompt construction.
 */

// Identity & Core
export { identitySection } from './identity.js';
export { policySection } from './policy.js';

// Capabilities & Tools
export { capabilitiesSection, DEFAULT_CAPABILITIES } from './capabilities.js';
export { toolsSection, COMMON_TOOLS } from './tools.js';

// Formatting & Guidelines
export { guidelinesSection } from './guidelines.js';
export {
  codingStandardsSection,
  extendedCodingStandardsSection,
} from './coding.js';

// Context Handling
export { historyContextSection } from './history.js';
