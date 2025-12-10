#!/usr/bin/env bun
/**
 * Generate HTML Dashboard Report
 *
 * Reads JSON results and generates a comprehensive HTML dashboard.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

interface TestResult {
  pass: boolean;
  score: number;
  reason: string;
}

interface EvalResult {
  prompt: { raw: string };
  vars: Record<string, unknown>;
  response?: { output: string };
  gradingResult?: TestResult;
  success: boolean;
  score: number;
}

interface EvalSummary {
  version: number;
  timestamp: string;
  results: {
    results: EvalResult[];
    stats: {
      successes: number;
      failures: number;
      tokenUsage?: { total: number };
    };
  };
}

const scriptsDir = import.meta.dir;
const resultsDir = path.join(scriptsDir, '..', 'results');

const RESULT_FILES = [
  { name: 'router', file: 'router-results.json', label: 'Router Classification' },
  { name: 'telegram', file: 'telegram-results.json', label: 'Telegram Format' },
  { name: 'github', file: 'github-results.json', label: 'GitHub Format' },
  { name: 'quality', file: 'quality-results.json', label: 'Response Quality' },
];

console.log('📊 Generating HTML Dashboard...\n');

interface SuiteResult {
  name: string;
  label: string;
  stats: { successes: number; failures: number; total: number };
  passRate: number;
  results: EvalResult[];
}

const suites: SuiteResult[] = [];

for (const { name, file, label } of RESULT_FILES) {
  const filePath = path.join(resultsDir, file);

  if (!existsSync(filePath)) {
    console.log(`⚠️  Missing: ${file}`);
    suites.push({
      name,
      label,
      stats: { successes: 0, failures: 0, total: 0 },
      passRate: 0,
      results: [],
    });
    continue;
  }

  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as EvalSummary;
    const stats = data.results?.stats || { successes: 0, failures: 0 };
    const total = stats.successes + stats.failures;

    suites.push({
      name,
      label,
      stats: { ...stats, total },
      passRate: total > 0 ? (stats.successes / total) * 100 : 0,
      results: data.results?.results || [],
    });

    console.log(`✅ Loaded ${file}: ${stats.successes}/${total} passed`);
  } catch (error) {
    console.error(`❌ Error reading ${file}:`, error);
  }
}

// Calculate totals
const totalTests = suites.reduce((sum, s) => sum + s.stats.total, 0);
const totalPassed = suites.reduce((sum, s) => sum + s.stats.successes, 0);
const totalFailed = suites.reduce((sum, s) => sum + s.stats.failures, 0);
const overallPassRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Generate HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Duyetbot Prompt Evaluation Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      color: white;
      font-size: 2rem;
      margin-bottom: 0.5rem;
      text-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .subtitle { color: rgba(255,255,255,0.8); margin-bottom: 2rem; }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .summary-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .summary-card h3 {
      color: #6b7280;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .summary-card .value {
      font-size: 2.5rem;
      font-weight: bold;
      margin: 0.5rem 0;
    }
    .summary-card .label { color: #9ca3af; font-size: 0.875rem; }
    .success { color: #10b981; }
    .failure { color: #ef4444; }
    .neutral { color: #6366f1; }

    .suite-section {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .suite-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e5e7eb;
    }
    .suite-header h2 { color: #1f2937; font-size: 1.25rem; }
    .pass-rate {
      font-size: 1.5rem;
      font-weight: bold;
    }
    .pass-rate.high { color: #10b981; }
    .pass-rate.medium { color: #f59e0b; }
    .pass-rate.low { color: #ef4444; }

    .test-list { list-style: none; }
    .test-item {
      display: flex;
      align-items: center;
      padding: 0.75rem;
      border-radius: 8px;
      margin-bottom: 0.5rem;
    }
    .test-item.pass { background: #ecfdf5; }
    .test-item.fail { background: #fef2f2; }
    .test-icon {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 1rem;
      font-size: 0.875rem;
    }
    .test-icon.pass { background: #10b981; color: white; }
    .test-icon.fail { background: #ef4444; color: white; }
    .test-content { flex: 1; }
    .test-query {
      color: #1f2937;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.875rem;
    }
    .test-reason { color: #6b7280; font-size: 0.75rem; margin-top: 0.25rem; }

    footer {
      text-align: center;
      color: rgba(255,255,255,0.7);
      margin-top: 2rem;
      font-size: 0.875rem;
    }
    footer code {
      background: rgba(255,255,255,0.2);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Duyetbot Prompt Evaluation</h1>
    <p class="subtitle">Generated: ${new Date().toISOString()}</p>

    <div class="summary-grid">
      <div class="summary-card">
        <h3>Total Tests</h3>
        <div class="value neutral">${totalTests}</div>
        <div class="label">test cases evaluated</div>
      </div>
      <div class="summary-card">
        <h3>Passed</h3>
        <div class="value success">${totalPassed}</div>
        <div class="label">tests passed</div>
      </div>
      <div class="summary-card">
        <h3>Failed</h3>
        <div class="value failure">${totalFailed}</div>
        <div class="label">tests failed</div>
      </div>
      <div class="summary-card">
        <h3>Pass Rate</h3>
        <div class="value ${overallPassRate >= 90 ? 'success' : overallPassRate >= 70 ? 'neutral' : 'failure'}">${overallPassRate.toFixed(1)}%</div>
        <div class="label">overall success rate</div>
      </div>
    </div>

    ${suites
      .map(
        (suite) => `
    <div class="suite-section">
      <div class="suite-header">
        <h2>${suite.label}</h2>
        <span class="pass-rate ${suite.passRate >= 90 ? 'high' : suite.passRate >= 70 ? 'medium' : 'low'}">
          ${suite.passRate.toFixed(1)}%
        </span>
      </div>
      <ul class="test-list">
        ${suite.results
          .slice(0, 10)
          .map(
            (result) => `
        <li class="test-item ${result.success ? 'pass' : 'fail'}">
          <div class="test-icon ${result.success ? 'pass' : 'fail'}">${result.success ? '✓' : '✗'}</div>
          <div class="test-content">
            <div class="test-query">${escapeHtml(String(result.vars?.query || result.prompt?.raw || 'N/A').slice(0, 80))}${String(result.vars?.query || '').length > 80 ? '...' : ''}</div>
            <div class="test-reason">${escapeHtml(result.gradingResult?.reason || (result.success ? 'Passed' : 'Failed'))}</div>
          </div>
        </li>
        `
          )
          .join('')}
        ${suite.results.length > 10 ? `<li class="test-item" style="justify-content: center; color: #6b7280;">...and ${suite.results.length - 10} more tests</li>` : ''}
      </ul>
    </div>
    `
      )
      .join('')}

    <footer>
      <p>Run <code>bun run prompt:view</code> for interactive exploration</p>
    </footer>
  </div>
</body>
</html>`;

// Write dashboard
const outputPath = path.join(resultsDir, 'dashboard.html');
writeFileSync(outputPath, html);

console.log(`\n✅ Dashboard generated: ${outputPath}`);
console.log(
  `\n📊 Summary: ${totalPassed}/${totalTests} tests passed (${overallPassRate.toFixed(1)}%)`
);
console.log('\nTo view the dashboard:');
console.log(`  open ${outputPath}`);
