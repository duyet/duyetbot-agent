"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, register } from "@/lib/api-client";
import { setStoredToken } from "@/lib/auth/token-storage";
import { LoaderIcon } from "./icons";
import { toast } from "./toast";

interface LoginModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
	const router = useRouter();
	const [mode, setMode] = useState<"login" | "register">("login");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [status, setStatus] = useState<
		| "idle"
		| "in_progress"
		| "success"
		| "failed"
		| "user_exists"
		| "invalid_data"
	>("idle");
	const [error, setError] = useState<string | undefined>();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setStatus("in_progress");

		const formData = new FormData();
		formData.append("email", email);
		formData.append("password", password);

		const result =
			mode === "login" ? await login(formData) : await register(formData);
		setStatus(result.status);
		setError(result.error);

		if (result.status === "success") {
			// Store token in localStorage for bearer auth
			if (result.token) {
				setStoredToken(result.token);
			}

			toast({
				type: "success",
				description:
					mode === "login" ? "Welcome back!" : "Account created successfully!",
			});

			// Refresh and close modal
			await router.refresh();
			onOpenChange(false);

			// Reset form
			setEmail("");
			setPassword("");
		}
	};

	const handleModeSwitch = () => {
		setMode(mode === "login" ? "register" : "login");
		setStatus("idle");
		setError(undefined);
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{mode === "login" ? "Sign In" : "Sign Up"}</DialogTitle>
					<DialogDescription>
						{mode === "login"
							? "Enter your email and password to sign in to your account"
							: "Create a new account with your email and password"}
					</DialogDescription>
				</DialogHeader>

				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor="modal-email">Email Address</Label>
						<Input
							autoComplete="email"
							disabled={status === "in_progress"}
							id="modal-email"
							onChange={(e) => setEmail(e.target.value)}
							placeholder="user@acme.com"
							required
							type="email"
							value={email}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="modal-password">Password</Label>
						<Input
							autoComplete={
								mode === "login" ? "current-password" : "new-password"
							}
							disabled={status === "in_progress"}
							id="modal-password"
							onChange={(e) => setPassword(e.target.value)}
							required
							type="password"
							value={password}
						/>
					</div>

					{status === "failed" ||
					status === "user_exists" ||
					status === "invalid_data" ? (
						<p className="text-destructive text-sm">
							{error || "An error occurred"}
						</p>
					) : null}

					<div className="flex flex-col gap-2">
						<Button
							className="w-full"
							disabled={status === "in_progress"}
							type="submit"
						>
							{status === "in_progress" ? (
								<>
									<div className="mr-2 animate-spin">
										<LoaderIcon />
									</div>
									{mode === "login" ? "Signing in..." : "Creating account..."}
								</>
							) : mode === "login" ? (
								"Sign In"
							) : (
								"Sign Up"
							)}
						</Button>

						<Button
							className="w-full"
							disabled={status === "in_progress"}
							onClick={handleModeSwitch}
							type="button"
							variant="ghost"
						>
							{mode === "login"
								? "Don't have an account? Sign up"
								: "Already have an account? Sign in"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
