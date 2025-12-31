import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom";

// Cleanup after each test to prevent DOM pollution when isolate: false
afterEach(() => {
	cleanup();
});
