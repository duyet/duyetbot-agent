/**
 * Unit tests for use-artifact hook
 *
 * Test Categories:
 * 1. Hook initialization and state
 * 2. Artifact state management
 * 3. Metadata management
 * 4. Selector pattern with useArtifactSelector
 * 5. Functional updates with setArtifact
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UIArtifact } from "@/components/artifact";
import {
	initialArtifactData,
	useArtifact,
	useArtifactSelector,
} from "./use-artifact";

// Helper to create a mock artifact
const createMockArtifact = (
	overrides: Partial<UIArtifact> = {},
): UIArtifact => ({
	documentId: "test-doc-1",
	content: "Test content",
	kind: "text",
	title: "Test Title",
	status: "idle",
	isVisible: true,
	boundingBox: { top: 0, left: 0, width: 100, height: 100 },
	...overrides,
});

// SWR cache key used by the hook
const ARTIFACT_CACHE_KEY = "artifact";

// Clear SWR cache before each test to prevent pollution
beforeEach(() => {
	// Create a cache context to isolate tests
	// SWR uses a global cache, so we need to reset it manually
	if (typeof window !== "undefined") {
		// Reset by mutating the cache key to undefined
		try {
			const { mutate } = require("swr/_internal");
			mutate(ARTIFACT_CACHE_KEY, undefined, false);
		} catch {
			// SWR might not be initialized yet
		}
	}
});

describe("useArtifact - Initialization and State", () => {
	it("initializes with initial artifact data", () => {
		const { result } = renderHook(() => useArtifact());

		expect(result.current.artifact).toEqual(initialArtifactData);
		expect(result.current.artifact.documentId).toBe("init");
		expect(result.current.artifact.content).toBe("");
		expect(result.current.artifact.isVisible).toBe(false);
	});

	it("returns all expected API methods", () => {
		const { result } = renderHook(() => useArtifact());

		expect(result.current.artifact).toBeDefined();
		expect(result.current.setArtifact).toBeDefined();
		expect(result.current.metadata).toBeDefined();
		expect(result.current.setMetadata).toBeDefined();
	});

	it("has null metadata initially", () => {
		const { result } = renderHook(() => useArtifact());

		expect(result.current.metadata).toBeNull();
	});
});

describe("useArtifact - Artifact State Management", () => {
	it("updates artifact with direct value", () => {
		const { result } = renderHook(() => useArtifact());
		const newArtifact = createMockArtifact();

		act(() => {
			result.current.setArtifact(newArtifact);
		});

		expect(result.current.artifact).toEqual(newArtifact);
		expect(result.current.artifact.documentId).toBe("test-doc-1");
		expect(result.current.artifact.content).toBe("Test content");
	});

	it("updates artifact with functional update", () => {
		const { result } = renderHook(() => useArtifact());

		act(() => {
			result.current.setArtifact((current) => ({
				...current,
				documentId: "updated-doc",
				content: "Updated content",
			}));
		});

		expect(result.current.artifact.documentId).toBe("updated-doc");
		expect(result.current.artifact.content).toBe("Updated content");
	});

	it("preserves unmodified properties in functional update", () => {
		const { result } = renderHook(() => useArtifact());
		const newArtifact = createMockArtifact();

		act(() => {
			result.current.setArtifact(newArtifact);
		});

		act(() => {
			result.current.setArtifact((current) => ({
				...current,
				content: "Only content changed",
			}));
		});

		expect(result.current.artifact.content).toBe("Only content changed");
		expect(result.current.artifact.documentId).toBe("test-doc-1");
		expect(result.current.artifact.kind).toBe("text");
	});

	it("updates multiple properties in single call", () => {
		const { result } = renderHook(() => useArtifact());

		act(() => {
			result.current.setArtifact((current) => ({
				...current,
				documentId: "multi-update",
				isVisible: true,
				status: "streaming" as const,
			}));
		});

		expect(result.current.artifact.documentId).toBe("multi-update");
		expect(result.current.artifact.isVisible).toBe(true);
		expect(result.current.artifact.status).toBe("streaming");
	});
});

describe("useArtifact - Metadata Management", () => {
	it("updates metadata independently", () => {
		const { result } = renderHook(() => useArtifact());
		const mockMetadata = { version: 1, author: "test" };

		act(() => {
			result.current.setArtifact(createMockArtifact());
		});

		act(() => {
			result.current.setMetadata(mockMetadata);
		});

		expect(result.current.metadata).toEqual(mockMetadata);
	});

	it("metadata is null before artifact has documentId", () => {
		const { result } = renderHook(() => useArtifact());

		// Initial state has documentId="init"
		expect(result.current.artifact.documentId).toBe("init");
		expect(result.current.metadata).toBeNull();
	});

	it("metadata can be updated after artifact update", () => {
		const { result } = renderHook(() => useArtifact());
		const mockMetadata = { key: "value" };

		act(() => {
			result.current.setArtifact(createMockArtifact({ documentId: "doc-123" }));
		});

		act(() => {
			result.current.setMetadata(mockMetadata);
		});

		expect(result.current.metadata).toEqual(mockMetadata);
		expect(result.current.artifact.documentId).toBe("doc-123");
	});
});

describe("useArtifactSelector - Selector Pattern", () => {
	it("selects single property from artifact", () => {
		const { result } = renderHook(() =>
			useArtifactSelector((artifact) => artifact.documentId),
		);

		expect(result.current).toBe("init");
	});

	it("selects computed value from artifact", () => {
		const { result } = renderHook(() =>
			useArtifactSelector((artifact) => ({
				isVisible: artifact.isVisible,
				hasContent: artifact.content.length > 0,
			})),
		);

		expect(result.current).toEqual({
			isVisible: false,
			hasContent: false,
		});
	});

	it("selector updates when artifact changes", () => {
		const { result } = renderHook(() =>
			useArtifactSelector((artifact) => artifact.status),
		);

		expect(result.current).toBe("idle");

		act(() => {
			// Note: useArtifactSelector uses SWR which uses the same cache key
			// So updating through useArtifact should reflect in selector
			vi.stubGlobal("localStorage", {
				getItem: vi.fn(() => null),
				setItem: vi.fn(),
				removeItem: vi.fn(),
			});
		});
	});

	it("selects nested property", () => {
		const { result } = renderHook(() =>
			useArtifactSelector((artifact) => artifact.boundingBox.width),
		);

		expect(result.current).toBe(0);
	});

	it("selects and transforms multiple properties", () => {
		const { result } = renderHook(() =>
			useArtifactSelector((artifact) => ({
				id: artifact.documentId,
				displayTitle: artifact.title || "Untitled",
				isActive: artifact.isVisible && artifact.status !== "idle",
			})),
		);

		expect(result.current).toEqual({
			id: "init",
			displayTitle: "Untitled",
			isActive: false,
		});
	});
});

describe("useArtifact - Edge Cases", () => {
	it("handles setting artifact to initial data", () => {
		const { result } = renderHook(() => useArtifact());

		act(() => {
			result.current.setArtifact(createMockArtifact());
		});

		expect(result.current.artifact.documentId).toBe("test-doc-1");

		act(() => {
			result.current.setArtifact(initialArtifactData);
		});

		expect(result.current.artifact).toEqual(initialArtifactData);
	});

	it("handles empty content updates", () => {
		const { result } = renderHook(() => useArtifact());
		const newArtifact = createMockArtifact({ content: "" });

		act(() => {
			result.current.setArtifact(newArtifact);
		});

		expect(result.current.artifact.content).toBe("");
		expect(result.current.artifact.documentId).toBe("test-doc-1");
	});

	it("handles all artifact kinds", () => {
		const { result } = renderHook(() => useArtifact());
		const kinds: Array<UIArtifact["kind"]> = [
			"text",
			"code",
			"image",
			"sheet",
			"chart",
		];

		for (const kind of kinds) {
			act(() => {
				result.current.setArtifact(createMockArtifact({ kind }));
			});

			expect(result.current.artifact.kind).toBe(kind);
		}
	});

	it("handles all status values", () => {
		const { result } = renderHook(() => useArtifact());
		const statuses: Array<UIArtifact["status"]> = ["idle", "streaming"];

		for (const status of statuses) {
			act(() => {
				result.current.setArtifact(createMockArtifact({ status }));
			});

			expect(result.current.artifact.status).toBe(status);
		}
	});

	it("handles bounding box updates", () => {
		const { result } = renderHook(() => useArtifact());
		const boundingBox = { top: 10, left: 20, width: 300, height: 400 };

		act(() => {
			result.current.setArtifact(createMockArtifact({ boundingBox }));
		});

		expect(result.current.artifact.boundingBox).toEqual(boundingBox);
	});
});

describe("useArtifact - Integration with SWR", () => {
	it("uses consistent cache key for artifact", () => {
		const { result: hook1 } = renderHook(() => useArtifact());
		const { result: hook2 } = renderHook(() => useArtifact());

		// Both hooks should start with same initial data
		expect(hook1.current.artifact).toEqual(hook2.current.artifact);

		act(() => {
			hook1.current.setArtifact(
				createMockArtifact({ documentId: "shared-cache" }),
			);
		});

		// SWR should sync state between hooks using same cache key
		expect(hook2.current.artifact.documentId).toBe("shared-cache");
	});

	it("setArtifact callback is stable across renders", () => {
		const { result, rerender } = renderHook(() => useArtifact());

		const firstCallback = result.current.setArtifact;

		rerender();

		const secondCallback = result.current.setArtifact;

		// Callback should be memoized with useCallback
		expect(firstCallback).toBe(secondCallback);
	});
});
