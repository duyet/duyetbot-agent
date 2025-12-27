"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthForm } from "@/components/auth-form";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { register } from "@/lib/api-client";

export default function Page() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [status, setStatus] = useState<
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data"
  >("idle");
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async (formData: FormData) => {
    setEmail(formData.get("email") as string);
    setStatus("in_progress");

    const result = await register(formData);
    setStatus(result.status);
    setError(result.error);

    if (result.status === "success") {
      toast({ type: "success", description: "Account created successfully!" });
      setIsSuccessful(true);

      // Fix race condition: Wait for router.refresh() to complete before navigation
      // This ensures the session cookie is properly set before page transition
      await router.refresh();
      router.push("/");
    }
  };

  useEffect(() => {
    if (status === "user_exists") {
      toast({ type: "error", description: error || "Account already exists!" });
    } else if (status === "failed") {
      toast({
        type: "error",
        description: error || "Failed to create account!",
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
          <h3 className="font-semibold text-xl dark:text-zinc-50">Sign Up</h3>
          <p className="text-gray-500 text-sm dark:text-zinc-400">
            Create an account with your email and password
          </p>
        </div>
        <AuthForm action={handleSubmit} defaultEmail={email}>
          <SubmitButton isSuccessful={isSuccessful}>Sign Up</SubmitButton>
          <p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
            {"Already have an account? "}
            <Link
              className="font-semibold text-gray-800 hover:underline dark:text-zinc-200"
              href="/login"
            >
              Sign in
            </Link>
            {" instead."}
          </p>
        </AuthForm>
      </div>
    </div>
  );
}
