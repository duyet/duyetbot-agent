export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
	process.env.PLAYWRIGHT_TEST_BASE_URL ||
		process.env.PLAYWRIGHT ||
		process.env.CI_PLAYWRIGHT,
);

export const guestRegex = /^guest-\d+$/;

// Lazy load the dummy password to avoid WebCryptoAPI issues during wrangler upload
let _dummyPassword: string | undefined;
export const DUMMY_PASSWORD = () => {
	if (_dummyPassword === undefined) {
		_dummyPassword = "dummy-password-for-testing-only";
	}
	return _dummyPassword;
};
