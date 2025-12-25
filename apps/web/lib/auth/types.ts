/**
 * Request body for user login and registration
 */
export interface LoginRequestBody {
  email: string;
  password: string;
}

/**
 * Session response from API
 */
export interface SessionResponse {
  user: {
    id: string;
    email: string;
  };
}
