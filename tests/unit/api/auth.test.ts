import { generateAccessToken, generateRefreshToken, verifyToken } from '@/api/auth/jwt';
import type { User } from '@/api/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('JWT Authentication', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
    provider: 'github',
    providerId: 'gh-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const testSecret = 'test-secret-key-for-jwt-signing';

  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', async () => {
      const token = await generateAccessToken(mockUser, testSecret);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include user claims in token', async () => {
      const token = await generateAccessToken(mockUser, testSecret);
      const claims = await verifyToken(token, testSecret);

      expect(claims.sub).toBe(mockUser.id);
      expect(claims.email).toBe(mockUser.email);
      expect(claims.name).toBe(mockUser.name);
      expect(claims.picture).toBe(mockUser.picture);
      expect(claims.provider).toBe(mockUser.provider);
    });

    it('should set correct expiration time (1 hour)', async () => {
      const token = await generateAccessToken(mockUser, testSecret);
      const claims = await verifyToken(token, testSecret);

      expect(claims.exp).toBeTruthy();
      expect(claims.iat).toBeTruthy();

      // Should expire in approximately 1 hour (3600 seconds)
      const expiresIn = claims.exp - claims.iat;
      expect(expiresIn).toBeGreaterThanOrEqual(3599);
      expect(expiresIn).toBeLessThanOrEqual(3601);
    });

    it('should generate different tokens for the same user', async () => {
      const token1 = await generateAccessToken(mockUser, testSecret);
      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));
      const token2 = await generateAccessToken(mockUser, testSecret);

      expect(token1).not.toBe(token2);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a random refresh token', async () => {
      const token = await generateRefreshToken();

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);
    });

    it('should generate different tokens each time', async () => {
      const token1 = await generateRefreshToken();
      const token2 = await generateRefreshToken();

      expect(token1).not.toBe(token2);
    });

    it('should generate tokens with high entropy', async () => {
      const tokens = await Promise.all(Array.from({ length: 100 }, () => generateRefreshToken()));

      // All tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(100);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const token = await generateAccessToken(mockUser, testSecret);
      const claims = await verifyToken(token, testSecret);

      expect(claims).toBeTruthy();
      expect(claims.sub).toBe(mockUser.id);
    });

    it('should reject token with wrong secret', async () => {
      const token = await generateAccessToken(mockUser, testSecret);

      await expect(verifyToken(token, 'wrong-secret')).rejects.toThrow();
    });

    it('should reject malformed token', async () => {
      await expect(verifyToken('not-a-jwt', testSecret)).rejects.toThrow();
    });

    it('should reject token with invalid structure', async () => {
      await expect(verifyToken('a.b', testSecret)).rejects.toThrow();
    });

    it('should reject empty token', async () => {
      await expect(verifyToken('', testSecret)).rejects.toThrow();
    });

    // Note: Testing expired tokens requires mocking time or waiting,
    // which is impractical in unit tests. Integration tests should cover this.
  });

  describe('Token Security', () => {
    it('should not expose secret in token', async () => {
      const token = await generateAccessToken(mockUser, testSecret);

      expect(token).not.toContain(testSecret);
    });

    it('should use HS256 algorithm', async () => {
      const token = await generateAccessToken(mockUser, testSecret);
      const [header] = token.split('.');
      if (!header) {
        throw new Error('Token header is missing');
      }
      const decodedHeader = JSON.parse(atob(header));

      expect(decodedHeader.alg).toBe('HS256');
    });

    it('should include standard JWT claims', async () => {
      const token = await generateAccessToken(mockUser, testSecret);
      const claims = await verifyToken(token, testSecret);

      expect(claims.iat).toBeTruthy(); // Issued at
      expect(claims.exp).toBeTruthy(); // Expires at
      expect(claims.sub).toBeTruthy(); // Subject (user ID)
    });
  });
});
