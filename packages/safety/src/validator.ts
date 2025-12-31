/**
 * Safety Validator
 *
 * Provides safety validation for autonomous agent operations.
 * Prevents destructive, malicious, or unsafe operations.
 */

import { DEFAULT_RULES } from './rules.js';
import type {
  SafetyCheckResult,
  SafetyContext,
  SafetyPolicy,
  SafetyRule,
  SafetyViolation,
  ViolationType,
} from './types.js';

/**
 * Default safety policy
 */
const DEFAULT_POLICY: SafetyPolicy = {
  allowDestructive: false,
  allowOutsideWrites: false,
  allowNetwork: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxExecutionTime: 300000, // 5 minutes
  blockedFiles: [
    '.env',
    '.env.local',
    '.env.production',
    'credentials.json',
    'secrets/',
    '~/.ssh/',
    '/etc/',
  ],
  blockedCommands: [
    'rm -rf /',
    'rm -rf /*',
    'mkfs',
    'dd if=',
    '> /dev/',
    'curl',
    'wget',
    'nc -l',
    'chmod 000',
  ],
  blockedDomains: [],
  requireApproval: [
    'destructive_operation',
    'sensitive_data',
    'security_issue',
    'data_loss',
    'credential_leak',
  ],
};

/**
 * Safety Validator
 *
 * Validates operations against safety rules and policies.
 */
export class SafetyValidator {
  private policy: SafetyPolicy;
  private rules: SafetyRule[] = [];

  constructor(policy: Partial<SafetyPolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
    this.rules = DEFAULT_RULES.filter((r) => r.enabled);
  }

  /**
   * Validate a safety context
   */
  validate(context: SafetyContext): SafetyCheckResult {
    const violations: SafetyViolation[] = [];

    // Check against all rules
    for (const rule of this.rules) {
      const violation = rule.check(context);
      if (violation) {
        violations.push(violation);
      }
    }

    // Check policy violations
    const policyViolations = this.checkPolicy(context);
    violations.push(...policyViolations);

    // Determine overall severity
    const severity = this.calculateSeverity(violations);

    // Generate recommendations
    const recommendations = this.generateRecommendations(violations);

    return {
      passed: severity === 'safe',
      severity,
      violations,
      recommendations,
    };
  }

  /**
   * Check policy violations
   */
  private checkPolicy(context: SafetyContext): SafetyViolation[] {
    const violations: SafetyViolation[] = [];

    // Check for blocked files
    for (const file of context.files) {
      for (const pattern of this.policy.blockedFiles) {
        if (file.includes(pattern) || file.match(pattern)) {
          violations.push({
            type: 'unauthorized_access',
            severity: 'critical',
            message: `Attempted to modify blocked file: ${file}`,
            context: file,
            suggestion: `Remove ${file} from operation or add to allowlist`,
          });
        }
      }
    }

    // Check for blocked commands
    if (context.commands) {
      for (const cmd of context.commands) {
        for (const blocked of this.policy.blockedCommands) {
          if (cmd.includes(blocked)) {
            violations.push({
              type: 'destructive_operation',
              severity: 'critical',
              message: `Blocked command detected: ${blocked}`,
              context: cmd,
              suggestion: 'Use safer alternatives',
            });
          }
        }
      }
    }

    // Check for destructive operations
    if (!this.policy.allowDestructive) {
      const destructivePatterns = [
        /\brm\s+-rf\s+[/~]/,
        /\bdd\s+if=/,
        /\bmkfs/,
        />\s*\/dev\/(null|zero|random)/,
      ];

      for (const cmd of context.commands || []) {
        for (const pattern of destructivePatterns) {
          if (pattern.test(cmd)) {
            violations.push({
              type: 'destructive_operation',
              severity: 'critical',
              message: 'Destructive operation detected',
              context: cmd,
              suggestion: 'Enable allowDestructive if this is intentional',
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * Calculate overall severity
   */
  private calculateSeverity(violations: SafetyViolation[]): SafetyCheckResult['severity'] {
    if (violations.length === 0) {
      return 'safe';
    }

    const hasCritical = violations.some((v) => v.severity === 'critical');
    const hasDanger = violations.some((v) => v.severity === 'danger');

    if (hasCritical) {
      return 'critical';
    }
    if (hasDanger) {
      return 'danger';
    }
    return 'warning';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(violations: SafetyViolation[]): string[] {
    const recommendations: string[] = [];

    if (violations.length === 0) {
      return recommendations;
    }

    // Group by type
    const byType = new Map<ViolationType, SafetyViolation[]>();
    for (const v of violations) {
      if (!byType.has(v.type)) {
        byType.set(v.type, []);
      }
      byType.get(v.type)!.push(v);
    }

    // Generate recommendations for each type
    for (const [type, typeViolations] of byType) {
      const count = typeViolations.length;
      switch (type) {
        case 'destructive_operation':
          recommendations.push(
            `${count} destructive operation(s) detected. Consider using dry-run mode first.`
          );
          break;
        case 'sensitive_data':
          recommendations.push(`Possible sensitive data exposure. Review data handling practices.`);
          break;
        case 'security_issue':
          recommendations.push(`Security issue(s) detected. Review before proceeding.`);
          break;
        case 'data_loss':
          recommendations.push(`Data loss risk detected. Ensure backups are available.`);
          break;
        default:
          recommendations.push(`${count} ${type} violation(s) found. Review carefully.`);
      }
    }

    return recommendations;
  }

  /**
   * Check if approval is required
   */
  requiresApproval(context: SafetyContext): boolean {
    const result = this.validate(context);

    for (const violation of result.violations) {
      if (this.policy.requireApproval.includes(violation.type)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add custom safety rule
   */
  addRule(rule: SafetyRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove safety rule by name
   */
  removeRule(name: string): void {
    this.rules = this.rules.filter((r) => r.name !== name);
  }

  /**
   * Update policy
   */
  updatePolicy(updates: Partial<SafetyPolicy>): void {
    this.policy = { ...this.policy, ...updates };
  }

  /**
   * Get current policy
   */
  getPolicy(): SafetyPolicy {
    return { ...this.policy };
  }
}

/**
 * Quick validation helper
 */
export function validateSafety(
  context: SafetyContext,
  policy?: Partial<SafetyPolicy>
): SafetyCheckResult {
  const validator = new SafetyValidator(policy);
  return validator.validate(context);
}
