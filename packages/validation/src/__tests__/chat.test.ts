/**
 * Tests for chat validation schemas
 */

import { describe, expect, it } from 'vitest';
import {
  branchRequestSchema,
  chatMessagePartSchema,
  chatSchema,
  chatVisibilitySchema,
  filePartSchema,
  messageRoleSchema,
  partSchema,
  postRequestBodySchema,
  updateVisibilitySchema,
  userMessageSchema,
} from '../chat/index.js';

describe('chatMessagePartSchema', () => {
  it('should accept valid text parts', () => {
    const valid = { type: 'text' as const, text: 'Hello, world!' };
    expect(chatMessagePartSchema.parse(valid)).toEqual(valid);
  });

  it('should reject empty text', () => {
    const invalid = { type: 'text' as const, text: '' };
    expect(() => chatMessagePartSchema.parse(invalid)).toThrow();
  });

  it('should reject text that is too long', () => {
    const invalid = { type: 'text' as const, text: 'a'.repeat(2001) };
    expect(() => chatMessagePartSchema.parse(invalid)).toThrow();
  });
});

describe('filePartSchema', () => {
  it('should accept valid file parts', () => {
    const valid = {
      type: 'file' as const,
      mediaType: 'image/png' as const,
      name: 'screenshot.png',
      url: 'https://example.com/file.png',
    };
    expect(filePartSchema.parse(valid)).toEqual(valid);
  });

  it('should reject invalid URLs', () => {
    const invalid = {
      type: 'file' as const,
      mediaType: 'image/png' as const,
      name: 'file.png',
      url: 'not-a-url',
    };
    expect(() => filePartSchema.parse(invalid)).toThrow();
  });
});

describe('partSchema', () => {
  it('should accept text parts', () => {
    const valid = { type: 'text' as const, text: 'Hello' };
    expect(partSchema.parse(valid)).toEqual(valid);
  });

  it('should accept file parts', () => {
    const valid = {
      type: 'file' as const,
      mediaType: 'application/pdf' as const,
      name: 'doc.pdf',
      url: 'https://example.com/doc.pdf',
    };
    expect(partSchema.parse(valid)).toEqual(valid);
  });
});

describe('messageRoleSchema', () => {
  it('should accept valid roles', () => {
    expect(messageRoleSchema.parse('user')).toBe('user');
    expect(messageRoleSchema.parse('assistant')).toBe('assistant');
    expect(messageRoleSchema.parse('system')).toBe('system');
    expect(messageRoleSchema.parse('tool')).toBe('tool');
  });

  it('should reject invalid roles', () => {
    expect(() => messageRoleSchema.parse('invalid')).toThrow();
  });
});

describe('userMessageSchema', () => {
  it('should accept valid user messages', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'Hello' }],
    };
    expect(userMessageSchema.parse(valid)).toEqual(valid);
  });

  it('should reject invalid UUIDs', () => {
    const invalid = {
      id: 'not-a-uuid',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'Hello' }],
    };
    expect(() => userMessageSchema.parse(invalid)).toThrow();
  });

  it('should reject empty parts', () => {
    const invalid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      role: 'user' as const,
      parts: [],
    };
    expect(() => userMessageSchema.parse(invalid)).toThrow();
  });
});

describe('chatVisibilitySchema', () => {
  it('should accept valid visibility values', () => {
    expect(chatVisibilitySchema.parse('public')).toBe('public');
    expect(chatVisibilitySchema.parse('private')).toBe('private');
  });

  it('should reject invalid visibility values', () => {
    expect(() => chatVisibilitySchema.parse('secret')).toThrow();
  });
});

describe('chatSchema', () => {
  it('should accept valid chat objects', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'My Chat',
      visibility: 'public' as const,
      userId: 'user-123',
      createdAt: new Date(),
    };
    const result = chatSchema.parse(valid);
    expect(result.id).toBe(valid.id);
    expect(result.title).toBe(valid.title);
  });

  it('should accept timestamp numbers for dates', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'My Chat',
      visibility: 'private' as const,
      userId: 'user-123',
      createdAt: Date.now(),
    };
    const result = chatSchema.parse(valid);
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});

describe('postRequestBodySchema', () => {
  it('should accept valid post request bodies', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      selectedChatModel: 'gpt-4',
      selectedVisibilityType: 'public' as const,
      message: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'Hello' }],
      },
    };
    const result = postRequestBodySchema.parse(valid);
    expect(result.id).toBe(valid.id);
    expect(result.selectedChatModel).toBe(valid.selectedChatModel);
  });

  it('should accept AI settings', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      selectedChatModel: 'gpt-4',
      selectedVisibilityType: 'private' as const,
      aiSettings: {
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9,
      },
      message: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'Hello' }],
      },
    };
    const result = postRequestBodySchema.parse(valid);
    expect(result.aiSettings?.temperature).toBe(0.7);
  });

  it('should validate temperature range', () => {
    const invalid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      selectedChatModel: 'gpt-4',
      selectedVisibilityType: 'public' as const,
      aiSettings: {
        temperature: 3.0, // out of range
      },
      message: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'Hello' }],
      },
    };
    expect(() => postRequestBodySchema.parse(invalid)).toThrow();
  });
});

describe('updateVisibilitySchema', () => {
  it('should accept valid visibility updates', () => {
    const valid = {
      chatId: '550e8400-e29b-41d4-a716-446655440000',
      visibility: 'private' as const,
    };
    const result = updateVisibilitySchema.parse(valid);
    expect(result.chatId).toBe(valid.chatId);
    expect(result.visibility).toBe(valid.visibility);
  });
});

describe('branchRequestSchema', () => {
  it('should accept valid branch requests', () => {
    const valid = {
      chatId: '550e8400-e29b-41d4-a716-446655440000',
      messageId: '550e8400-e29b-41d4-a716-446655440001',
    };
    const result = branchRequestSchema.parse(valid);
    expect(result.chatId).toBe(valid.chatId);
    expect(result.messageId).toBe(valid.messageId);
  });

  it('should accept branch requests without messageId', () => {
    const valid = {
      chatId: '550e8400-e29b-41d4-a716-446655440000',
    };
    const result = branchRequestSchema.parse(valid);
    expect(result.chatId).toBe(valid.chatId);
    expect(result.messageId).toBeUndefined();
  });
});
