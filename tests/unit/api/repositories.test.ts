import { RefreshTokenRepository } from '@/api/repositories/refresh-token';
import { UserRepository } from '@/api/repositories/user';
import type { RefreshToken, User } from '@/api/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock D1 Database
const createMockD1 = () => {
  const data = {
    users: [] as any[],
    refresh_tokens: [] as any[],
  };

  return {
    prepare: (sql: string) => {
      let boundValues: any[] = [];

      return {
        bind: (...values: any[]) => {
          boundValues = values;
          return {
            run: async () => {
              // INSERT for users
              if (sql.includes('INSERT INTO users')) {
                const [id, email, name, picture, provider, providerId, createdAt, updatedAt] =
                  boundValues;
                data.users.push({
                  id,
                  email,
                  name,
                  picture,
                  provider,
                  provider_id: providerId,
                  created_at: createdAt,
                  updated_at: updatedAt,
                  settings: null,
                });
              }
              // INSERT for refresh_tokens
              else if (sql.includes('INSERT INTO refresh_tokens')) {
                const [id, userId, token, expiresAt, createdAt] = boundValues;
                data.refresh_tokens.push({
                  id,
                  user_id: userId,
                  token,
                  expires_at: expiresAt,
                  created_at: createdAt,
                });
              }
              // UPDATE users
              else if (sql.includes('UPDATE users')) {
                const userId = boundValues[boundValues.length - 1];
                const userIndex = data.users.findIndex((u) => u.id === userId);
                if (userIndex >= 0) {
                  const user = data.users[userIndex];
                  // Parse which fields are being updated from SQL
                  let valueIndex = 0;
                  if (sql.includes('name =')) {
                    user.name = boundValues[valueIndex++];
                  }
                  if (sql.includes('picture =')) {
                    user.picture = boundValues[valueIndex++];
                  }
                  if (sql.includes('settings =')) {
                    user.settings = boundValues[valueIndex++];
                  }
                  // updated_at is always last before the WHERE userId
                  user.updated_at = boundValues[boundValues.length - 2];
                }
              }
              // DELETE
              else if (sql.includes('DELETE FROM users')) {
                const userId = boundValues[0];
                data.users = data.users.filter((u) => u.id !== userId);
              } else if (sql.includes('DELETE FROM refresh_tokens')) {
                if (sql.includes('WHERE token')) {
                  const token = boundValues[0];
                  data.refresh_tokens = data.refresh_tokens.filter((t) => t.token !== token);
                } else if (sql.includes('WHERE user_id')) {
                  const userId = boundValues[0];
                  data.refresh_tokens = data.refresh_tokens.filter((t) => t.user_id !== userId);
                } else if (sql.includes('WHERE expires_at')) {
                  const now = boundValues[0];
                  data.refresh_tokens = data.refresh_tokens.filter((t) => t.expires_at >= now);
                }
              }
            },
            first: async () => {
              // SELECT for users
              if (sql.includes('SELECT * FROM users')) {
                if (sql.includes('WHERE id')) {
                  return data.users.find((u) => u.id === boundValues[0]) || null;
                }
                if (sql.includes('WHERE email')) {
                  return data.users.find((u) => u.email === boundValues[0]) || null;
                }
                if (sql.includes('WHERE provider')) {
                  return (
                    data.users.find(
                      (u) => u.provider === boundValues[0] && u.provider_id === boundValues[1]
                    ) || null
                  );
                }
              }
              // SELECT for refresh_tokens
              else if (sql.includes('SELECT * FROM refresh_tokens')) {
                if (sql.includes('WHERE token')) {
                  return data.refresh_tokens.find((t) => t.token === boundValues[0]) || null;
                }
              }
              return null;
            },
            all: async () => {
              // SELECT all refresh_tokens for user
              if (sql.includes('SELECT * FROM refresh_tokens') && sql.includes('WHERE user_id')) {
                const userId = boundValues[0];
                return {
                  results: data.refresh_tokens.filter((t) => t.user_id === userId),
                };
              }
              return { results: [] };
            },
          };
        },
      };
    },
    _data: data, // For test access
  } as unknown as D1Database;
};

describe('UserRepository', () => {
  let db: D1Database;
  let repo: UserRepository;

  beforeEach(() => {
    db = createMockD1();
    repo = new UserRepository(db);
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const user = await repo.create({
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        provider: 'github',
        providerId: 'gh-123',
      });

      expect(user).toBeTruthy();
      expect(user.id).toBeTruthy();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.provider).toBe('github');
    });

    it('should generate unique IDs', async () => {
      const user1 = await repo.create({
        email: 'user1@example.com',
        name: 'User 1',
        picture: null,
        provider: 'github',
        providerId: 'gh-1',
      });

      const user2 = await repo.create({
        email: 'user2@example.com',
        name: 'User 2',
        picture: null,
        provider: 'github',
        providerId: 'gh-2',
      });

      expect(user1.id).not.toBe(user2.id);
    });

    it('should set timestamps', async () => {
      const before = Date.now();
      const user = await repo.create({
        email: 'test@example.com',
        name: 'Test',
        picture: null,
        provider: 'github',
        providerId: 'gh-123',
      });
      const after = Date.now();

      expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(after);
      expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(user.updatedAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const created = await repo.create({
        email: 'test@example.com',
        name: 'Test',
        picture: null,
        provider: 'github',
        providerId: 'gh-123',
      });

      const found = await repo.findById(created.id);

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.email).toBe(created.email);
    });

    it('should return null for non-existent user', async () => {
      const found = await repo.findById('non-existent');

      expect(found).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      await repo.create({
        email: 'test@example.com',
        name: 'Test',
        picture: null,
        provider: 'github',
        providerId: 'gh-123',
      });

      const found = await repo.findByEmail('test@example.com');

      expect(found).toBeTruthy();
      expect(found?.email).toBe('test@example.com');
    });

    it('should return null for non-existent email', async () => {
      const found = await repo.findByEmail('nonexistent@example.com');

      expect(found).toBeNull();
    });
  });

  describe('findByProvider', () => {
    it('should find user by provider and provider ID', async () => {
      await repo.create({
        email: 'test@example.com',
        name: 'Test',
        picture: null,
        provider: 'github',
        providerId: 'gh-123',
      });

      const found = await repo.findByProvider('github', 'gh-123');

      expect(found).toBeTruthy();
      expect(found?.provider).toBe('github');
      expect(found?.providerId).toBe('gh-123');
    });

    it('should return null for non-existent provider user', async () => {
      const found = await repo.findByProvider('github', 'non-existent');

      expect(found).toBeNull();
    });
  });

  describe('findOrCreate', () => {
    it('should create user if not exists', async () => {
      const user = await repo.findOrCreate('github', 'gh-123', {
        email: 'test@example.com',
        name: 'Test',
        picture: null,
      });

      expect(user).toBeTruthy();
      expect(user.provider).toBe('github');
      expect(user.providerId).toBe('gh-123');
    });

    it('should return existing user if profile unchanged', async () => {
      const created = await repo.create({
        email: 'test@example.com',
        name: 'Test Name',
        picture: null,
        provider: 'github',
        providerId: 'gh-123',
      });

      const found = await repo.findOrCreate('github', 'gh-123', {
        email: 'test@example.com',
        name: 'Test Name', // Same name
        picture: null,
      });

      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Test Name');
    });

    it('should update existing user if profile changed', async () => {
      const created = await repo.create({
        email: 'test@example.com',
        name: 'Original Name',
        picture: null,
        provider: 'github',
        providerId: 'gh-123',
      });

      const found = await repo.findOrCreate('github', 'gh-123', {
        email: 'test@example.com',
        name: 'Updated Name',
        picture: 'https://example.com/new.jpg',
      });

      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Updated Name');
      expect(found.picture).toBe('https://example.com/new.jpg');
    });
  });

  describe('update', () => {
    it('should update user fields', async () => {
      const user = await repo.create({
        email: 'test@example.com',
        name: 'Original',
        picture: null,
        provider: 'github',
        providerId: 'gh-123',
      });

      const updated = await repo.update(user.id, {
        name: 'Updated',
      });

      expect(updated.name).toBe('Updated');
      expect(updated.email).toBe(user.email); // Unchanged
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      const user = await repo.create({
        email: 'test@example.com',
        name: 'Test',
        picture: null,
        provider: 'github',
        providerId: 'gh-123',
      });

      await repo.delete(user.id);

      const found = await repo.findById(user.id);
      expect(found).toBeNull();
    });
  });
});

describe('RefreshTokenRepository', () => {
  let db: D1Database;
  let repo: RefreshTokenRepository;

  beforeEach(() => {
    db = createMockD1();
    repo = new RefreshTokenRepository(db);
  });

  describe('create', () => {
    it('should create a refresh token', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const token = await repo.create('user-123', 'refresh-token', expiresAt);

      expect(token).toBeTruthy();
      expect(token.id).toBeTruthy();
      expect(token.userId).toBe('user-123');
      expect(token.token).toBe('refresh-token');
      expect(token.expiresAt).toEqual(expiresAt);
    });

    it('should generate unique IDs', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const token1 = await repo.create('user-1', 'token-1', expiresAt);
      const token2 = await repo.create('user-2', 'token-2', expiresAt);

      expect(token1.id).not.toBe(token2.id);
    });
  });

  describe('findByToken', () => {
    it('should find token by token string', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await repo.create('user-123', 'my-token', expiresAt);

      const found = await repo.findByToken('my-token');

      expect(found).toBeTruthy();
      expect(found?.token).toBe('my-token');
      expect(found?.userId).toBe('user-123');
    });

    it('should return null for non-existent token', async () => {
      const found = await repo.findByToken('non-existent');

      expect(found).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find all tokens for user', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await repo.create('user-123', 'token-1', expiresAt);
      await repo.create('user-123', 'token-2', expiresAt);
      await repo.create('user-456', 'token-3', expiresAt);

      const tokens = await repo.findByUserId('user-123');

      expect(tokens).toHaveLength(2);
      expect(tokens.every((t) => t.userId === 'user-123')).toBe(true);
    });

    it('should return empty array for user with no tokens', async () => {
      const tokens = await repo.findByUserId('user-123');

      expect(tokens).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete token', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await repo.create('user-123', 'my-token', expiresAt);

      await repo.delete('my-token');

      const found = await repo.findByToken('my-token');
      expect(found).toBeNull();
    });
  });

  describe('deleteByUserId', () => {
    it('should delete all tokens for user', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await repo.create('user-123', 'token-1', expiresAt);
      await repo.create('user-123', 'token-2', expiresAt);

      await repo.deleteByUserId('user-123');

      const tokens = await repo.findByUserId('user-123');
      expect(tokens).toEqual([]);
    });
  });

  describe('isValid', () => {
    it('should return true for valid non-expired token', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await repo.create('user-123', 'my-token', expiresAt);

      const isValid = await repo.isValid('my-token');

      expect(isValid).toBe(true);
    });

    it('should return false for expired token', async () => {
      const expiresAt = new Date(Date.now() - 1000); // Expired
      await repo.create('user-123', 'my-token', expiresAt);

      const isValid = await repo.isValid('my-token');

      expect(isValid).toBe(false);
    });

    it('should return false for non-existent token', async () => {
      const isValid = await repo.isValid('non-existent');

      expect(isValid).toBe(false);
    });
  });
});
