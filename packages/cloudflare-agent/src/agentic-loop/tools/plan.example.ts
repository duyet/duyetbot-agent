/**
 * Plan Tool Integration Examples
 *
 * Shows how to use the plan tool in various scenarios within the agentic loop.
 *
 * Note: This is an example file and not part of the production build.
 */

import type { LoopContext } from '../types.js';
import { planTool } from './plan.js';

/**
 * Example 1: Using plan tool in a simple scenario
 *
 * Agent is asked to implement a feature and uses plan tool to decompose work.
 */
export async function exampleSimplePlanning() {
  const mockContext: LoopContext = {
    executionContext: {
      platform: 'telegram',
      traceId: 'trace-001',
      userId: 'user-123',
    } as any,
    iteration: 0,
    toolHistory: [],
    isSubagent: false,
  };

  const result = await planTool.execute(
    {
      task: 'Implement user authentication with JWT tokens',
      context: 'Express.js backend with PostgreSQL database',
    },
    mockContext
  );

  console.log('Plan Tool Result:');
  console.log('Success:', result.success);
  console.log('Output:', result.output);
  console.log('Duration:', result.durationMs, 'ms');
}

/**
 * Example 2: Using plan tool with accumulated tool history
 *
 * Agent has already used other tools and now needs to plan next steps.
 */
export async function exampleWithToolHistory() {
  const mockContext: LoopContext = {
    executionContext: {
      platform: 'github',
      traceId: 'trace-002',
      userId: 'user-456',
    } as any,
    iteration: 2,
    toolHistory: [
      {
        toolName: 'research',
        args: { query: 'best practices for REST API design' },
        result: {
          success: true,
          output: 'Found 5 articles on REST API best practices...',
          durationMs: 234,
        },
        iteration: 0,
        timestamp: Date.now() - 5000,
      },
      {
        toolName: 'memory',
        args: { query: 'previous API projects' },
        result: {
          success: true,
          output: 'Found blog post on microservices...',
          durationMs: 112,
        },
        iteration: 1,
        timestamp: Date.now() - 3000,
      },
    ],
    isSubagent: false,
  };

  const result = await planTool.execute(
    {
      task: 'Design and implement RESTful API for product catalog',
      context: 'Node.js, MongoDB, scalable for 10k+ products',
    },
    mockContext
  );

  console.log('\nPlan Tool with History:');
  console.log('Output mentions previous tools:', result.output.includes('research, memory'));
  console.log('Output mentions iteration:', result.output.includes('Iteration: 3'));
}

/**
 * Example 3: Planning a complex multi-stage task
 *
 * Large, complex task that benefits from thorough decomposition.
 */
export async function exampleComplexPlanning() {
  const mockContext: LoopContext = {
    executionContext: {
      platform: 'telegram',
      traceId: 'trace-003',
      userId: 'user-789',
    } as any,
    iteration: 0,
    toolHistory: [],
    isSubagent: false,
  };

  const result = await planTool.execute(
    {
      task: 'Design and implement real-time collaborative document editing platform',
      context:
        'React frontend, Node.js backend, WebSocket for real-time, Operational Transformation for conflict resolution, PostgreSQL for persistence',
    },
    mockContext
  );

  console.log('\nComplex Task Planning:');
  console.log('Successfully planned:', result.success);
  console.log('Output length:', result.output.length, 'characters');
  console.log('Data includes task:', (result.data as any).task.substring(0, 50) + '...');
}

/**
 * Example 4: Error handling - empty task
 *
 * Shows how plan tool handles invalid input.
 */
export async function exampleErrorHandling() {
  const mockContext: LoopContext = {
    executionContext: {
      platform: 'telegram',
      traceId: 'trace-004',
      userId: 'user-999',
    } as any,
    iteration: 0,
    toolHistory: [],
    isSubagent: false,
  };

  const result = await planTool.execute(
    {
      task: '', // Invalid: empty task
    },
    mockContext
  );

  console.log('\nError Handling:');
  console.log('Success:', result.success);
  console.log('Error message:', result.error);
}

/**
 * Example 5: Using plan tool as subagent
 *
 * Plan tool called from within a subagent context.
 */
export async function exampleSubagentPlanning() {
  const mockContext: LoopContext = {
    executionContext: {
      platform: 'telegram',
      traceId: 'trace-005',
      userId: 'user-sub',
    } as any,
    iteration: 1,
    toolHistory: [],
    isSubagent: true,
    parentLoopId: 'parent-loop-123',
  };

  const result = await planTool.execute(
    {
      task: 'Implement data validation layer',
      context: 'Zod schema validation library',
    },
    mockContext
  );

  console.log('\nSubagent Planning:');
  console.log('Executed as subagent:', mockContext.isSubagent);
  console.log('Parent loop ID:', mockContext.parentLoopId);
  console.log('Plan generated successfully:', result.success);
}

/**
 * Example 6: Integration with ToolExecutor
 *
 * Shows how plan tool would be registered and used with ToolExecutor.
 */
export async function exampleToolExecutorIntegration() {
  // This is pseudocode - requires actual ToolExecutor import
  /*
  import { ToolExecutor } from '../tool-executor.js';
  import { planTool } from './plan.js';

  const executor = new ToolExecutor();
  executor.register(planTool);

  // Verify tool is registered
  console.log('Available tools:', executor.getNames());
  // Output: ['plan']

  // Get Anthropic-compatible tool definition
  const anthropicTools = executor.toAnthropicFormat();
  // Output: [{ name: 'plan', description: '...', input_schema: {...} }]

  // Use in actual LLM call
  const response = await llamaAPI.chat({
    tools: anthropicTools,
    messages: [{ role: 'user', content: 'Plan how to build a website' }]
  });

  // If LLM generates a tool call
  if (response.toolCall) {
    const result = await executor.execute(loopContext, response.toolCall);
    console.log('Tool result:', result.output);
  }
  */
}

/**
 * Example 7: Real-world scenario - Code refactoring task
 *
 * Complete example of planning a real-world development task.
 */
export async function exampleRealWorldRefactoring() {
  const mockContext: LoopContext = {
    executionContext: {
      platform: 'github',
      traceId: 'trace-refactor',
      userId: 'dev-team',
    } as any,
    iteration: 0,
    toolHistory: [],
    isSubagent: false,
  };

  const result = await planTool.execute(
    {
      task: 'Refactor authentication module to use modern patterns',
      context: `
        Current state: Monolithic auth module (800+ LOC)
        Goal: Extract into composable, testable utilities
        Tech: TypeScript, Jest for tests, Express.js middleware
        Constraints: Must maintain backward compatibility during migration
        Timeline: 2-3 sprints
      `,
    },
    mockContext
  );

  console.log('\nReal-world Refactoring Plan:');
  console.log('Task recognized:', result.output.includes('authentication'));
  console.log('Context incorporated:', result.output.includes('TypeScript'));
  console.log('Planning guidance provided:', result.output.includes('numbered steps'));
}

/**
 * Run all examples
 *
 * Demonstrates the plan tool in various scenarios.
 */
export async function runAllExamples() {
  console.log('=== Plan Tool Integration Examples ===\n');

  try {
    await exampleSimplePlanning();
    await exampleWithToolHistory();
    await exampleComplexPlanning();
    await exampleErrorHandling();
    await exampleSubagentPlanning();
    await exampleRealWorldRefactoring();

    console.log('\n✓ All examples completed successfully');
  } catch (error) {
    console.error('Example execution failed:', error);
  }
}

// Uncomment to run examples:
// runAllExamples();
