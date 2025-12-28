"use client";

import { AlertTriangle, Home, MessageSquare, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode;
	onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
	onReset?: () => void;
	onReport?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
	level?: "page" | "section" | "component";
	showDetails?: boolean;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: ErrorInfo | null;
	errorId: string;
}

export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
			errorId: "",
		};
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return {
			hasError: true,
			error,
			errorId: `err-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
		};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		this.setState({ errorInfo });

		// Log error with context
		console.error("[ErrorBoundary] Caught error:", {
			errorId: this.state.errorId,
			error: error.message,
			stack: error.stack,
			componentStack: errorInfo.componentStack,
		});

		// Call custom error handler if provided
		this.props.onError?.(error, errorInfo, this.state.errorId);
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null, errorInfo: null });
		this.props.onReset?.();
	};

	handleReload = () => {
		window.location.reload();
	};

	handleGoHome = () => {
		window.location.href = "/";
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			const level = this.props.level ?? "section";

			return (
				<ErrorFallback
					error={this.state.error}
					errorInfo={this.state.errorInfo}
					errorId={this.state.errorId}
					level={level}
					showDetails={
						this.props.showDetails ?? process.env.NODE_ENV === "development"
					}
					onGoHome={this.handleGoHome}
					onReload={this.handleReload}
					onReset={this.handleReset}
					onReport={this.props.onReport}
				/>
			);
		}

		return this.props.children;
	}
}

interface ErrorFallbackProps {
	error: Error | null;
	errorInfo: ErrorInfo | null;
	errorId: string;
	level: "page" | "section" | "component";
	showDetails: boolean;
	onReset: () => void;
	onReload: () => void;
	onGoHome: () => void;
	onReport?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
}

function ErrorFallback({
	error,
	errorInfo,
	errorId,
	level,
	showDetails,
	onReset,
	onReload,
	onGoHome,
	onReport,
}: ErrorFallbackProps) {
	const isPageLevel = level === "page";
	const isComponentLevel = level === "component";

	// Get user-friendly error message
	const errorMessage = getErrorMessage(error);

	const handleCopyError = () => {
		const errorText = `Error ID: ${errorId}\n\nError: ${error?.message}\n\nStack:\n${error?.stack}\n\nComponent Stack:\n${errorInfo?.componentStack}`;
		navigator.clipboard.writeText(errorText);
	};

	const handleReport = () => {
		if (onReport && error && errorInfo) {
			onReport(error, errorInfo, errorId);
		}
	};

	if (isComponentLevel) {
		return (
			<div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
				<AlertTriangle className="size-4 shrink-0" />
				<span>{errorMessage}</span>
				<div className="ml-auto flex gap-1">
					<Button onClick={handleCopyError} size="sm" variant="ghost">
						Copy
					</Button>
					<Button onClick={onReset} size="sm" variant="ghost">
						<RefreshCw className="mr-1 size-3" />
						Retry
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div
			className={`flex ${isPageLevel ? "h-dvh" : "min-h-[300px]"} w-full flex-col items-center justify-center gap-6 p-6`}
		>
			<div className="flex flex-col items-center gap-4 text-center">
				<div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
					<AlertTriangle className="size-8 text-destructive" />
				</div>

				<div className="space-y-2">
					<h2 className="text-xl font-semibold text-foreground">
						{isPageLevel ? "Something went wrong" : "Failed to load"}
					</h2>
					<p className="max-w-md text-sm text-muted-foreground">
						{errorMessage}
					</p>
					<p className="text-xs text-muted-foreground">Error ID: {errorId}</p>
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-center gap-3">
				<Button onClick={onReset} variant="default">
					<RefreshCw className="mr-2 size-4" />
					Try again
				</Button>

				{isPageLevel && (
					<>
						<Button onClick={onReload} variant="outline">
							<RefreshCw className="mr-2 size-4" />
							Reload page
						</Button>
						<Button onClick={onGoHome} variant="outline">
							<Home className="mr-2 size-4" />
							Go home
						</Button>
					</>
				)}

				<Button onClick={handleCopyError} variant="outline" size="sm">
					Copy error
				</Button>

				{onReport && (
					<Button onClick={handleReport} variant="outline" size="sm">
						Report issue
					</Button>
				)}
			</div>

			{showDetails && error && errorInfo && (
				<details className="mt-4 w-full max-w-2xl rounded-lg border bg-muted/50 p-4">
					<summary className="cursor-pointer text-sm font-medium text-muted-foreground">
						Error details
					</summary>
					<div className="mt-3 space-y-3">
						<div>
							<div className="mb-1 text-sm font-medium">Error ID:</div>
							<code className="text-xs text-muted-foreground">{errorId}</code>
						</div>
						<div>
							<div className="mb-1 text-sm font-medium">Stack Trace:</div>
							<pre className="overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
								{error.stack || error.message}
							</pre>
						</div>
						<div>
							<div className="mb-1 text-sm font-medium">Component Stack:</div>
							<pre className="overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
								{errorInfo.componentStack}
							</pre>
						</div>
					</div>
				</details>
			)}
		</div>
	);
}

function getErrorMessage(error: Error | null): string {
	if (!error) {
		return "An unexpected error occurred. Please try again.";
	}

	// Handle known error patterns
	const message = error.message.toLowerCase();

	if (message.includes("network") || message.includes("fetch")) {
		return "Unable to connect to the server. Please check your internet connection and try again.";
	}

	if (message.includes("timeout")) {
		return "The request took too long. Please try again.";
	}

	if (message.includes("unauthorized") || message.includes("401")) {
		return "Your session has expired. Please sign in again.";
	}

	if (message.includes("forbidden") || message.includes("403")) {
		return "You don't have permission to access this resource.";
	}

	if (message.includes("not found") || message.includes("404")) {
		return "The requested resource could not be found.";
	}

	if (message.includes("rate limit") || message.includes("429")) {
		return "Too many requests. Please wait a moment and try again.";
	}

	// Generic fallback
	return "Something went wrong. Please try again or contact support if the problem persists.";
}

// Chat-specific error boundary with messaging context
export function ChatErrorBoundary({ children }: { children: ReactNode }) {
	return (
		<ErrorBoundary
			fallback={<ChatErrorFallback />}
			level="section"
			onError={(error, errorInfo, errorId) => {
				console.error("[ChatErrorBoundary] Error in chat:", {
					errorId,
					error,
					errorInfo,
				});
			}}
		>
			{children}
		</ErrorBoundary>
	);
}

function ChatErrorFallback() {
	const handleNewChat = () => {
		window.location.href = "/";
	};

	const handleReload = () => {
		window.location.reload();
	};

	return (
		<div className="flex h-full w-full flex-col items-center justify-center gap-6 p-6">
			<div className="flex flex-col items-center gap-4 text-center">
				<div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
					<MessageSquare className="size-8 text-destructive" />
				</div>

				<div className="space-y-2">
					<h2 className="text-xl font-semibold text-foreground">Chat error</h2>
					<p className="max-w-md text-sm text-muted-foreground">
						There was a problem loading this chat. Your messages are safe and
						you can try reloading or starting a new conversation.
					</p>
				</div>
			</div>

			<div className="flex items-center gap-3">
				<Button onClick={handleReload} variant="default">
					<RefreshCw className="mr-2 size-4" />
					Reload chat
				</Button>
				<Button onClick={handleNewChat} variant="outline">
					<MessageSquare className="mr-2 size-4" />
					New chat
				</Button>
			</div>
		</div>
	);
}

// Artifact viewer error boundary
export function ArtifactErrorBoundary({ children }: { children: ReactNode }) {
	return (
		<ErrorBoundary
			level="section"
			onError={(error, errorInfo, errorId) => {
				console.error("[ArtifactErrorBoundary] Error in artifact:", {
					errorId,
					error,
					errorInfo,
				});
			}}
		>
			{children}
		</ErrorBoundary>
	);
}

// Document editor error boundary
export function DocumentErrorBoundary({ children }: { children: ReactNode }) {
	return (
		<ErrorBoundary
			level="section"
			onError={(error, errorInfo, errorId) => {
				console.error("[DocumentErrorBoundary] Error in document:", {
					errorId,
					error,
					errorInfo,
				});
			}}
		>
			{children}
		</ErrorBoundary>
	);
}

export { ErrorFallback };
