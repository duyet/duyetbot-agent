/**
 * API Module
 *
 * Central API with authentication, user management, and agent endpoints
 */

// Router
export { createRouter, router } from './router';

// Types
export type * from './types';

// Auth utilities
export { generateAccessToken, generateRefreshToken, verifyToken } from './auth/jwt';
export { getGitHubAuthorizationUrl, completeGitHubOAuth } from './auth/github';
export { getGoogleAuthorizationUrl, completeGoogleOAuth } from './auth/google';

// Repositories
export { UserRepository } from './repositories/user';
export { RefreshTokenRepository } from './repositories/refresh-token';

// Middleware
export { authMiddleware, getUser, getOptionalUser } from './middleware/auth';
export { corsMiddleware } from './middleware/cors';
export { rateLimitMiddleware } from './middleware/rate-limit';

// Routes
export { createAuthRoutes } from './routes/auth';
export { createUserRoutes } from './routes/users';
export { createHealthRoutes } from './routes/health';
