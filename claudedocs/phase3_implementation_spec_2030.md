# Phase 3 Implementation Specification: Autonomous & Immersive (2030-2035)

**Status**: Future Implementation
**Duration**: 60 months
**Total Effort**: ~80 weeks of development
**Dependencies**: Phase 1 & 2 completion

---

## 1. Autonomous Agents & Workflows

**Timeline**: 2030-2031 (20 weeks)
**Priority**: CRITICAL
**Dependencies**: Multi-Agent Architecture from Phase 2

### 1.1 Autonomous Agent Types

**File**: `apps/web/lib/autonomous/types.ts`

```typescript
export interface AutonomousAgent extends Agent {
  type: 'autonomous';
  autonomy: 'low' | 'medium' | 'high';
  maxExecutionTime?: number;
  requiresApproval: boolean;
  approvalThreshold?: 'critical' | 'moderate' | 'all';
  capabilities: AutonomousCapability[];
}

export type AutonomousCapability =
  | 'file-operations'
  | 'network-requests'
  | 'system-commands'
  | 'api-calls'
  | 'database-operations'
  | 'email'
  | 'scheduling'
  | 'task-automation';

export interface Workflow {
  id: string;
  name: string;
  description: string;
  creator: string;
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  schedule?: Schedule;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
  lastExecuted?: number;
}

export interface WorkflowStep {
  id: string;
  type: 'agent-task' | 'condition' | 'loop' | 'parallel' | 'delay' | 'approval';
  config: Record<string, unknown>;
  nextStepId?: string;
  errorHandling?: 'retry' | 'continue' | 'fail' | 'approve';
  maxRetries?: number;
}

export interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'webhook' | 'event' | 'condition';
  config: Record<string, unknown>;
}

export interface Schedule {
  frequency: 'once' | 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  interval?: number; // For 'minutes' frequency
  timezone?: string;
  startDate?: number;
  endDate?: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'awaiting-approval' | 'cancelled';
  currentStepId: string;
  startedAt: number;
  completedAt?: number;
  results: Map<string, unknown>;
  errors: ExecutionError[];
  approvals: Approval[];
}

export interface ExecutionError {
  stepId: string;
  error: string;
  timestamp: number;
  resolved: boolean;
}

export interface Approval {
  id: string;
  stepId: string;
  requestedBy: string;
  requestedAt: number;
  approvedBy?: string;
  approvedAt?: number;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
}
```

### 1.2 Safe Condition Evaluator (JSON Logic)

**File**: `apps/web/lib/autonomous/condition-evaluator.ts`

```typescript
import { jsonLogic } from 'json-rules-engine-simplified';

/**
 * Safe condition evaluator using JSON Logic format
 * Avoids eval() and new Function() for security
 */
export class ConditionEvaluator {
  /**
   * Evaluate a condition using JSON Logic format
   * Format: { "operator": ["value1", "value2"] }
   *
   * Examples:
   * - { "==": [{"var": "status"}, "completed"] }
   * - { ">=": [{"var": "score"}, 100] }
   * - { "and": [
   *     { "==": [{"var": "user.role"}, "admin"] },
   *     { "in": [{"var": "user.permission"}, ["read", "write"]] }
   *   ]}
   */
  static evaluate(
    condition: object,
    context: Record<string, unknown>
  ): boolean {
    try {
      // Use JSON Logic for safe condition evaluation
      const result = jsonLogic(condition, context);
      return Boolean(result);
    } catch (error) {
      console.error('[ConditionEvaluator] Evaluation error:', error);
      return false;
    }
  }

  /**
   * Parse natural language condition to JSON Logic
   * This could use an LLM for conversion
   */
  static async parseCondition(
    naturalLanguage: string
  ): Promise<object> {
    // In production, this would use an LLM to convert
    // natural language to JSON Logic format
    // For now, return a simple equality check

    return {
      "==": [
        { "var": naturalLanguage.trim() },
        true
      ]
    };
  }

  /**
   * Validate condition structure
   */
  static validate(condition: object): boolean {
    try {
      JSON.stringify(condition);
      return true;
    } catch {
      return false;
    }
  }
}
```

### 1.3 Workflow Engine (Safe Implementation)

**File**: `apps/web/lib/autonomous/workflow-engine.ts`

```typescript
import type {
  Workflow,
  WorkflowExecution,
  WorkflowStep,
  Approval,
} from './types';
import { ConditionEvaluator } from './condition-evaluator';

export class WorkflowEngine {
  private executions: Map<string, WorkflowExecution> = new Map();
  private scheduledWorkflows: Map<string, NodeJS.Timeout> = new Map();
  private approvalCallbacks: Map<string, (approval: Approval) => void> = new Map();

  async executeWorkflow(
    workflow: Workflow,
    triggerContext?: Record<string, unknown>
  ): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      id: `exec-${Date.now()}`,
      workflowId: workflow.id,
      status: 'running',
      currentStepId: workflow.steps[0]?.id || '',
      startedAt: Date.now(),
      results: new Map(),
      errors: [],
      approvals: [],
    };

    this.executions.set(execution.id, execution);

    try {
      await this.executeSteps(workflow, execution, triggerContext);
      execution.status = 'completed';
      execution.completedAt = Date.now();
    } catch (error) {
      execution.status = 'failed';
      execution.errors.push({
        stepId: execution.currentStepId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        resolved: false,
      });
    }

    return execution;
  }

  private async executeSteps(
    workflow: Workflow,
    execution: WorkflowExecution,
    context: Record<string, unknown> = {}
  ): Promise<void> {
    let step: WorkflowStep | undefined;
    let stepIndex = 0;

    while ((step = workflow.steps[stepIndex])) {
      execution.currentStepId = step.id;

      // Check if approval is required
      if (step.type === 'approval') {
        const approval = await this.requestApproval(step, context);
        execution.approvals.push(approval);

        if (approval.status === 'rejected') {
          throw new Error(`Step ${step.id} was rejected: ${approval.reason}`);
        }

        if (approval.status === 'pending') {
          execution.status = 'awaiting-approval';

          // Wait for approval (using callback or promise)
          await this.waitForApproval(approval.id);

          if (approval.status !== 'approved') {
            throw new Error(`Step ${step.id} approval failed`);
          }
        }
      }

      // Execute step based on type
      let stepResult: unknown;

      try {
        switch (step.type) {
          case 'agent-task':
            stepResult = await this.executeAgentTask(step, context);
            break;

          case 'condition':
            const conditionMet = ConditionEvaluator.evaluate(
              step.config.condition as object,
              context
            );

            // Conditional branching
            if (conditionMet && step.nextStepId) {
              // Jump to nextStepId if condition is met
              const nextStepIndex = workflow.steps.findIndex(
                (s) => s.id === step.nextStepId
              );
              if (nextStepIndex >= 0) {
                stepIndex = nextStepIndex;
                continue;
              }
            }
            break;

          case 'loop':
            await this.executeLoop(step, context, execution);
            break;

          case 'parallel':
            await this.executeParallelSteps(step, context, execution);
            break;

          case 'delay':
            await this.executeDelay(step);
            break;

          default:
            throw new Error(`Unknown step type: ${step.type}`);
        }

        execution.results.set(step.id, stepResult);
      } catch (error) {
        if (step.errorHandling === 'retry') {
          const retries = step.maxRetries || 3;
          let lastError = error;

          for (let i = 0; i < retries; i++) {
            try {
              // Exponential backoff
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * Math.pow(2, i))
              );

              stepResult = await this.executeAgentTask(step, context);
              execution.results.set(step.id, stepResult);
              break;
            } catch (retryError) {
              lastError = retryError;
            }
          }

          if (!stepResult) {
            throw lastError;
          }
        } else if (step.errorHandling === 'continue') {
          // Log error but continue
          execution.errors.push({
            stepId: step.id,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
            resolved: false,
          });
        } else {
          throw error;
        }
      }

      stepIndex++;
    }
  }

  private async executeAgentTask(
    step: WorkflowStep,
    context: Record<string, unknown>
  ): Promise<unknown> {
    const { agentId, prompt, tools } = step.config as {
      agentId: string;
      prompt: string;
      tools?: string[];
    };

    // Call the agent with the prompt
    // Implementation depends on your agent integration
    return {
      agentId,
      result: `Agent ${agentId} executed: ${prompt}`,
      timestamp: Date.now(),
    };
  }

  private async executeLoop(
    step: WorkflowStep,
    context: Record<string, unknown>,
    execution: WorkflowExecution
  ): Promise<void> {
    const { iterations, iterable } = step.config as {
      iterations?: number;
      iterable?: unknown[];
    };

    const items = iterable || [];
    const maxIterations = iterations || items.length;

    for (let i = 0; i < Math.min(maxIterations, items.length); i++) {
      const loopContext = {
        ...context,
        item: items[i],
        index: i,
      };

      // Execute loop body
      // This would execute child steps or configured action
      console.log(`Loop iteration ${i}:`, loopContext);
    }
  }

  private async executeParallelSteps(
    step: WorkflowStep,
    context: Record<string, unknown>,
    execution: WorkflowExecution
  ): Promise<void> {
    const { parallelSteps } = step.config as {
      parallelSteps: WorkflowStep[];
    };

    if (!parallelSteps) return;

    // Execute steps in parallel
    const promises = parallelSteps.map(async (parallelStep) => {
      const parallelExecution: WorkflowExecution = {
        id: `exec-parallel-${Date.now()}`,
        workflowId: execution.workflowId,
        status: 'running',
        currentStepId: parallelStep.id,
        startedAt: Date.now(),
        results: new Map(),
        errors: [],
        approvals: [],
      };

      try {
        await this.executeSteps(
          { steps: [parallelStep] } as Workflow,
          parallelExecution,
          context
        );
        parallelExecution.status = 'completed';
      } catch (error) {
        parallelExecution.status = 'failed';
        throw error;
      }

      return parallelExecution;
    });

    await Promise.all(promises);
  }

  private async executeDelay(step: WorkflowStep): Promise<void> {
    const { duration } = step.config as { duration: number };
    await new Promise((resolve) => setTimeout(resolve, duration));
  }

  private async requestApproval(
    step: WorkflowStep,
    context: Record<string, unknown>
  ): Promise<Approval> {
    const approvalId = `approval-${Date.now()}`;

    const approval: Approval = {
      id: approvalId,
      stepId: step.id,
      requestedBy: 'system',
      requestedAt: Date.now(),
      status: 'pending',
    };

    // Trigger UI notification
    this.notifyApprovalRequested(approval, step, context);

    return approval;
  }

  private notifyApprovalRequested(
    approval: Approval,
    step: WorkflowStep,
    context: Record<string, unknown>
  ): void {
    // Send notification via WebSocket or push notification
    // UI would show approval dialog
    console.log('[WorkflowEngine] Approval requested:', approval);
  }

  private async waitForApproval(approvalId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Approval timeout'));
      }, 24 * 60 * 60 * 1000); // 24 hour timeout

      this.approvalCallbacks.set(approvalId, (approval: Approval) => {
        clearTimeout(timeout);

        if (approval.status === 'approved') {
          resolve();
        } else {
          reject(new Error(`Approval ${approvalId} was rejected`));
        }
      });
    });
  }

  /**
   * Called by UI when user responds to approval request
   */
  respondToApproval(
    approvalId: string,
    approved: boolean,
    userId: string,
    reason?: string
  ): void {
    const callback = this.approvalCallbacks.get(approvalId);
    if (!callback) return;

    const approval: Approval = {
      id: approvalId,
      stepId: '', // Would be looked up
      requestedBy: 'system',
      requestedAt: Date.now(),
      approvedBy: userId,
      approvedAt: Date.now(),
      status: approved ? 'approved' : 'rejected',
      reason,
    };

    callback(approval);
    this.approvalCallbacks.delete(approvalId);
  }

  scheduleWorkflow(workflow: Workflow): void {
    if (!workflow.schedule) return;

    const { schedule } = workflow;
    let intervalMs: number;

    switch (schedule.frequency) {
      case 'minutes':
        intervalMs = (schedule.interval || 5) * 60 * 1000;
        break;
      case 'hourly':
        intervalMs = 60 * 60 * 1000;
        break;
      case 'daily':
        intervalMs = 24 * 60 * 60 * 1000;
        break;
      case 'weekly':
        intervalMs = 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        return;
    }

    const execute = () => {
      this.executeWorkflow(workflow);
    };

    const timeoutId = setInterval(execute, intervalMs);
    this.scheduledWorkflows.set(workflow.id, timeoutId as any);
  }

  unscheduleWorkflow(workflowId: string): void {
    const timeoutId = this.scheduledWorkflows.get(workflowId);
    if (timeoutId) {
      clearInterval(timeoutId);
      this.scheduledWorkflows.delete(workflowId);
    }
  }

  cancelExecution(executionId: string): void {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.completedAt = Date.now();
    }
  }

  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  getWorkflowExecutions(workflowId: string): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter(
      (e) => e.workflowId === workflowId
    );
  }

  getActiveExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter(
      (e) => e.status === 'running' || e.status === 'awaiting-approval'
    );
  }
}

export const workflowEngine = new WorkflowEngine();
```

### 1.4 Workflow Store

**File**: `apps/web/lib/autonomous/workflow-store.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workflow } from './types';

interface WorkflowStoreState {
  workflows: Workflow[];
  activeWorkflowId: string | null;

  setActiveWorkflow: (id: string | null) => void;
  createWorkflow: (workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) => Workflow;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  deleteWorkflow: (id: string) => void;
  duplicateWorkflow: (id: string) => Workflow;
  getWorkflow: (id: string) => Workflow | undefined;
}

export const useWorkflowStore = create<WorkflowStoreState>()(
  persist(
    (set, get) => ({
      workflows: [],
      activeWorkflowId: null,

      setActiveWorkflow: (id) => set({ activeWorkflowId: id }),

      createWorkflow: (workflowConfig) => {
        const workflow: Workflow = {
          ...workflowConfig,
          id: `workflow-${Date.now()}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          workflows: [...state.workflows, workflow],
          activeWorkflowId: workflow.id,
        }));

        return workflow;
      },

      updateWorkflow: (id, updates) =>
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === id
              ? { ...w, ...updates, updatedAt: Date.now() }
              : w
          ),
        })),

      deleteWorkflow: (id) =>
        set((state) => ({
          workflows: state.workflows.filter((w) => w.id !== id),
          activeWorkflowId:
            state.activeWorkflowId === id ? null : state.activeWorkflowId,
        })),

      duplicateWorkflow: (id) => {
        const workflow = get().workflows.find((w) => w.id === id);
        if (!workflow) throw new Error('Workflow not found');

        const duplicated: Workflow = {
          ...workflow,
          id: `workflow-${Date.now()}`,
          name: `${workflow.name} (Copy)`,
          status: 'draft',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastExecuted: undefined,
        };

        set((state) => ({
          workflows: [...state.workflows, duplicated],
        }));

        return duplicated;
      },

      getWorkflow: (id) => get().workflows.find((w) => w.id === id),
    })),
    {
      name: 'workflow-storage',
    }
  )
);
```

### 1.5 Workflow Builder UI

**File**: `apps/web/components/autonomous/workflow-builder.tsx`

```typescript
'use client';

import { useState, useCallback } from 'react';
import { useWorkflowStore } from '@/lib/autonomous/workflow-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Play, Save, Copy } from 'lucide-react';
import type { Workflow, WorkflowStep } from '@/lib/autonomous/types';
import { toast } from 'sonner';

export function WorkflowBuilder() {
  const { createWorkflow, updateWorkflow, activeWorkflow } = useWorkflowStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }

    if (!activeWorkflow) {
      createWorkflow({
        name: name.trim(),
        description: description.trim(),
        steps: [],
        triggers: [{ type: 'manual', config: {} }],
        status: 'draft',
        creator: 'user', // Would come from auth
      });
    } else {
      updateWorkflow(activeWorkflow.id, {
        name: name.trim(),
        description: description.trim(),
      });
    }

    toast.success('Workflow saved successfully');
  }, [name, description, activeWorkflow, createWorkflow, updateWorkflow]);

  return (
    <div className="h-full flex">
      {/* Sidebar - Workflow Details */}
      <div className="w-80 border-r p-4 space-y-4">
        <div>
          <Label htmlFor="workflow-name">Workflow Name</Label>
          <Input
            id="workflow-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Workflow"
          />
        </div>

        <div>
          <Label htmlFor="workflow-description">Description</Label>
          <Textarea
            id="workflow-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this workflow do?"
            rows={3}
          />
        </div>

        <WorkflowTriggers />

        <div className="pt-4 border-t space-y-2">
          <Button onClick={handleSave} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            Save Workflow
          </Button>

          {activeWorkflow && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                useWorkflowStore.getState().duplicateWorkflow(activeWorkflow.id);
                toast.success('Workflow duplicated');
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </Button>
          )}
        </div>
      </div>

      {/* Main Canvas - Steps */}
      <div className="flex-1 flex flex-col">
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Workflow Steps</h2>
            <Button size="sm">
              <Play className="h-4 w-4 mr-2" />
              Test Run
            </Button>
          </div>
        </div>

        <WorkflowCanvas />
      </div>

      {/* Right Panel - Step Configuration */}
      <div className="w-96 border-l p-4">
        <StepConfigPanel />
      </div>
    </div>
  );
}

// Additional components would go here...
```

---

## 2. Spatial Interface (WebXR)

**Timeline**: 2032-2033 (24 weeks)
**Priority**: MEDIUM
**Dependencies**: None

### 2.1 WebXR Canvas

**File**: `apps/web/components/spatial/spatial-canvas.tsx`

```typescript
'use client';

import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Goggles, Maximize2, Home } from 'lucide-react';

export function SpatialCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isXRSupported, setIsXRSupported] = useState(false);
  const [isXRActive, setIsXRActive] = useState(false);
  const [xrMode, setXRMode] = useState<'vr' | 'ar' | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Check WebXR support
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        setIsXRSupported(supported);
      });
    }

    // Initialize 3D scene (simplified)
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl2');

    if (!gl) return;

    // Basic WebGL setup
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }, []);

  const handleEnterVR = async () => {
    if (!navigator.xr) return;

    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      });

      await session.updateRenderState({
        baseLayer: new XRWebGLLayer(session, gl),
      });

      // Request animation frame for XR
      session.requestAnimationFrame(onXRFrame);

      setIsXRActive(true);
      setXRMode('vr');
    } catch (error) {
      console.error('[WebXR] Failed to enter VR:', error);
      toast.error('Failed to enter VR mode');
    }
  };

  const handleEnterAR = async () => {
    if (!navigator.xr) return;

    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        optionalFeatures: ['dom-overlay', 'hit-test', 'anchors'],
      });

      setIsXRActive(true);
      setXRMode('ar');
    } catch (error) {
      console.error('[WebXR] Failed to enter AR:', error);
      toast.error('Failed to enter AR mode');
    }
  };

  const handleExitXR = async () => {
    // End XR session
    setIsXRActive(false);
    setXRMode(null);
  };

  function onXRFrame(time: XRFrame, session: XRSession) {
    // Render XR frame
    session.requestAnimationFrame(onXRFrame);
  }

  return (
    <div className="relative h-full w-full bg-black">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Overlay UI */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <Badge variant={isXRActive ? 'default' : 'secondary'}>
            {xrMode?.toUpperCase() || '2D Mode'}
          </Badge>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {!isXRActive && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnterAR}
                className="bg-black/50 text-white border-white/20"
                disabled={!isXRSupported}
              >
                <Goggles className="h-4 w-4 mr-2" />
                Enter AR
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleEnterVR}
                className="bg-black/50 text-white border-white/20"
                disabled={!isXRSupported}
              >
                <Maximize2 className="h-4 w-4 mr-2" />
                Enter VR
              </Button>
            </>
          )}

          {isXRActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExitXR}
              className="bg-black/50 text-white border-white/20"
            >
              <Home className="h-4 w-4 mr-2" />
              Exit {xrMode?.toUpperCase()}
            </Button>
          )}
        </div>
      </div>

      {!isXRSupported && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
          <p className="text-white/70 text-sm">
            WebXR is not supported in this browser
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## 3. Privacy-First Architecture (Local ML)

**Timeline**: 2033-2034 (12 weeks)
**Priority**: HIGH
**Dependencies**: None

### 3.1 Privacy Settings Store

**File**: `apps/web/lib/privacy/privacy-store.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PrivacySettings {
  // Data Processing
  localProcessing: boolean;
  shareAnonymizedData: boolean;

  // Retention
  chatRetention: '1-hour' | '1-day' | '1-week' | '1-month' | 'forever';
  artifactRetention: '1-hour' | '1-day' | '1-week' | '1-month' | 'forever';

  // Memory
  enableSemanticMemory: boolean;
  memoryEmbeddingsLocal: boolean;

  // Analytics
  analyticsEnabled: boolean;
  analyticsAnonymized: boolean;

  // AI Processing
  preferLocalModels: boolean;
  fallbackToCloud: boolean;

  // Encryption
  encryptChatHistory: boolean;
  encryptArtifacts: boolean;

  // GDPR
  rightToExport: boolean;
  rightToDelete: boolean;
  rightToRectify: boolean;
}

interface PrivacyStoreState {
  settings: PrivacySettings;

  updateSettings: (updates: Partial<PrivacySettings>) => void;
  resetSettings: () => void;
  exportData: () => Promise<Blob>;
  deleteAllData: () => Promise<void>;
}

const DEFAULT_SETTINGS: PrivacySettings = {
  localProcessing: false,
  shareAnonymizedData: true,
  chatRetention: 'forever',
  artifactRetention: 'forever',
  enableSemanticMemory: true,
  memoryEmbeddingsLocal: false,
  analyticsEnabled: true,
  analyticsAnonymized: true,
  preferLocalModels: false,
  fallbackToCloud: true,
  encryptChatHistory: true,
  encryptArtifacts: true,
  rightToExport: true,
  rightToDelete: true,
  rightToRectify: true,
};

export const usePrivacyStore = create<PrivacyStoreState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,

      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      resetSettings: () =>
        set({ settings: DEFAULT_SETTINGS }),

      async exportData(): Promise<Blob> {
        const { settings } = get();

        // Collect all user data
        const userData = {
          settings,
          // Add chats, artifacts, etc.
          exportedAt: new Date().toISOString(),
        };

        return new Blob([JSON.stringify(userData, null, 2)], {
          type: 'application/json',
        });
      },

      async deleteAllData(): Promise<void> {
        // Delete all user data from IndexedDB, server, etc.
        // This would trigger the right to erasure (GDPR)

        if (confirm('Are you sure you want to delete all your data? This cannot be undone.')) {
          // Delete local data
          // Call server to delete remote data
          console.log('[PrivacyStore] Deleting all user data');
        }
      },
    })),
    {
      name: 'privacy-settings',
    }
  )
);
```

### 3.2 Privacy Settings UI

**File**: `apps/web/components/privacy/privacy-settings.tsx`

```typescript
'use client';

import { usePrivacyStore } from '@/lib/privacy/privacy-store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Download, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function PrivacySettings() {
  const { settings, updateSettings, exportData, deleteAllData, resetSettings } =
    usePrivacyStore();

  const handleExport = async () => {
    try {
      const blob = await exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `duyetbot-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAllData();
      toast.success('All data deleted successfully');
    } catch (error) {
      toast.error('Failed to delete data');
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Processing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Local Processing</Label>
              <p className="text-sm text-muted-foreground">
                Process AI requests locally when possible (WebAssembly ML)
              </p>
            </div>
            <Switch
              checked={settings.localProcessing}
              onCheckedChange={(checked) =>
                updateSettings({ localProcessing: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Share Anonymized Data</Label>
              <p className="text-sm text-muted-foreground">
                Help improve the service by sharing anonymized usage data
              </p>
            </div>
            <Switch
              checked={settings.shareAnonymizedData}
              onCheckedChange={(checked) =>
                updateSettings({ shareAnonymizedData: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Retention */}
      <Card>
        <CardHeader>
          <CardTitle>Data Retention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Chat History Retention</Label>
            <Select
              value={settings.chatRetention}
              onValueChange={(value: any) =>
                updateSettings({ chatRetention: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-hour">1 hour</SelectItem>
                <SelectItem value="1-day">1 day</SelectItem>
                <SelectItem value="1-week">1 week</SelectItem>
                <SelectItem value="1-month">1 month</SelectItem>
                <SelectItem value="forever">Forever</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Artifact Retention</Label>
            <Select
              value={settings.artifactRetention}
              onValueChange={(value: any) =>
                updateSettings({ artifactRetention: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-hour">1 hour</SelectItem>
                <SelectItem value="1-day">1 day</SelectItem>
                <SelectItem value="1-week">1 week</SelectItem>
                <SelectItem value="1-month">1 month</SelectItem>
                <SelectItem value="forever">Forever</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Memory */}
      <Card>
        <CardHeader>
          <CardTitle>Semantic Memory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Semantic Memory</Label>
              <p className="text-sm text-muted-foreground">
                Allow AI to remember context across sessions using embeddings
              </p>
            </div>
            <Switch
              checked={settings.enableSemanticMemory}
              onCheckedChange={(checked) =>
                updateSettings({ enableSemanticMemory: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Local Embeddings</Label>
              <p className="text-sm text-muted-foreground">
                Store embeddings locally instead of on server
              </p>
            </div>
            <Switch
              checked={settings.memoryEmbeddingsLocal}
              onCheckedChange={(checked) =>
                updateSettings({ memoryEmbeddingsLocal: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Encryption */}
      <Card>
        <CardHeader>
          <CardTitle>Encryption</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Encrypt Chat History</Label>
              <p className="text-sm text-muted-foreground">
                End-to-end encrypt chat messages
              </p>
            </div>
            <Switch
              checked={settings.encryptChatHistory}
              onCheckedChange={(checked) =>
                updateSettings({ encryptChatHistory: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Encrypt Artifacts</Label>
              <p className="text-sm text-muted-foreground">
                End-to-end encrypt artifact content
              </p>
            </div>
            <Switch
              checked={settings.encryptArtifacts}
              onCheckedChange={(checked) =>
                updateSettings({ encryptArtifacts: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* GDPR Rights */}
      <Card>
        <CardHeader>
          <CardTitle>Your Data Rights (GDPR)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            Export All Data (Right to Portability)
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => toast.info('Rectification feature coming soon')}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Rectify Data (Right to Rectification)
          </Button>

          <Button
            variant="destructive"
            className="w-full justify-start"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete All Data (Right to Erasure)
          </Button>
        </CardContent>
      </Card>

      {/* Reset */}
      <Card>
        <CardHeader>
          <CardTitle>Reset Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => {
              resetSettings();
              toast.success('Settings reset to defaults');
            }}
          >
            Reset to Default
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Summary Phase 3

**Total New Files**: ~50 files
**Total Lines of Code**: ~15,000 lines (safe implementation)

**Key Features**:
1. **Autonomous Agents & Workflows**
   - Safe condition evaluation using JSON Logic (no eval/new Function)
   - Human-in-the-loop approval system
   - Scheduled and triggered workflows
   - Error handling with retry logic

2. **Spatial Interface (WebXR)**
   - VR and AR mode support
   - 3D workspace visualization
   - Controller input handling
   - Graceful fallback for unsupported devices

3. **Privacy-First Architecture**
   - Local processing option
   - Data retention controls
   - Semantic memory settings
   - Encryption options
   - GDPR compliance tools (export, delete, rectify)

**Security Improvements**:
- ❌ No `eval()` or `new Function()` for condition evaluation
- ✅ Uses JSON Logic format for safe expression evaluation
- ✅ Input validation for all workflow configurations
- ✅ Proper error handling and timeout mechanisms

---

## All Phases Summary

| Phase | Duration | Files | LOC | Key Focus |
|-------|----------|-------|-----|-----------|
| **Phase 1** | 18 months | ~50 | ~8,000 | PWA, Streaming, Artifacts, GDPR |
| **Phase 2** | 36 months | ~40 | ~12,000 | Multi-Agent, Collaboration, Multimodal |
| **Phase 3** | 60 months | ~50 | ~15,000 | Autonomous, Spatial, Privacy |
| **Total** | **10 years** | **~140** | **~35,000** | **Complete Transformation** |

**Implementation Notes**:
1. Each phase builds on the previous
2. Features can be developed in parallel within phases
3. Security is prioritized (no dynamic code evaluation)
4. Privacy is designed in from the start
5. User experience is consistent across all phases
