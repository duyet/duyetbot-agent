import { describe, expect, it } from "vitest";
import {
	ChatSDKError,
	type ErrorCode,
	type ErrorType,
	type ErrorVisibility,
	getMessageByErrorCode,
	type Surface,
	visibilityBySurface,
} from "./errors";

describe("errors", () => {
	describe("visibilityBySurface", () => {
		it("should have visibility for all surfaces", () => {
			const surfaces: Surface[] = [
				"chat",
				"auth",
				"api",
				"stream",
				"database",
				"history",
				"vote",
				"document",
				"suggestions",
				"activate_gateway",
			];

			for (const surface of surfaces) {
				expect(visibilityBySurface[surface]).toBeDefined();
			}
		});

		it("should mark database errors as log-only", () => {
			expect(visibilityBySurface.database).toBe("log");
		});

		it("should mark user-facing surfaces as response", () => {
			const responseSurfaces: Surface[] = [
				"chat",
				"auth",
				"api",
				"stream",
				"history",
				"vote",
				"document",
				"suggestions",
				"activate_gateway",
			];

			for (const surface of responseSurfaces) {
				expect(visibilityBySurface[surface]).toBe("response");
			}
		});
	});

	describe("getMessageByErrorCode", () => {
		it("should return database error message for database surface", () => {
			const codes: ErrorCode[] = [
				"bad_request:database",
				"unauthorized:database",
				"forbidden:database",
				"not_found:database",
				"rate_limit:database",
			];

			for (const code of codes) {
				expect(getMessageByErrorCode(code)).toBe(
					"An error occurred while executing a database query.",
				);
			}
		});

		it("should return specific message for bad_request:api", () => {
			expect(getMessageByErrorCode("bad_request:api")).toBe(
				"The request couldn't be processed. Please check your input and try again.",
			);
		});

		it("should return gateway message for bad_request:activate_gateway", () => {
			const message = getMessageByErrorCode("bad_request:activate_gateway");
			expect(message).toContain("AI Gateway");
			expect(message).toContain("credit card");
		});

		it("should return auth messages correctly", () => {
			expect(getMessageByErrorCode("unauthorized:auth")).toBe(
				"You need to sign in before continuing.",
			);
			expect(getMessageByErrorCode("forbidden:auth")).toBe(
				"Your account does not have access to this feature.",
			);
		});

		it("should return chat error messages correctly", () => {
			expect(getMessageByErrorCode("rate_limit:chat")).toContain(
				"exceeded your maximum number of messages",
			);
			expect(getMessageByErrorCode("not_found:chat")).toContain(
				"chat was not found",
			);
			expect(getMessageByErrorCode("forbidden:chat")).toContain(
				"belongs to another user",
			);
			expect(getMessageByErrorCode("unauthorized:chat")).toContain(
				"need to sign in",
			);
			expect(getMessageByErrorCode("offline:chat")).toContain(
				"internet connection",
			);
		});

		it("should return document error messages correctly", () => {
			expect(getMessageByErrorCode("not_found:document")).toContain(
				"document was not found",
			);
			expect(getMessageByErrorCode("forbidden:document")).toContain(
				"belongs to another user",
			);
			expect(getMessageByErrorCode("unauthorized:document")).toContain(
				"need to sign in",
			);
			expect(getMessageByErrorCode("bad_request:document")).toContain(
				"create or update the document was invalid",
			);
		});

		it("should return fallback message for unknown error codes", () => {
			// Cast to ErrorCode to test fallback behavior
			const unknownCode = "unknown:stream" as ErrorCode;
			expect(getMessageByErrorCode(unknownCode)).toBe(
				"Something went wrong. Please try again later.",
			);
		});
	});

	describe("ChatSDKError", () => {
		it("should parse error code into type and surface", () => {
			const error = new ChatSDKError("not_found:chat");

			expect(error.type).toBe("not_found");
			expect(error.surface).toBe("chat");
		});

		it("should set appropriate status codes for each error type", () => {
			const testCases: Array<{ code: ErrorCode; expectedStatus: number }> = [
				{ code: "bad_request:api", expectedStatus: 400 },
				{ code: "unauthorized:auth", expectedStatus: 401 },
				{ code: "forbidden:chat", expectedStatus: 403 },
				{ code: "not_found:document", expectedStatus: 404 },
				{ code: "rate_limit:chat", expectedStatus: 429 },
				{ code: "offline:chat", expectedStatus: 503 },
			];

			for (const { code, expectedStatus } of testCases) {
				const error = new ChatSDKError(code);
				expect(error.statusCode).toBe(expectedStatus);
			}
		});

		it("should set message from getMessageByErrorCode", () => {
			const error = new ChatSDKError("rate_limit:chat");
			expect(error.message).toContain("exceeded your maximum number");
		});

		it("should preserve cause if provided", () => {
			const error = new ChatSDKError("bad_request:api", "Invalid JSON payload");
			expect(error.cause).toBe("Invalid JSON payload");
		});

		it("should be an instance of Error", () => {
			const error = new ChatSDKError("not_found:chat");
			expect(error).toBeInstanceOf(Error);
		});

		describe("toResponse", () => {
			it("should return Response with correct status code", async () => {
				const error = new ChatSDKError("not_found:chat");
				const response = error.toResponse();

				expect(response).toBeInstanceOf(Response);
				expect(response.status).toBe(404);
			});

			it("should return JSON content type", async () => {
				const error = new ChatSDKError("bad_request:api");
				const response = error.toResponse();

				expect(response.headers.get("Content-Type")).toBe("application/json");
			});

			it("should include error details in response body for response visibility", async () => {
				const error = new ChatSDKError("unauthorized:auth", "Token expired");
				const response = error.toResponse();
				const body = (await response.json()) as {
					code: string;
					message: string;
					cause?: string;
				};

				expect(body.code).toBe("unauthorized:auth");
				expect(body.message).toBe("You need to sign in before continuing.");
				expect(body.cause).toBe("Token expired");
			});

			it("should hide details for log-only visibility (database errors)", async () => {
				const error = new ChatSDKError(
					"not_found:database",
					"Row not found in users table",
				);
				const response = error.toResponse();
				const body = (await response.json()) as {
					code: string;
					message: string;
					cause?: string;
				};

				expect(body.code).toBe("");
				expect(body.message).toBe(
					"Something went wrong. Please try again later.",
				);
				expect(body.cause).toBeUndefined();
			});
		});
	});

	describe("type safety", () => {
		it("ErrorType should include all expected types", () => {
			const types: ErrorType[] = [
				"bad_request",
				"unauthorized",
				"forbidden",
				"not_found",
				"rate_limit",
				"offline",
			];

			// This test mainly ensures TypeScript compilation succeeds
			expect(types.length).toBe(6);
		});

		it("Surface should include all expected surfaces", () => {
			const surfaces: Surface[] = [
				"chat",
				"auth",
				"api",
				"stream",
				"database",
				"history",
				"vote",
				"document",
				"suggestions",
				"activate_gateway",
			];

			expect(surfaces.length).toBe(10);
		});

		it("ErrorVisibility should include all expected values", () => {
			const visibilities: ErrorVisibility[] = ["response", "log", "none"];

			expect(visibilities.length).toBe(3);
		});
	});
});
