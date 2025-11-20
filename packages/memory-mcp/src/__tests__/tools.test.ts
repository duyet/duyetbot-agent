import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticate } from '../tools/authenticate.js';
import { getMemory } from '../tools/get-memory.js';
import { saveMemory } from '../tools/save-memory.js';
import { searchMemory } from '../tools/search-memory.js';
import { listSessions } from '../tools/list-sessions.js';
import type { D1Storage } from '../storage/d1.js';
import type { KVStorage } from '../storage/kv.js';
import type { User, Session, LLMMessage } from '../types.js';

// Mock fetch for GitHub API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create mock storages
function createMockD1Storage() {
  const users = new Map<string, User>();
  const sessions = new Map<string, Session>();
  const tokens = new Map<string, { user_id: string; expires_at: number }>();

  return {
    getUser: vi.fn(async (id: string) => users.get(id) || null),
    getUserByGitHubId: vi.fn(async (id: string) => {
      for (const user of users.values()) {
        if (user.github_id === id) return user;
      }
      return null;
    }),
    createUser: vi.fn(async (user: User) => {
      users.set(user.id, user);
      return user;
    }),
    updateUser: vi.fn(),
    getSession: vi.fn(async (id: string) => sessions.get(id) || null),
    listSessions: vi.fn(async (userId: string, options?: any) => {
      const userSessions = Array.from(sessions.values())
        .filter(s => s.user_id === userId);
      return { sessions: userSessions, total: userSessions.length };
    }),
    createSession: vi.fn(async (session: Session) => {
      sessions.set(session.id, session);
      return session;
    }),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    getToken: vi.fn(async (token: string) => tokens.get(token) || null),
    createToken: vi.fn(async (token: any) => {
      tokens.set(token.token, token);
      return token;
    }),
    deleteToken: vi.fn(),
    deleteExpiredTokens: vi.fn(),
    _users: users,
    _sessions: sessions,
    _tokens: tokens,
  } as unknown as D1Storage & {
    _users: Map<string, User>;
    _sessions: Map<string, Session>;
    _tokens: Map<string, any>;
  };
}

function createMockKVStorage() {
  const messages = new Map<string, LLMMessage[]>();

  return {
    getMessages: vi.fn(async (sessionId: string) => messages.get(sessionId) || []),
    saveMessages: vi.fn(async (sessionId: string, msgs: LLMMessage[]) => {
      messages.set(sessionId, msgs);
      return msgs.length;
    }),
    appendMessages: vi.fn(),
    deleteMessages: vi.fn(),
    getMessageCount: vi.fn(async (sessionId: string) => {
      const msgs = messages.get(sessionId);
      return msgs ? msgs.length : 0;
    }),
    _messages: messages,
  } as unknown as KVStorage & { _messages: Map<string, LLMMessage[]> };
}

describe('authenticate tool', () => {
  let d1Storage: ReturnType<typeof createMockD1Storage>;

  beforeEach(() => {
    d1Storage = createMockD1Storage();
    mockFetch.mockReset();
  });

  it('should authenticate with valid GitHub token', async () => {
    const mockGitHubUser = {
      id: 12345,
      login: 'testuser',
      email: 'test@example.com',
      name: 'Test',
      avatar_url: 'https://github.com/avatar.png',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockGitHubUser,
    });

    const result = await authenticate({ github_token: 'valid_token' }, d1Storage);

    expect(result.user_id).toBeDefined();
    expect(result.session_token).toBeDefined();
    expect(result.expires_at).toBeGreaterThan(Date.now());
  });

  it('should reject missing token', async () => {
    await expect(authenticate({}, d1Storage)).rejects.toThrow(
      'Either github_token or oauth_code is required'
    );
  });

  it('should reject invalid GitHub token', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    await expect(
      authenticate({ github_token: 'invalid' }, d1Storage)
    ).rejects.toThrow('Invalid GitHub token');
  });

  it('should reject OAuth code (not implemented)', async () => {
    await expect(
      authenticate({ oauth_code: 'code' }, d1Storage)
    ).rejects.toThrow('OAuth code flow not yet implemented');
  });

  it('should update existing user', async () => {
    const existingUser: User = {
      id: 'user_existing',
      github_id: '12345',
      github_login: 'oldlogin',
      email: 'old@example.com',
      name: 'Old Name',
      avatar_url: 'https://old.png',
      created_at: Date.now() - 100000,
      updated_at: Date.now() - 100000,
    };
    d1Storage._users.set(existingUser.id, existingUser);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 12345,
        login: 'newlogin',
        email: 'new@example.com',
        name: 'New Name',
        avatar_url: 'https://new.png',
      }),
    });

    const result = await authenticate({ github_token: 'token' }, d1Storage);
    expect(result.user_id).toBe('user_existing');
    expect(d1Storage.updateUser).toHaveBeenCalled();
  });
});

describe('getMemory tool', () => {
  let d1Storage: ReturnType<typeof createMockD1Storage>;
  let kvStorage: ReturnType<typeof createMockKVStorage>;

  beforeEach(() => {
    d1Storage = createMockD1Storage();
    kvStorage = createMockKVStorage();
  });

  it('should return empty memory for non-existent session', async () => {
    const result = await getMemory(
      { session_id: 'nonexistent' },
      d1Storage,
      kvStorage,
      'user_123'
    );

    expect(result.messages).toEqual([]);
    expect(result.metadata).toEqual({});
  });

  it('should return session memory', async () => {
    const session: Session = {
      id: 'sess_123',
      user_id: 'user_123',
      title: 'Test',
      state: 'active',
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: { key: 'value' },
    };
    d1Storage._sessions.set(session.id, session);

    const messages: LLMMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];
    kvStorage._messages.set('sess_123', messages);

    const result = await getMemory(
      { session_id: 'sess_123' },
      d1Storage,
      kvStorage,
      'user_123'
    );

    expect(result.messages).toEqual(messages);
    expect(result.metadata).toEqual({ key: 'value' });
  });

  it('should reject unauthorized access', async () => {
    const session: Session = {
      id: 'sess_123',
      user_id: 'other_user',
      title: 'Test',
      state: 'active',
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: null,
    };
    d1Storage._sessions.set(session.id, session);

    await expect(
      getMemory({ session_id: 'sess_123' }, d1Storage, kvStorage, 'user_123')
    ).rejects.toThrow('Unauthorized');
  });

  it('should apply limit and offset', async () => {
    const session: Session = {
      id: 'sess_123',
      user_id: 'user_123',
      title: 'Test',
      state: 'active',
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: null,
    };
    d1Storage._sessions.set(session.id, session);

    const messages: LLMMessage[] = [
      { role: 'user', content: 'Message 1' },
      { role: 'assistant', content: 'Message 2' },
      { role: 'user', content: 'Message 3' },
      { role: 'assistant', content: 'Message 4' },
    ];
    kvStorage._messages.set('sess_123', messages);

    const result = await getMemory(
      { session_id: 'sess_123', limit: 2, offset: 1 },
      d1Storage,
      kvStorage,
      'user_123'
    );

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].content).toBe('Message 2');
  });
});

describe('saveMemory tool', () => {
  let d1Storage: ReturnType<typeof createMockD1Storage>;
  let kvStorage: ReturnType<typeof createMockKVStorage>;

  beforeEach(() => {
    d1Storage = createMockD1Storage();
    kvStorage = createMockKVStorage();
  });

  it('should create new session and save messages', async () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];

    const result = await saveMemory(
      { messages },
      d1Storage,
      kvStorage,
      'user_123'
    );

    expect(result.session_id).toBeDefined();
    expect(result.saved_count).toBe(2);
    expect(d1Storage.createSession).toHaveBeenCalled();
    expect(kvStorage.saveMessages).toHaveBeenCalled();
  });

  it('should update existing session', async () => {
    const session: Session = {
      id: 'sess_123',
      user_id: 'user_123',
      title: 'Test',
      state: 'active',
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: null,
    };
    d1Storage._sessions.set(session.id, session);

    const messages: LLMMessage[] = [{ role: 'user', content: 'Updated' }];

    const result = await saveMemory(
      { session_id: 'sess_123', messages },
      d1Storage,
      kvStorage,
      'user_123'
    );

    expect(result.session_id).toBe('sess_123');
    expect(d1Storage.updateSession).toHaveBeenCalled();
  });

  it('should reject unauthorized session update', async () => {
    const session: Session = {
      id: 'sess_123',
      user_id: 'other_user',
      title: 'Test',
      state: 'active',
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: null,
    };
    d1Storage._sessions.set(session.id, session);

    await expect(
      saveMemory(
        { session_id: 'sess_123', messages: [{ role: 'user', content: 'Test' }] },
        d1Storage,
        kvStorage,
        'user_123'
      )
    ).rejects.toThrow('Unauthorized');
  });

  it('should generate title from first user message', async () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'This is my question about TypeScript' },
    ];

    await saveMemory({ messages }, d1Storage, kvStorage, 'user_123');

    const createCall = (d1Storage.createSession as any).mock.calls[0][0];
    expect(createCall.title).toBe('This is my question about TypeScript');
  });

  it('should add timestamps to messages', async () => {
    const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

    await saveMemory({ messages }, d1Storage, kvStorage, 'user_123');

    const saveCall = (kvStorage.saveMessages as any).mock.calls[0][1];
    expect(saveCall[0].timestamp).toBeDefined();
  });
});

describe('searchMemory tool', () => {
  let d1Storage: ReturnType<typeof createMockD1Storage>;
  let kvStorage: ReturnType<typeof createMockKVStorage>;

  beforeEach(() => {
    d1Storage = createMockD1Storage();
    kvStorage = createMockKVStorage();
  });

  it('should search across user sessions', async () => {
    const session: Session = {
      id: 'sess_123',
      user_id: 'user_123',
      title: 'Test',
      state: 'active',
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: null,
    };
    d1Storage._sessions.set(session.id, session);

    const messages: LLMMessage[] = [
      { role: 'user', content: 'Hello TypeScript' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    kvStorage._messages.set('sess_123', messages);

    const result = await searchMemory(
      { query: 'TypeScript' },
      d1Storage,
      kvStorage,
      'user_123'
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0].message.content).toContain('TypeScript');
  });

  it('should return empty results for no matches', async () => {
    const session: Session = {
      id: 'sess_123',
      user_id: 'user_123',
      title: 'Test',
      state: 'active',
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: null,
    };
    d1Storage._sessions.set(session.id, session);

    kvStorage._messages.set('sess_123', [
      { role: 'user', content: 'Hello' },
    ]);

    const result = await searchMemory(
      { query: 'Python' },
      d1Storage,
      kvStorage,
      'user_123'
    );

    expect(result.results).toHaveLength(0);
  });

  it('should filter by session_id', async () => {
    const session1: Session = {
      id: 'sess_1',
      user_id: 'user_123',
      title: 'Test 1',
      state: 'active',
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: null,
    };
    const session2: Session = {
      id: 'sess_2',
      user_id: 'user_123',
      title: 'Test 2',
      state: 'active',
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: null,
    };
    d1Storage._sessions.set(session1.id, session1);
    d1Storage._sessions.set(session2.id, session2);

    kvStorage._messages.set('sess_1', [{ role: 'user', content: 'Search term here' }]);
    kvStorage._messages.set('sess_2', [{ role: 'user', content: 'Search term here' }]);

    const result = await searchMemory(
      { query: 'Search', filter: { session_id: 'sess_1' } },
      d1Storage,
      kvStorage,
      'user_123'
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0].session_id).toBe('sess_1');
  });

  it('should respect limit', async () => {
    const session: Session = {
      id: 'sess_123',
      user_id: 'user_123',
      title: 'Test',
      state: 'active',
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: null,
    };
    d1Storage._sessions.set(session.id, session);

    kvStorage._messages.set('sess_123', [
      { role: 'user', content: 'Match 1' },
      { role: 'user', content: 'Match 2' },
      { role: 'user', content: 'Match 3' },
    ]);

    const result = await searchMemory(
      { query: 'Match', limit: 2 },
      d1Storage,
      kvStorage,
      'user_123'
    );

    expect(result.results).toHaveLength(2);
  });
});

describe('listSessions tool', () => {
  let d1Storage: ReturnType<typeof createMockD1Storage>;
  let kvStorage: ReturnType<typeof createMockKVStorage>;

  beforeEach(() => {
    d1Storage = createMockD1Storage();
    kvStorage = createMockKVStorage();
  });

  it('should list user sessions with message counts', async () => {
    const session: Session = {
      id: 'sess_123',
      user_id: 'user_123',
      title: 'Test Session',
      state: 'active',
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: null,
    };
    d1Storage._sessions.set(session.id, session);
    kvStorage._messages.set('sess_123', [
      { role: 'user', content: 'Test' },
      { role: 'assistant', content: 'Response' },
    ]);

    const result = await listSessions({}, d1Storage, kvStorage, 'user_123');

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].id).toBe('sess_123');
    expect(result.sessions[0].message_count).toBe(2);
    expect(result.total).toBe(1);
  });

  it('should return empty list for user with no sessions', async () => {
    const result = await listSessions({}, d1Storage, kvStorage, 'user_123');
    expect(result.sessions).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
