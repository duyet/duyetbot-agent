"use client";

import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log the error to console with context
		console.error("[App Error]", {
			message: error.message,
			digest: error.digest,
			stack: error.stack,
		});
	}, [error]);

	const handleGoHome = () => {
		window.location.href = "/";
	};

	return (
		<div className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-background p-6">
			<div className="flex flex-col items-center gap-4 text-center">
				<div className="flex size-20 items-center justify-center rounded-full bg-destructive/10">
					<AlertTriangle className="size-10 text-destructive" />
				</div>

				<div className="space-y-2">
					<h1 className="text-2xl font-semibold text-foreground">
						Something went wrong
					</h1>
					<p className="max-w-md text-sm text-muted-foreground">
						We encountered an unexpected error. Don't worry, your data is safe.
						You can try again or return to the home page.
					</p>
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-center gap-3">
				<Button onClick={() => reset()} variant="default">
					<RefreshCw className="mr-2 size-4" />
					Try again
				</Button>
				<Button onClick={handleGoHome} variant="outline">
					<Home className="mr-2 size-4" />
					Go home
				</Button>
			</div>

			{error.digest && (
				<p className="text-xs text-muted-foreground">
					Error ID: {error.digest}
				</p>
			)}
		</div>
	);
}
