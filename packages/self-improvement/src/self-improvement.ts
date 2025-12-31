/**
 * Self-Improvement Manager
 *
 * Main entry point for autonomous self-improvement.
 * Analyzes codebase and generates improvement plans.
 */

import { exec } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { ImprovementCycle } from './improvement-cycle.js';
import type {
  AnalysisContext,
  ImprovementOpportunity,
  ImprovementPlan,
  SelfImprovementConfig,
} from './types.js';

const execAsync = promisify(exec);

/**
 * Self-Improvement Manager
 *
 * Analyzes codebase and orchestrates improvement cycles.
 */
export class SelfImprovement {
  private config: SelfImprovementConfig;
  private root: string;

  constructor(config: SelfImprovementConfig = {}) {
    this.config = config;
    this.root = process.cwd();
  }

  /**
   * Analyze codebase for improvement opportunities
   */
  async analyze(_context: AnalysisContext): Promise<ImprovementOpportunity[]> {
    console.log('🔍 Analyzing codebase for improvement opportunities...');

    const opportunities: ImprovementOpportunity[] = [];

    // Analyze recent commits for patterns
    const commitOpportunities = await this.analyzeCommits();
    opportunities.push(...commitOpportunities);

    // Analyze code quality
    const qualityOpportunities = await this.analyzeCodeQuality();
    opportunities.push(...qualityOpportunities);

    // Analyze test coverage
    const coverageOpportunities = await this.analyzeTestCoverage();
    opportunities.push(...coverageOpportunities);

    // Filter by config
    return this.filterOpportunities(opportunities);
  }

  /**
   * Generate improvement plan from opportunities
   */
  createPlan(opportunities: ImprovementOpportunity[]): ImprovementPlan {
    // Sort by impact/complexity ratio
    const sorted = [...opportunities].sort((a, b) => {
      const aRatio = a.impact / a.complexity;
      const bRatio = b.impact / b.complexity;
      return bRatio - aRatio;
    });

    // Select top opportunities based on config
    const maxOpportunities = this.config.maxOpportunities ?? 5;
    const maxComplexity = this.config.maxComplexity ?? 20;

    const selected: ImprovementOpportunity[] = [];
    let totalComplexity = 0;

    for (const opportunity of sorted) {
      if (selected.length >= maxOpportunities) {
        break;
      }
      if (totalComplexity + opportunity.complexity > maxComplexity) {
        break;
      }

      selected.push(opportunity);
      totalComplexity += opportunity.complexity;
    }

    return {
      id: randomUUID(),
      opportunities: selected,
      executionOrder: selected.map((o) => o.id),
      totalComplexity,
      totalImpact: selected.reduce((sum, o) => sum + o.impact, 0),
    };
  }

  /**
   * Run improvement cycle
   */
  async cycle(plan: ImprovementPlan): Promise<void> {
    const cycle = new ImprovementCycle(this.config);
    const result = await cycle.run(plan);

    console.log(`\n${result.summary}`);

    if (!result.rolledBack && result.failed === 0) {
      console.log('✅ All improvements applied successfully!');
    } else if (result.rolledBack) {
      console.log('⚠️  Changes were rolled back due to failures');
    }
  }

  /**
   * Analyze recent commits for improvement patterns
   */
  private async analyzeCommits(): Promise<ImprovementOpportunity[]> {
    const opportunities: ImprovementOpportunity[] = [];

    try {
      const { stdout } = await execAsync('git log --oneline -20', {
        cwd: this.root,
      });

      const commits = stdout.trim().split('\n');

      // Look for patterns like "fix:", "bug:", "TODO:", etc.
      for (const commit of commits) {
        if (commit.toLowerCase().includes('fix:') || commit.toLowerCase().includes('bug:')) {
          opportunities.push({
            id: randomUUID(),
            type: 'bug_fix',
            title: `Address bug pattern in commit: ${commit.substring(0, 50)}`,
            description: `Similar bug pattern found in recent commit: ${commit}`,
            files: [],
            complexity: 3,
            impact: 5,
            solution: 'Analyze similar code patterns and fix proactively',
          });
        }

        if (commit.toLowerCase().includes('todo:') || commit.toLowerCase().includes('hack:')) {
          opportunities.push({
            id: randomUUID(),
            type: 'code_quality',
            title: `Resolve technical debt: ${commit.substring(0, 50)}`,
            description: `Technical debt identified in: ${commit}`,
            files: [],
            complexity: 5,
            impact: 4,
            solution: 'Implement proper solution instead of workaround',
          });
        }
      }
    } catch {
      // Git analysis failed, continue
    }

    return opportunities;
  }

  /**
   * Analyze code quality
   */
  private async analyzeCodeQuality(): Promise<ImprovementOpportunity[]> {
    const opportunities: ImprovementOpportunity[] = [];

    // This would run linting tools and analyze results
    // For now, return placeholder opportunities

    return opportunities;
  }

  /**
   * Analyze test coverage
   */
  private async analyzeTestCoverage(): Promise<ImprovementOpportunity[]> {
    const opportunities: ImprovementOpportunity[] = [];

    // This would run coverage tools and analyze results
    // For now, return placeholder opportunities

    return opportunities;
  }

  /**
   * Filter opportunities based on config
   */
  private filterOpportunities(opportunities: ImprovementOpportunity[]): ImprovementOpportunity[] {
    let filtered = opportunities;

    // Filter by allowed types
    if (this.config.allowedTypes && this.config.allowedTypes.length > 0) {
      filtered = filtered.filter((o) => this.config.allowedTypes!.includes(o.type));
    }

    // Filter by blocked files
    if (this.config.blockedFiles && this.config.blockedFiles.length > 0) {
      filtered = filtered.filter((o) => {
        return !o.files.some((file) =>
          this.config.blockedFiles!.some((pattern) => file.includes(pattern))
        );
      });
    }

    return filtered;
  }
}

/**
 * Quick analyze and improve
 *
 * Convenience function to analyze and improve in one call.
 */
export async function analyzeAndImprove(
  context: AnalysisContext,
  config: SelfImprovementConfig = {}
): Promise<void> {
  const selfImprovement = new SelfImprovement(config);

  console.log('🤖 Starting autonomous self-improvement...\n');

  const opportunities = await selfImprovement.analyze(context);
  console.log(`\n📋 Found ${opportunities.length} improvement opportunities`);

  if (opportunities.length === 0) {
    console.log('✨ No improvements needed!');
    return;
  }

  const plan = selfImprovement.createPlan(opportunities);
  console.log(`\n📝 Created improvement plan with ${plan.opportunities.length} items`);
  console.log(`   Total complexity: ${plan.totalComplexity}`);
  console.log(`   Total impact: ${plan.totalImpact}`);

  await selfImprovement.cycle(plan);
}
