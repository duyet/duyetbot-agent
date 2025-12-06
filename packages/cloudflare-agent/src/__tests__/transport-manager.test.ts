/**
 * Tests for TransportManager
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageRef, Transport } from '../transport/index.js';
import { TransportManager } from '../transport/index.js';

/**
 * Mock context type for testing
 */
interface MockContext {
  chatId: string;
}

/**
 * Create a mock transport for testing
 */
function createMockTransport(): Transport<MockContext> {
  return {
    send: vi.fn(async () => 'msg-123'),
    edit: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    typing: vi.fn(async () => undefined),
    react: vi.fn(async () => undefined),
    parseContext: vi.fn((ctx: MockContext) => ({
      text: 'test message',
      userId: 'user-1',
      chatId: ctx.chatId,
    })),
  };
}

describe('TransportManager', () => {
  let mockTransport: Transport<MockContext>;
  let manager: TransportManager<MockContext>;
  let ctx: MockContext;

  beforeEach(() => {
    mockTransport = createMockTransport();
    manager = new TransportManager(mockTransport);
    ctx = { chatId: 'chat-123' };
  });

  describe('send', () => {
    it('should send a message', async () => {
      const ref = await manager.send(ctx, 'Hello!');
      expect(ref).toBe('msg-123');
      expect(mockTransport.send).toHaveBeenCalledWith(ctx, 'Hello!');
    });
  });

  describe('edit', () => {
    it('should edit a message', async () => {
      await manager.edit(ctx, 'msg-123', 'Updated!');
      expect(mockTransport.edit).toHaveBeenCalledWith(ctx, 'msg-123', 'Updated!');
    });

    it('should throw error if transport does not support editing', async () => {
      const transportNoEdit: Transport<MockContext> = {
        ...mockTransport,
        edit: undefined,
      };
      const managerNoEdit = new TransportManager(transportNoEdit);

      await expect(managerNoEdit.edit(ctx, 'msg-123', 'Updated!')).rejects.toThrow(
        'Transport does not support message editing'
      );
    });
  });

  describe('delete', () => {
    it('should delete a message', async () => {
      await manager.delete(ctx, 'msg-123');
      expect(mockTransport.delete).toHaveBeenCalledWith(ctx, 'msg-123');
    });

    it('should throw error if transport does not support deletion', async () => {
      const transportNoDelete: Transport<MockContext> = {
        ...mockTransport,
        delete: undefined,
      };
      const managerNoDelete = new TransportManager(transportNoDelete);

      await expect(managerNoDelete.delete(ctx, 'msg-123')).rejects.toThrow(
        'Transport does not support message deletion'
      );
    });
  });

  describe('typing', () => {
    it('should send typing indicator', async () => {
      await manager.typing(ctx);
      expect(mockTransport.typing).toHaveBeenCalledWith(ctx);
    });

    it('should throw error if transport does not support typing', async () => {
      const transportNoTyping: Transport<MockContext> = {
        ...mockTransport,
        typing: undefined,
      };
      const managerNoTyping = new TransportManager(transportNoTyping);

      await expect(managerNoTyping.typing(ctx)).rejects.toThrow(
        'Transport does not support typing indicators'
      );
    });
  });

  describe('react', () => {
    it('should add reaction to message', async () => {
      await manager.react(ctx, 'msg-123', '👍');
      expect(mockTransport.react).toHaveBeenCalledWith(ctx, 'msg-123', '👍');
    });

    it('should throw error if transport does not support reactions', async () => {
      const transportNoReact: Transport<MockContext> = {
        ...mockTransport,
        react: undefined,
      };
      const managerNoReact = new TransportManager(transportNoReact);

      await expect(managerNoReact.react(ctx, 'msg-123', '👍')).rejects.toThrow(
        'Transport does not support reactions'
      );
    });
  });

  describe('parseContext', () => {
    it('should parse context to input', () => {
      const input = manager.parseContext(ctx);
      expect(input).toEqual({
        text: 'test message',
        userId: 'user-1',
        chatId: 'chat-123',
      });
      expect(mockTransport.parseContext).toHaveBeenCalledWith(ctx);
    });
  });

  describe('capability checks', () => {
    it('should report edit capability', () => {
      expect(manager.canEdit()).toBe(true);
      const managerNoEdit = new TransportManager({
        ...mockTransport,
        edit: undefined,
      });
      expect(managerNoEdit.canEdit()).toBe(false);
    });

    it('should report delete capability', () => {
      expect(manager.canDelete()).toBe(true);
      const managerNoDelete = new TransportManager({
        ...mockTransport,
        delete: undefined,
      });
      expect(managerNoDelete.canDelete()).toBe(false);
    });

    it('should report typing capability', () => {
      expect(manager.canTyping()).toBe(true);
      const managerNoTyping = new TransportManager({
        ...mockTransport,
        typing: undefined,
      });
      expect(managerNoTyping.canTyping()).toBe(false);
    });

    it('should report react capability', () => {
      expect(manager.canReact()).toBe(true);
      const managerNoReact = new TransportManager({
        ...mockTransport,
        react: undefined,
      });
      expect(managerNoReact.canReact()).toBe(false);
    });
  });

  describe('getTransport', () => {
    it('should return underlying transport', () => {
      expect(manager.getTransport()).toBe(mockTransport);
    });
  });

  describe('startThinkingRotation', () => {
    it('should start thinking rotation', async () => {
      const msgRef: MessageRef = 'thinking-msg-123';
      const heartbeatFn = vi.fn();

      // Use custom short rotation interval for testing
      const managerWithShortInterval = new TransportManager(mockTransport, {
        thinkingRotationInterval: 50, // 50ms for fast testing
      });

      const rotator = managerWithShortInterval.startThinkingRotation(ctx, msgRef, heartbeatFn);

      // Wait for first rotation
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Stop rotation
      rotator.stop();
      await rotator.waitForPending();

      expect(heartbeatFn).toHaveBeenCalled();
    });

    it('should handle missing edit capability gracefully', async () => {
      const transportNoEdit: Transport<MockContext> = {
        ...mockTransport,
        edit: undefined,
      };
      const managerNoEdit = new TransportManager(transportNoEdit, {
        thinkingRotationInterval: 50,
      });

      const msgRef: MessageRef = 'thinking-msg-123';
      const heartbeatFn = vi.fn();

      const rotator = managerNoEdit.startThinkingRotation(ctx, msgRef, heartbeatFn);

      // Wait for first rotation
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should not throw even though edit is not supported
      rotator.stop();
      await rotator.waitForPending();

      expect(heartbeatFn).toHaveBeenCalled();
    });
  });

  describe('startThinking', () => {
    it('should send initial thinking message and start rotation', async () => {
      const heartbeatFn = vi.fn();

      const managerWithShortInterval = new TransportManager(mockTransport, {
        thinkingRotationInterval: 50,
      });

      const { rotator, messageRef } = await managerWithShortInterval.startThinking(
        ctx,
        heartbeatFn
      );

      expect(messageRef).toBe('msg-123');
      expect(mockTransport.send).toHaveBeenCalled();

      // Wait for first rotation
      await new Promise((resolve) => setTimeout(resolve, 200));

      rotator.stop();
      await rotator.waitForPending();

      expect(heartbeatFn).toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should use custom thinking messages', () => {
      const customMessages = ['Custom 1', 'Custom 2'];
      const config = { thinkingMessages: customMessages };
      const managerWithConfig = new TransportManager(mockTransport, config);

      const msgRef: MessageRef = 'msg-123';
      const rotator = managerWithConfig.startThinkingRotation(ctx, msgRef);

      // Just verify it doesn't throw
      expect(rotator).toBeDefined();

      rotator.stop();
    });

    it('should use custom rotation interval', () => {
      const config = { thinkingRotationInterval: 1000 };
      const managerWithConfig = new TransportManager(mockTransport, config);

      const msgRef: MessageRef = 'msg-123';
      const rotator = managerWithConfig.startThinkingRotation(ctx, msgRef);

      // Just verify it doesn't throw
      expect(rotator).toBeDefined();

      rotator.stop();
    });
  });
});
