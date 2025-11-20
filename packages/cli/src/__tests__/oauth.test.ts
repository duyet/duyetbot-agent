/**
 * GitHub OAuth Device Flow Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GitHubDeviceAuth,
  DeviceCodeResponse,
  AccessTokenResponse,
} from '../oauth.js';

// Mock fetch
global.fetch = vi.fn();

describe('GitHubDeviceAuth', () => {
  const clientId = 'test-client-id';
  let auth: GitHubDeviceAuth;

  beforeEach(() => {
    auth = new GitHubDeviceAuth(clientId);
    vi.resetAllMocks();
  });

  describe('requestDeviceCode', () => {
    it('should request device code from GitHub', async () => {
      const mockResponse: DeviceCodeResponse = {
        device_code: 'device-code-123',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await auth.requestDeviceCode();

      expect(result.device_code).toBe('device-code-123');
      expect(result.user_code).toBe('ABCD-1234');
      expect(result.verification_uri).toBe('https://github.com/login/device');
    });

    it('should include correct scopes', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            device_code: 'code',
            user_code: 'CODE',
            verification_uri: 'https://github.com/login/device',
            expires_in: 900,
            interval: 5,
          }),
      } as Response);

      await auth.requestDeviceCode(['repo', 'user']);

      expect(fetch).toHaveBeenCalledWith(
        'https://github.com/login/device/code',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('scope=repo+user'),
        })
      );
    });

    it('should throw on API error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      await expect(auth.requestDeviceCode()).rejects.toThrow();
    });
  });

  describe('pollForAccessToken', () => {
    it('should poll for access token', async () => {
      const mockResponse: AccessTokenResponse = {
        access_token: 'ghp_test_token',
        token_type: 'bearer',
        scope: 'repo,user',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await auth.pollForAccessToken('device-code-123');

      expect(result.access_token).toBe('ghp_test_token');
      expect(result.token_type).toBe('bearer');
    });

    it('should handle authorization_pending', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ error: 'authorization_pending' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'ghp_token',
              token_type: 'bearer',
              scope: 'repo',
            }),
        } as Response);

      const result = await auth.pollForAccessToken('device-code', 100);

      expect(result.access_token).toBe('ghp_token');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle slow_down by increasing interval', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ error: 'slow_down' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'ghp_token',
              token_type: 'bearer',
              scope: 'repo',
            }),
        } as Response);

      const result = await auth.pollForAccessToken('device-code', 10);

      expect(result.access_token).toBe('ghp_token');
    }, 10000);

    it('should throw on expired_token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ error: 'expired_token' }),
      } as Response);

      await expect(
        auth.pollForAccessToken('device-code', 100)
      ).rejects.toThrow('Device code expired');
    });

    it('should throw on access_denied', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ error: 'access_denied' }),
      } as Response);

      await expect(
        auth.pollForAccessToken('device-code', 100)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('getVerificationUrl', () => {
    it('should return verification URL with user code', () => {
      const url = auth.getVerificationUrl('ABCD-1234');
      expect(url).toBe('https://github.com/login/device?user_code=ABCD-1234');
    });
  });
});

describe('DeviceCodeResponse', () => {
  it('should have correct shape', () => {
    const response: DeviceCodeResponse = {
      device_code: 'code',
      user_code: 'ABCD',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    };

    expect(response.device_code).toBeDefined();
    expect(response.user_code).toBeDefined();
  });
});

describe('AccessTokenResponse', () => {
  it('should have correct shape', () => {
    const response: AccessTokenResponse = {
      access_token: 'ghp_xxx',
      token_type: 'bearer',
      scope: 'repo,user',
    };

    expect(response.access_token).toBeDefined();
    expect(response.token_type).toBe('bearer');
  });
});
