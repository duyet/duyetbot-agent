/**
 * CLI Authentication
 *
 * OAuth device flow for CLI authentication
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Device code response
 */
interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

/**
 * Token response
 */
interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Stored credentials
 */
interface StoredCredentials {
  accessToken: string;
  refreshToken: string;
  apiUrl: string;
}

/**
 * Get config directory path
 */
export function getConfigDir(): string {
  return path.join(os.homedir(), '.duyetbot');
}

/**
 * Get credentials file path
 */
export function getCredentialsPath(): string {
  return path.join(getConfigDir(), 'credentials.json');
}

/**
 * Load stored credentials
 */
export async function loadCredentials(): Promise<StoredCredentials | null> {
  try {
    const data = await fs.readFile(getCredentialsPath(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Save credentials
 */
export async function saveCredentials(credentials: StoredCredentials): Promise<void> {
  const configDir = getConfigDir();

  // Ensure directory exists
  await fs.mkdir(configDir, { recursive: true });

  // Write credentials with restricted permissions (600)
  await fs.writeFile(getCredentialsPath(), JSON.stringify(credentials, null, 2), { mode: 0o600 });
}

/**
 * Delete stored credentials
 */
export async function deleteCredentials(): Promise<void> {
  try {
    await fs.unlink(getCredentialsPath());
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Start device authorization flow
 */
export async function startDeviceFlow(apiUrl: string): Promise<DeviceCodeResponse> {
  const response = await fetch(`${apiUrl}/auth/device`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to start device flow');
  }

  const data = await response.json();
  return data.data as DeviceCodeResponse;
}

/**
 * Poll for device authorization
 */
export async function pollDeviceAuthorization(
  apiUrl: string,
  deviceCode: string,
  _interval = 5
): Promise<TokenResponse | null> {
  const response = await fetch(`${apiUrl}/auth/device/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deviceCode }),
  });

  if (response.status === 428) {
    // Authorization pending, continue polling
    return null;
  }

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Authorization failed');
  }

  const data = await response.json();
  return data.data as TokenResponse;
}

/**
 * Wait for device authorization
 */
export async function waitForAuthorization(
  apiUrl: string,
  deviceCode: string,
  expiresIn: number,
  interval = 5,
  onPoll?: () => void
): Promise<TokenResponse> {
  const startTime = Date.now();
  const expiryTime = startTime + expiresIn * 1000;

  while (Date.now() < expiryTime) {
    const token = await pollDeviceAuthorization(apiUrl, deviceCode, interval);

    if (token) {
      return token;
    }

    // Call progress callback
    if (onPoll) {
      onPoll();
    }

    // Wait for interval before next poll
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
  }

  throw new Error('Device authorization expired');
}

/**
 * Perform OAuth device flow
 */
export async function deviceFlowLogin(
  apiUrl: string,
  onProgress?: (message: string) => void
): Promise<StoredCredentials> {
  // Start device flow
  onProgress?.('Starting authentication...');
  const deviceAuth = await startDeviceFlow(apiUrl);

  // Show user instructions
  onProgress?.(
    `\nPlease visit: ${deviceAuth.verificationUri}\nAnd enter code: ${deviceAuth.userCode}\n`
  );

  // Wait for authorization
  let dots = 0;
  const token = await waitForAuthorization(
    apiUrl,
    deviceAuth.deviceCode,
    deviceAuth.expiresIn,
    deviceAuth.interval,
    () => {
      dots = (dots + 1) % 4;
      onProgress?.(`Waiting for authorization${'.'.repeat(dots)}`);
    }
  );

  // Save credentials
  const credentials: StoredCredentials = {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    apiUrl,
  };

  await saveCredentials(credentials);

  onProgress?.('\n✓ Authentication successful!');

  return credentials;
}

/**
 * Refresh access token
 */
export async function refreshToken(apiUrl: string, refreshToken: string): Promise<string> {
  const response = await fetch(`${apiUrl}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const data = await response.json();
  return data.data.accessToken;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const credentials = await loadCredentials();
  return credentials !== null;
}
