import type { Session, SessionState } from '@/agent/session';
import { describe, expect, it } from 'vitest';

describe('Session Types', () => {
  describe('SessionState', () => {
    it('should support active state', () => {
      const state: SessionState = 'active';
      expect(state).toBe('active');
    });

    it('should support paused state', () => {
      const state: SessionState = 'paused';
      expect(state).toBe('paused');
    });

    it('should support completed state', () => {
      const state: SessionState = 'completed';
      expect(state).toBe('completed');
    });

    it('should support failed state', () => {
      const state: SessionState = 'failed';
      expect(state).toBe('failed');
    });

    it('should support cancelled state', () => {
      const state: SessionState = 'cancelled';
      expect(state).toBe('cancelled');
    });
  });

  describe('Session', () => {
    it('should have required properties', () => {
      const session: Session = {
        id: 'session-123',
        state: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(session.id).toBe('session-123');
      expect(session.state).toBe('active');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
    });

    it('should support optional provider config', () => {
      const session: Session = {
        id: 'session-123',
        state: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        provider: {
          provider: 'claude',
          model: 'claude-3-5-sonnet-20241022',
          apiKey: 'test-key',
        },
      };

      expect(session.provider?.provider).toBe('claude');
      expect(session.provider?.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should support optional messages array', () => {
      const session: Session = {
        id: 'session-123',
        state: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      };

      expect(session.messages).toHaveLength(2);
      expect(session.messages![0]!.role).toBe('user');
      expect(session.messages![1]!.role).toBe('assistant');
    });

    it('should support optional metadata', () => {
      const session: Session = {
        id: 'session-123',
        state: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          userId: 'user-456',
          taskId: 'task-789',
          custom: 'value',
        },
      };

      expect(session.metadata?.userId).toBe('user-456');
      expect(session.metadata?.taskId).toBe('task-789');
      expect(session.metadata?.custom).toBe('value');
    });

    it('should support optional error information', () => {
      const session: Session = {
        id: 'session-123',
        state: 'failed',
        createdAt: new Date(),
        updatedAt: new Date(),
        error: {
          message: 'Something went wrong',
          code: 'EXECUTION_ERROR',
        },
      };

      expect(session.state).toBe('failed');
      expect(session.error?.message).toBe('Something went wrong');
      expect(session.error?.code).toBe('EXECUTION_ERROR');
    });

    it('should support optional tool results', () => {
      const session: Session = {
        id: 'session-123',
        state: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
        toolResults: [
          {
            toolName: 'bash',
            status: 'success',
            output: { stdout: 'Hello World', stderr: '' },
          },
        ],
      };

      expect(session.toolResults).toHaveLength(1);
      expect(session.toolResults![0]!.toolName).toBe('bash');
      expect(session.toolResults![0]!.status).toBe('success');
    });

    it('should support optional resume token', () => {
      const session: Session = {
        id: 'session-123',
        state: 'paused',
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeToken: 'resume-token-xyz',
      };

      expect(session.resumeToken).toBe('resume-token-xyz');
    });

    it('should support optional completion timestamp', () => {
      const now = new Date();
      const session: Session = {
        id: 'session-123',
        state: 'completed',
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      };

      expect(session.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('Session State Transitions', () => {
    it('should allow active to paused transition', () => {
      let session: Session = {
        id: 'session-123',
        state: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      session = { ...session, state: 'paused', updatedAt: new Date() };
      expect(session.state).toBe('paused');
    });

    it('should allow active to completed transition', () => {
      let session: Session = {
        id: 'session-123',
        state: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      session = {
        ...session,
        state: 'completed',
        updatedAt: new Date(),
        completedAt: new Date(),
      };
      expect(session.state).toBe('completed');
    });

    it('should allow active to failed transition', () => {
      let session: Session = {
        id: 'session-123',
        state: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      session = {
        ...session,
        state: 'failed',
        updatedAt: new Date(),
        error: { message: 'Error occurred', code: 'ERROR' },
      };
      expect(session.state).toBe('failed');
    });

    it('should allow paused to active transition', () => {
      let session: Session = {
        id: 'session-123',
        state: 'paused',
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeToken: 'token',
      };

      session = { ...session, state: 'active', updatedAt: new Date() };
      expect(session.state).toBe('active');
    });
  });
});
