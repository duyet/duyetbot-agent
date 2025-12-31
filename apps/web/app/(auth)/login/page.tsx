"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthForm } from "@/components/auth-form";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { login } from "@/lib/api-client";

export default function Page() {
	const router = useRouter();

	const [email, setEmail] = useState("");
	const [isSuccessful, setIsSuccessful] = useState(false);
	const [status, setStatus] = useState<
		"idle" | "in_progress" | "success" | "failed" | "invalid_data"
	>("idle");
	const [error, setError] = useState<string | undefined>();

	const handleSubmit = async (formData: FormData) => {
		setEmail(formData.get("email") as string);
		setStatus("in_progress");

		const result = await login(formData);
		setStatus(result.status);
		setError(result.error);

		if (result.status === "success") {
			setIsSuccessful(true);

			// Fix race condition: Wait for router.refresh() to complete before navigation
			// This ensures the session cookie is properly set before page transition
			await router.refresh();
			router.push("/");
		}
	};

	useEffect(() => {
		if (status === "failed") {
			toast({
				type: "error",
				description: error || "Invalid credentials!",
			});
		} else if (status === "invalid_data") {
			toast({
				type: "error",
				description: "Failed validating your submission!",
			});
		}
	}, [status, error]);

	return (
		<div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
			<div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
				<div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
					<h3 className="font-semibold text-xl dark:text-zinc-50">Sign In</h3>
					<p className="text-gray-500 text-sm dark:text-zinc-400">
						Use your email and password to sign in
					</p>
				</div>
				<AuthForm action={handleSubmit} defaultEmail={email}>
					<SubmitButton isSuccessful={isSuccessful}>Sign in</SubmitButton>
					<p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
						{"Don't have an account? "}
						<Link
							className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
							href="/register"
						>
							Sign up
						</Link>
						{" for free."}
					</p>
				</AuthForm>
			</div>
		</div>
	);
}
