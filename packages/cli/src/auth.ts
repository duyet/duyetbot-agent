/**
 * CLI Authentication
 *
 * Manages authentication state and credentials
 */

export interface AuthUser {
  id: string;
  login: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export interface AuthCredentials {
  githubToken: string;
  sessionToken: string;
  expiresAt?: number;
  user?: AuthUser;
}

export interface AuthState {
  isAuthenticated: boolean;
  user?: AuthUser;
  expiresAt?: number;
}

/**
 * Manages CLI authentication
 */
export class AuthManager {
  private githubToken: string | undefined;
  private sessionToken: string | undefined;
  private expiresAt: number | undefined;
  private user: AuthUser | undefined;

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    const state: AuthState = {
      isAuthenticated: !!this.githubToken && !!this.sessionToken,
    };
    if (this.user) {
      state.user = this.user;
    }
    if (this.expiresAt !== undefined) {
      state.expiresAt = this.expiresAt;
    }
    return state;
  }

  /**
   * Set authentication credentials
   */
  setAuth(credentials: AuthCredentials): void {
    this.githubToken = credentials.githubToken;
    this.sessionToken = credentials.sessionToken;
    if (credentials.expiresAt !== undefined) {
      this.expiresAt = credentials.expiresAt;
    }
    if (credentials.user) {
      this.user = credentials.user;
    }
  }

  /**
   * Clear all authentication data
   */
  clearAuth(): void {
    this.githubToken = undefined;
    this.sessionToken = undefined;
    this.expiresAt = undefined;
    this.user = undefined;
  }

  /**
   * Get GitHub token
   */
  getGitHubToken(): string | undefined {
    return this.githubToken;
  }

  /**
   * Get session token
   */
  getSessionToken(): string | undefined {
    return this.sessionToken;
  }

  /**
   * Get current user
   */
  getUser(): AuthUser | undefined {
    return this.user;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }
    return Date.now() > this.expiresAt;
  }

  /**
   * Check if authenticated and not expired
   */
  isValid(): boolean {
    return this.getAuthState().isAuthenticated && !this.isTokenExpired();
  }
}
