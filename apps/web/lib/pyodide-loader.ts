/**
 * Pyodide dynamic loader for code splitting.
 *
 * Pyodide is a large library (~9MB) that should only be loaded
 * when the user actually runs Python code. This utility provides
 * a lazy-loaded singleton that loads Pyodide on-demand.
 *
 * @module lib/pyodide-loader
 */

type PyodideInstance = {
	setStdout: (config: { batched: (output: string) => void }) => void;
	loadPackagesFromImports: (
		code: string,
		options?: { messageCallback?: (message: string) => void },
	) => Promise<void>;
	runPythonAsync: (code: string) => Promise<void>;
};

type LoadPyodideFunc = (config?: {
	indexURL?: string;
}) => Promise<PyodideInstance>;

let pyodideLoadPromise: Promise<LoadPyodideFunc> | null = null;
let pyodideScriptLoaded = false;

/**
 * Load Pyodide dynamically from CDN
 * Caches the load promise so subsequent calls return the same instance
 */
export async function loadPyodide(): Promise<LoadPyodideFunc> {
	// Return cached promise if already loading
	if (pyodideLoadPromise) {
		return pyodideLoadPromise;
	}

	// Create load promise
	pyodideLoadPromise = (async () => {
		// Load script if not already loaded
		if (!pyodideScriptLoaded) {
			await loadScript(
				"https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js",
			);
			pyodideScriptLoaded = true;
		}

		// Wait for loadPyodide to be available
		while (typeof globalThis.loadPyodide === "undefined") {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		return globalThis.loadPyodide as LoadPyodideFunc;
	})();

	return pyodideLoadPromise;
}

/**
 * Dynamically load a script tag
 */
function loadScript(src: string): Promise<void> {
	return new Promise((resolve, reject) => {
		// Check if script already exists
		const existingScript = document.querySelector(`script[src="${src}"]`);
		if (existingScript) {
			resolve();
			return;
		}

		const script = document.createElement("script");
		script.src = src;
		script.async = true;

		script.onload = () => resolve();
		script.onerror = () => reject(new Error(`Failed to load script: ${src}`));

		document.head.appendChild(script);
	});
}

/**
 * Preload Pyodide (useful for anticipating code execution)
 * Call this before user clicks "Run" to reduce perceived latency
 */
export function preloadPyodide(): void {
	void loadPyodide();
}

/**
 * Check if Pyodide is available
 */
export function isPyodideLoaded(): boolean {
	return typeof globalThis.loadPyodide !== "undefined";
}

/**
 * Reset Pyodide loader (useful for testing)
 */
export function resetPyodideLoader(): void {
	pyodideLoadPromise = null;
	pyodideScriptLoaded = false;
}
