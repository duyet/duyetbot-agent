/**
 * Agent Tools Library
 *
 * Shared tools for use by chat API.
 */

import { tool } from 'ai';
import { z } from 'zod';

export const currentTime = tool({
  description: 'Get the current time in a specific timezone',
  inputSchema: z.object({
    timezone: z.string().optional().describe('Timezone (e.g., "UTC", "America/New_York")'),
  }),
  execute: async ({ timezone = 'UTC' }) => {
    return {
      time: new Date().toLocaleString('en-US', { timeZone: timezone }),
      timezone,
    };
  },
});

export const webSearch = tool({
  description: 'Search the web for current information',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    numResults: z.number().optional().default(5).describe('Number of results to return'),
  }),
  execute: async ({ query }) => {
    return { query, results: [], message: 'Web search not yet implemented' };
  },
});

export const calculator = tool({
  description: 'Perform mathematical calculations',
  inputSchema: z.object({
    expression: z.string().describe('Mathematical expression to evaluate (e.g., "2 + 2", "Math.sqrt(16)")'),
  }),
  execute: async ({ expression }) => {
    try {
      const sanitized = expression.replace(/[^0-9+\-*/().\sMatha-z]/gi, '');
      const result = Function(`"use strict"; return (${sanitized})`)();
      return { expression, result };
    } catch (error) {
      return { expression, error: error instanceof Error ? error.message : 'Invalid expression' };
    }
  },
});

export const dateMath = tool({
  description: 'Perform date and time calculations',
  inputSchema: z.object({
    operation: z.enum(['add', 'subtract', 'difference']).describe('Operation to perform'),
    baseDate: z.string().optional().describe('Base date (ISO format or "now")'),
    targetDate: z.string().optional().describe('Target date for difference calculation (ISO format)'),
    amount: z.number().optional().describe('Amount to add/subtract'),
    unit: z.enum(['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years']).optional().describe('Unit of time for amount'),
  }),
  execute: async ({ operation, baseDate, targetDate, amount, unit }) => {
    const base = baseDate === 'now' || !baseDate ? new Date() : new Date(baseDate);
    let result: Date;
    let diffResult: number | undefined;

    switch (operation) {
      case 'add': {
        if (amount === undefined || !unit) return { error: 'Amount and unit are required for add operation' };
        result = new Date(base);
        const multiplier = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000, weeks: 604800000, months: 2592000000, years: 31536000000 };
        result.setTime(result.getTime() + amount * (multiplier[unit] || 0));
        break;
      }
      case 'subtract': {
        if (amount === undefined || !unit) return { error: 'Amount and unit are required for subtract operation' };
        result = new Date(base);
        const multiplier = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000, weeks: 604800000, months: 2592000000, years: 31536000000 };
        result.setTime(result.getTime() - amount * (multiplier[unit] || 0));
        break;
      }
      case 'difference': {
        if (!targetDate) return { error: 'Target date is required for difference operation' };
        const target = new Date(targetDate);
        if (Number.isNaN(target.getTime())) return { error: 'Invalid target date format' };
        diffResult = Math.abs(base.getTime() - target.getTime());
        return {
          operation: 'difference',
          baseDate: base.toISOString(),
          targetDate: target.toISOString(),
          difference: { milliseconds: diffResult, seconds: Math.floor(diffResult / 1000), minutes: Math.floor(diffResult / 60000), hours: Math.floor(diffResult / 3600000), days: Math.floor(diffResult / 86400000) },
        };
      }
      default:
        result = base;
    }

    return { operation, baseDate: base.toISOString(), result: result.toISOString(), formatted: result.toLocaleString('en-US') };
  },
});

export const weather = tool({
  description: 'Get current weather information for a location',
  inputSchema: z.object({
    location: z.string().describe('Location name'),
    units: z.enum(['celsius', 'fahrenheit']).optional().default('celsius').describe('Temperature units'),
  }),
  execute: async ({ location, units }) => {
    return { location, temperature: units === 'celsius' ? 20 : 68, condition: 'Partly cloudy', humidity: 65, message: 'Weather data not yet implemented' };
  },
});

export const agentTools = { currentTime, webSearch, calculator, dateMath, weather } as const;
export type AgentTools = typeof agentTools;
