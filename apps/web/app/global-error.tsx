"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log critical error
		console.error("[Global Error]", {
			message: error.message,
			digest: error.digest,
			stack: error.stack,
		});
	}, [error]);

	return (
		<html lang="en">
			<body className="bg-background text-foreground">
				<div className="flex h-dvh w-full flex-col items-center justify-center gap-6 p-6">
					<div className="flex flex-col items-center gap-4 text-center">
						<div className="flex size-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
							<AlertTriangle className="size-10 text-red-600 dark:text-red-400" />
						</div>

						<div className="space-y-2">
							<h1 className="text-2xl font-semibold">Critical Error</h1>
							<p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
								The application encountered a critical error. Please reload the
								page to continue.
							</p>
						</div>
					</div>

					<button
						className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
						onClick={() => reset()}
						type="button"
					>
						<RefreshCw className="size-4" />
						Reload application
					</button>

					{error.digest && (
						<p className="text-xs text-gray-500">Error ID: {error.digest}</p>
					)}
				</div>
			</body>
		</html>
	);
}
