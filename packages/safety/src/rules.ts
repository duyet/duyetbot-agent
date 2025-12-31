/**
 * Default Safety Rules
 *
 * Built-in safety rules for autonomous agent operations.
 */

import type { SafetyRule } from './types.js';

/**
 * Default safety rules
 */
export const DEFAULT_RULES: SafetyRule[] = [
  {
    name: 'check-credentials',
    description: 'Detect exposed credentials in operations',
    type: 'credential_leak',
    enabled: true,
    check: (ctx) => {
      for (const file of ctx.files) {
        if (
          file.toLowerCase().includes('credential') ||
          file.toLowerCase().includes('secret') ||
          file.toLowerCase().includes('password') ||
          file.toLowerCase().includes('key')
        ) {
          return {
            type: 'credential_leak',
            severity: 'critical',
            message: 'Possible credential file access detected',
            context: file,
            suggestion: 'Review and confirm this access is necessary',
          };
        }
      }
      return null;
    },
  },
  {
    name: 'check-destructive-paths',
    description: 'Detect destructive file operations',
    type: 'destructive_operation',
    enabled: true,
    check: (ctx) => {
      const destructivePatterns = [/\/dev\/(null|zero|random)/, /\.git\//, /node_modules\//];

      for (const file of ctx.files) {
        for (const pattern of destructivePatterns) {
          if (pattern.test(file)) {
            return {
              type: 'destructive_operation',
              severity: 'warning',
              message: `Destructive path detected: ${file}`,
              context: file,
              suggestion: 'Verify this operation is safe',
            };
          }
        }
      }
      return null;
    },
  },
  {
    name: 'check-network-requests',
    description: 'Validate network request safety',
    type: 'security_issue',
    enabled: true,
    check: (ctx) => {
      if (!ctx.requests) return null;

      const suspiciousDomains = ['pastebin.com', 'trello.com', 'gist.github.com', 'transfer.sh'];

      for (const req of ctx.requests) {
        // Check for non-HTTPS
        if (req.url.startsWith('http://')) {
          return {
            type: 'security_issue',
            severity: 'warning',
            message: 'Non-HTTPS request detected',
            context: req.url,
            suggestion: 'Use HTTPS for secure communication',
          };
        }

        // Check for suspicious domains
        for (const domain of suspiciousDomains) {
          if (req.url.includes(domain)) {
            return {
              type: 'security_issue',
              severity: 'danger',
              message: `Suspicious domain detected: ${domain}`,
              context: req.url,
              suggestion: 'Verify this request is legitimate',
            };
          }
        }
      }
      return null;
    },
  },
  {
    name: 'check-infinite-loops',
    description: 'Detect potential infinite loop patterns',
    type: 'infinite_loop',
    enabled: true,
    check: (ctx) => {
      const loopPatterns = [
        /while\s*\(\s*true\s*\)/i,
        /for\s*\(\s*;\s*;\s*\)/,
        /while\s*\(\s*1\s*\)/i,
      ];

      for (const cmd of ctx.commands || []) {
        for (const pattern of loopPatterns) {
          if (pattern.test(cmd)) {
            return {
              type: 'infinite_loop',
              severity: 'warning',
              message: 'Potential infinite loop detected',
              context: cmd,
              suggestion: 'Add proper exit condition',
            };
          }
        }
      }
      return null;
    },
  },
  {
    name: 'check-data-loss',
    description: 'Detect potential data loss operations',
    type: 'data_loss',
    enabled: true,
    check: (ctx) => {
      const dataLossPatterns = [
        />\s*\/dev\/null/,
        /truncate\s+/,
        /delete\s+from\s+\w+\s+where\s+1=1/i,
      ];

      for (const cmd of ctx.commands || []) {
        for (const pattern of dataLossPatterns) {
          if (pattern.test(cmd)) {
            return {
              type: 'data_loss',
              severity: 'danger',
              message: 'Potential data loss operation detected',
              context: cmd,
              suggestion: 'Verify data backup exists',
            };
          }
        }
      }
      return null;
    },
  },
];
