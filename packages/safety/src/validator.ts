/**
 * Safety Validator
 *
 * Main validator for autonomous agent operations.
 */

import type {
  SafetyCheckResult,
  SafetyContext,
  SafetyPolicy,
  SafetyRule,
  SafetyViolation,
} from './types.js';

/**
 * Safety Validator
 *
 * Validates operations against safety rules and policies.
 */
export class SafetyValidator {
  private rules: SafetyRule[] = [];
  private policies: SafetyPolicy[] = [];

  constructor(rules: SafetyRule[] = [], policies: SafetyPolicy[] = []) {
    this.rules = rules;
    this.policies = policies;
  }

  /**
   * Validate an operation against safety rules
   */
  validate(context: SafetyContext): SafetyCheckResult {
    const violations: SafetyViolation[] = [];

    // Run all enabled rules
    for (const rule of this.rules) {
      if (!rule.enabled) {
        continue;
      }

      const violation = rule.check(context);
      if (violation) {
        violations.push(violation);
      }
    }

    // Check if operation should be blocked
    const shouldBlock = this.shouldBlockOperation(violations);

    return {
      passed: violations.length === 0,
      violations,
      shouldBlock,
    };
  }

  /**
   * Add a safety rule
   */
  addRule(rule: SafetyRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a safety rule
   */
  removeRule(name: string): void {
    this.rules = this.rules.filter((r) => r.name !== name);
  }

  /**
   * Add a safety policy
   */
  addPolicy(policy: SafetyPolicy): void {
    this.policies.push(policy);
  }

  /**
   * Remove a safety policy
   */
  removePolicy(name: string): void {
    this.policies = this.policies.filter((p) => p.name !== name);
  }

  /**
   * Check if operation should be blocked based on policies
   */
  private shouldBlockOperation(violations: SafetyViolation[]): boolean {
    for (const policy of this.policies) {
      if (!policy.enabled) {
        continue;
      }

      for (const violation of violations) {
        // Check if violation type is blocked
        if (policy.blockTypes.includes(violation.type)) {
          return true;
        }

        // Check if severity is blocked
        if (policy.blockSeverities.includes(violation.severity)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get all rules
   */
  getRules(): SafetyRule[] {
    return [...this.rules];
  }

  /**
   * Get all policies
   */
  getPolicies(): SafetyPolicy[] {
    return [...this.policies];
  }
}
