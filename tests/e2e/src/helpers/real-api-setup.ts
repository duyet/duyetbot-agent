/**
 * Real API setup for E2E testing
 *
 * This module configures the test environment for real API testing,
 * including provider initialization, web search setup, and test utilities.
 */

import { afterAll, beforeAll } from 'vitest';
import { createTestProvider, shouldUseRealAPI, testEnvironment } from './test-providers';

let provider: any = null;

/**
 * Setup real API testing environment
 */
export function setupRealAPITesting() {
  // Only setup real APIs if environment is configured
  if (!shouldUseRealAPI()) {
    console.warn('⚠️ Real API environment not configured. Tests will use mocks.');
    return;
  }

  console.log('🔧 Setting up real API testing environment...');
  console.log(`Environment: ${JSON.stringify(testEnvironment, null, 2)}`);

  try {
    provider = createTestProvider();
    if (!provider) {
      throw new Error('Failed to create test provider');
    }

    console.log('✅ Real API provider created successfully');
  } catch (error) {
    console.error('❌ Failed to setup real API provider:', error);
    throw error;
  }
}

/**
 * Cleanup real API testing environment
 */
export function cleanupRealAPITesting() {
  if (provider) {
    console.log('🧹 Cleaning up real API testing environment...');
    provider = null;
  }
}

/**
 * Get the configured provider for testing
 */
export function getTestProvider() {
  return provider;
}

/**
 * Check if real API testing is available
 */
export function isRealAPITestingAvailable() {
  return shouldUseRealAPI() && provider !== null;
}

// Global setup and teardown
beforeAll(async () => {
  setupRealAPITesting();
});

afterAll(async () => {
  cleanupRealAPITesting();
});
