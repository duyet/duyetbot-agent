/**
 * Global type declarations for external libraries
 */

declare global {
	/**
	 * Pyodide load function (loaded dynamically from CDN)
	 *
	 * @see https://pyodide.org/en/stable/usage/api.html
	 */
	interface Window {
		loadPyodide?: (config?: { indexURL?: string }) => Promise<{
			setStdout: (config: { batched: (output: string) => void }) => void;
			loadPackagesFromImports: (
				code: string,
				options?: { messageCallback?: (message: string) => void }
			) => Promise<void>;
			runPythonAsync: (code: string) => Promise<void>;
		}>;
	}

	var loadPyodide: Window["loadPyodide"];
}

export {};
