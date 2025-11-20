/**
 * GitHub OAuth Device Flow
 *
 * Implements GitHub's device authorization flow for CLI authentication
 */

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface ErrorResponse {
  error: string;
  error_description?: string;
}

/**
 * GitHub Device Authorization Flow handler
 */
export class GitHubDeviceAuth {
  private clientId: string;
  private baseUrl = 'https://github.com';

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  /**
   * Request a device code from GitHub
   */
  async requestDeviceCode(scopes: string[] = ['repo', 'user']): Promise<DeviceCodeResponse> {
    const response = await fetch(`${this.baseUrl}/login/device/code`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `client_id=${this.clientId}&scope=${scopes.join('+')}`,
    });

    if (!response.ok) {
      throw new Error(`Failed to request device code: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<DeviceCodeResponse>;
  }

  /**
   * Poll for access token after user authorization
   */
  async pollForAccessToken(
    deviceCode: string,
    intervalMs: number = 5000,
    maxAttempts: number = 60
  ): Promise<AccessTokenResponse> {
    let attempts = 0;
    let currentInterval = intervalMs;

    while (attempts < maxAttempts) {
      const response = await fetch(`${this.baseUrl}/login/oauth/access_token`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `client_id=${this.clientId}&device_code=${deviceCode}&grant_type=urn:ietf:params:oauth:grant-type:device_code`,
      });

      if (!response.ok) {
        throw new Error(`Failed to poll for token: ${response.status}`);
      }

      const data = (await response.json()) as AccessTokenResponse | ErrorResponse;

      // Check if we got an access token
      if ('access_token' in data) {
        return data;
      }

      // Handle error responses
      const errorData = data as ErrorResponse;
      switch (errorData.error) {
        case 'authorization_pending':
          // User hasn't authorized yet, continue polling
          await this.sleep(currentInterval);
          attempts++;
          continue;

        case 'slow_down':
          // Increase polling interval
          currentInterval += 5000;
          await this.sleep(currentInterval);
          attempts++;
          continue;

        case 'expired_token':
          throw new Error('Device code expired. Please restart the login process.');

        case 'access_denied':
          throw new Error('Access denied. User cancelled authorization.');

        default:
          throw new Error(`OAuth error: ${errorData.error} - ${errorData.error_description || 'Unknown error'}`);
      }
    }

    throw new Error('Polling timeout. Please try again.');
  }

  /**
   * Get verification URL with user code pre-filled
   */
  getVerificationUrl(userCode: string): string {
    return `${this.baseUrl}/login/device?user_code=${userCode}`;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Start GitHub device flow login
 */
export async function startDeviceLogin(
  clientId: string,
  onUserCode: (code: string, url: string) => void,
  scopes: string[] = ['repo', 'user']
): Promise<string> {
  const auth = new GitHubDeviceAuth(clientId);

  // Request device code
  const deviceCode = await auth.requestDeviceCode(scopes);

  // Notify user of code
  const verificationUrl = auth.getVerificationUrl(deviceCode.user_code);
  onUserCode(deviceCode.user_code, verificationUrl);

  // Poll for access token
  const tokenResponse = await auth.pollForAccessToken(
    deviceCode.device_code,
    deviceCode.interval * 1000
  );

  return tokenResponse.access_token;
}
