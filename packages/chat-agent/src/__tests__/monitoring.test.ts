/**
 * Tests for routing monitoring utilities
 */

import { describe, expect, it } from 'vitest';
import {
  calculateAccuracyMetrics,
  calculateEnhancedStats,
  exportRoutingHistoryCSV,
  exportRoutingHistoryJSON,
  formatAccuracyMetrics,
  formatEnhancedStats,
  formatRoutingStats,
  type RoutingHistoryEntry,
} from '../routing/monitoring.js';
import type { RouteTarget } from '../routing/schemas.js';

describe('Routing Monitoring', () => {
  const sampleHistory: RoutingHistoryEntry[] = [
    {
      query: 'What is TypeScript?',
      classification: {
        type: 'simple',
        category: 'question',
        complexity: 'low',
        confidence: 0.9,
        reasoning: 'Simple question about a programming language',
      },
      routedTo: 'simple-agent' as RouteTarget,
      timestamp: Date.now() - 5000,
      durationMs: 150,
    },
    {
      query: 'Create a complex web application',
      classification: {
        type: 'task',
        category: 'code',
        complexity: 'high',
        confidence: 0.85,
        reasoning: 'Complex task requiring multiple steps',
      },
      routedTo: 'orchestrator-agent' as RouteTarget,
      timestamp: Date.now() - 3000,
      durationMs: 450,
    },
    {
      query: 'Delete production database',
      classification: {
        type: 'task',
        category: 'code',
        complexity: 'high',
        confidence: 0.7,
        reasoning: 'Destructive operation requiring approval',
      },
      routedTo: 'hitl-agent' as RouteTarget,
      timestamp: Date.now() - 1000,
      durationMs: 200,
    },
  ];

  describe('formatRoutingStats', () => {
    it('formats basic stats correctly', () => {
      const stats = {
        totalRouted: 100,
        byTarget: {
          'simple-agent': 60,
          'orchestrator-agent': 30,
          'hitl-agent': 10,
        },
        avgDurationMs: 250.5,
      };

      const formatted = formatRoutingStats(stats);

      expect(formatted).toContain('📊 Routing Statistics');
      expect(formatted).toContain('Total Requests: 100');
      expect(formatted).toContain('Average Duration: 250.50ms');
      expect(formatted).toContain('simple-agent: 60 (60.0%)');
      expect(formatted).toContain('orchestrator-agent: 30 (30.0%)');
      expect(formatted).toContain('hitl-agent: 10 (10.0%)');
    });

    it('sorts targets by count descending', () => {
      const stats = {
        totalRouted: 100,
        byTarget: {
          'hitl-agent': 10,
          'orchestrator-agent': 30,
          'simple-agent': 60,
        },
        avgDurationMs: 250,
      };

      const formatted = formatRoutingStats(stats);
      const lines = formatted.split('\n');

      const targetLines = lines.filter((l) => l.includes(':') && l.includes('%'));
      expect(targetLines[0]).toContain('simple-agent: 60');
      expect(targetLines[1]).toContain('orchestrator-agent: 30');
      expect(targetLines[2]).toContain('hitl-agent: 10');
    });
  });

  describe('calculateEnhancedStats', () => {
    it('calculates comprehensive statistics', () => {
      const stats = calculateEnhancedStats(sampleHistory);

      expect(stats.totalRouted).toBe(3);
      expect(stats.byTarget['simple-agent']).toBe(1);
      expect(stats.byTarget['orchestrator-agent']).toBe(1);
      expect(stats.byTarget['hitl-agent']).toBe(1);

      expect(stats.byType.simple).toBe(1);
      expect(stats.byType.task).toBe(2);

      expect(stats.byCategory.question).toBe(1);
      expect(stats.byCategory.code).toBe(2);

      expect(stats.byComplexity.low).toBe(1);
      expect(stats.byComplexity.high).toBe(2);

      expect(stats.avgDurationMs).toBeCloseTo((150 + 450 + 200) / 3, 1);
      expect(stats.medianDurationMs).toBe(200); // Middle value when sorted
      expect(stats.successRate).toBe(100);
    });

    it('handles empty history', () => {
      const stats = calculateEnhancedStats([]);

      expect(stats.totalRouted).toBe(0);
      expect(stats.byTarget).toEqual({});
      expect(stats.avgDurationMs).toBe(0);
      expect(stats.medianDurationMs).toBe(0);
      expect(stats.p95DurationMs).toBe(0);
      expect(stats.timeRange.earliest).toBe(0);
      expect(stats.timeRange.latest).toBe(0);
    });

    it('calculates p95 duration correctly', () => {
      const history: RoutingHistoryEntry[] = [];
      for (let i = 0; i < 100; i++) {
        history.push({
          query: `query ${i}`,
          classification: {
            type: 'simple',
            category: 'question',
            complexity: 'low',
            confidence: 0.9,
          },
          routedTo: 'simple-agent' as RouteTarget,
          timestamp: Date.now(),
          durationMs: i * 10, // 0, 10, 20, ..., 990
        });
      }

      const stats = calculateEnhancedStats(history);

      // P95 should be at index 95 in sorted array: 950ms
      expect(stats.p95DurationMs).toBe(950);
    });
  });

  describe('calculateAccuracyMetrics', () => {
    it('calculates confidence metrics correctly', () => {
      const metrics = calculateAccuracyMetrics(sampleHistory);

      expect(metrics.totalClassifications).toBe(3);
      expect(metrics.avgConfidence).toBeCloseTo((0.9 + 0.85 + 0.7) / 3, 2);

      expect(metrics.confidenceDistribution.high).toBe(2); // 0.9, 0.85
      expect(metrics.confidenceDistribution.medium).toBe(1); // 0.7
      expect(metrics.confidenceDistribution.low).toBe(0);
    });

    it('categorizes confidence correctly', () => {
      const history: RoutingHistoryEntry[] = [
        {
          query: 'high confidence',
          classification: {
            type: 'simple',
            category: 'question',
            complexity: 'low',
            confidence: 0.95,
          },
          routedTo: 'simple-agent' as RouteTarget,
          timestamp: Date.now(),
          durationMs: 100,
        },
        {
          query: 'medium confidence',
          classification: {
            type: 'simple',
            category: 'question',
            complexity: 'low',
            confidence: 0.65,
          },
          routedTo: 'simple-agent' as RouteTarget,
          timestamp: Date.now(),
          durationMs: 100,
        },
        {
          query: 'low confidence',
          classification: {
            type: 'simple',
            category: 'question',
            complexity: 'low',
            confidence: 0.4,
          },
          routedTo: 'simple-agent' as RouteTarget,
          timestamp: Date.now(),
          durationMs: 100,
        },
      ];

      const metrics = calculateAccuracyMetrics(history);

      expect(metrics.confidenceDistribution.high).toBe(1);
      expect(metrics.confidenceDistribution.medium).toBe(1);
      expect(metrics.confidenceDistribution.low).toBe(1);
    });

    it('handles empty history', () => {
      const metrics = calculateAccuracyMetrics([]);

      expect(metrics.totalClassifications).toBe(0);
      expect(metrics.avgConfidence).toBe(0);
      expect(metrics.confidenceDistribution.high).toBe(0);
      expect(metrics.confidenceDistribution.medium).toBe(0);
      expect(metrics.confidenceDistribution.low).toBe(0);
    });
  });

  describe('exportRoutingHistoryJSON', () => {
    it('exports valid JSON', () => {
      const json = exportRoutingHistoryJSON(sampleHistory);
      const parsed = JSON.parse(json);

      expect(parsed.count).toBe(3);
      expect(parsed.entries).toHaveLength(3);
      expect(parsed.exportedAt).toBeDefined();
    });

    it('includes all fields in JSON export', () => {
      const json = exportRoutingHistoryJSON(sampleHistory);
      const parsed = JSON.parse(json);

      const entry = parsed.entries[0];
      expect(entry.timestamp).toBeDefined();
      expect(entry.query).toBe('What is TypeScript?');
      expect(entry.classification.type).toBe('simple');
      expect(entry.classification.confidence).toBe(0.9);
      expect(entry.routedTo).toBe('simple-agent');
      expect(entry.durationMs).toBe(150);
    });

    it('formats timestamps as ISO strings', () => {
      const json = exportRoutingHistoryJSON(sampleHistory);
      const parsed = JSON.parse(json);

      const entry = parsed.entries[0];
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('exportRoutingHistoryCSV', () => {
    it('exports valid CSV with headers', () => {
      const csv = exportRoutingHistoryCSV(sampleHistory);
      const lines = csv.split('\n');

      expect(lines[0]).toBe(
        'timestamp,query,type,category,complexity,confidence,routedTo,durationMs'
      );
      expect(lines.length).toBe(4); // Header + 3 entries
    });

    it('escapes quotes in CSV', () => {
      const history: RoutingHistoryEntry[] = [
        {
          query: 'Query with "quotes" in it',
          classification: {
            type: 'simple',
            category: 'question',
            complexity: 'low',
            confidence: 0.9,
          },
          routedTo: 'simple-agent' as RouteTarget,
          timestamp: Date.now(),
          durationMs: 100,
        },
      ];

      const csv = exportRoutingHistoryCSV(history);
      expect(csv).toContain('"Query with ""quotes"" in it"');
    });

    it('includes all columns in CSV export', () => {
      const csv = exportRoutingHistoryCSV(sampleHistory);
      const lines = csv.split('\n');

      const dataLine = lines[1];
      const columns = dataLine.split(',');

      expect(columns[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/); // timestamp
      expect(columns[1]).toContain('What is TypeScript?'); // query (in quotes)
      expect(columns[2]).toBe('simple'); // type
      expect(columns[3]).toBe('question'); // category
      expect(columns[4]).toBe('low'); // complexity
      expect(columns[5]).toBe('0.90'); // confidence
      expect(columns[6]).toBe('simple-agent'); // routedTo
      expect(columns[7]).toBe('150'); // durationMs
    });
  });

  describe('formatAccuracyMetrics', () => {
    it('formats accuracy metrics correctly', () => {
      const metrics = calculateAccuracyMetrics(sampleHistory);
      const formatted = formatAccuracyMetrics(metrics);

      expect(formatted).toContain('🎯 Classification Accuracy Metrics');
      expect(formatted).toContain('Total Classifications: 3');
      expect(formatted).toContain('Average Confidence:');
      expect(formatted).toContain('High (≥80%): 2');
      expect(formatted).toContain('Medium (50-80%): 1');
      expect(formatted).toContain('Low (<50%): 0');
    });
  });

  describe('formatEnhancedStats', () => {
    it('formats enhanced stats correctly', () => {
      const stats = calculateEnhancedStats(sampleHistory);
      const formatted = formatEnhancedStats(stats);

      expect(formatted).toContain('📊 Enhanced Routing Statistics');
      expect(formatted).toContain('Total Requests: 3');
      expect(formatted).toContain('Success Rate: 100.0%');
      expect(formatted).toContain('Average Duration:');
      expect(formatted).toContain('Median Duration:');
      expect(formatted).toContain('P95 Duration:');
      expect(formatted).toContain('By Target:');
      expect(formatted).toContain('By Complexity:');
      expect(formatted).toContain('Time Range:');
    });

    it('includes time range when available', () => {
      const stats = calculateEnhancedStats(sampleHistory);
      const formatted = formatEnhancedStats(stats);

      expect(formatted).toContain('First Request:');
      expect(formatted).toContain('Latest Request:');
    });

    it('handles empty stats correctly', () => {
      const stats = calculateEnhancedStats([]);
      const formatted = formatEnhancedStats(stats);

      expect(formatted).toContain('Total Requests: 0');
      expect(formatted).not.toContain('Time Range:');
    });
  });
});
