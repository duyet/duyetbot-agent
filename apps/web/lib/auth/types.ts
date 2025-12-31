/**
 * Request body for user login and registration
 */
export type LoginRequestBody = {
	email: string;
	password: string;
};

/**
 * Session response from API
 */
export type SessionResponse = {
	user: {
		id: string;
		email: string;
	};
};
