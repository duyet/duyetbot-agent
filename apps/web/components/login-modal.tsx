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
import { LoaderIcon } from "./icons";
import { toast } from "./toast";
import { login, register } from "@/lib/api-client";
import { setStoredToken } from "@/lib/auth/token-storage";

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "in_progress" | "success" | "failed" | "user_exists" | "invalid_data">("idle");
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("in_progress");

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);

    const result = mode === "login" ? await login(formData) : await register(formData);
    setStatus(result.status);
    setError(result.error);

    if (result.status === "success") {
      // Store token in localStorage for bearer auth
      if (result.token) {
        setStoredToken(result.token);
      }

      toast({
        type: "success",
        description: mode === "login" ? "Welcome back!" : "Account created successfully!",
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "login" ? "Sign In" : "Sign Up"}</DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? "Enter your email and password to sign in to your account"
              : "Create a new account with your email and password"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="modal-email">Email Address</Label>
            <Input
              id="modal-email"
              type="email"
              placeholder="user@acme.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={status === "in_progress"}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modal-password">Password</Label>
            <Input
              id="modal-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={status === "in_progress"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {status === "failed" || status === "user_exists" || status === "invalid_data" ? (
            <p className="text-sm text-destructive">{error || "An error occurred"}</p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              className="w-full"
              disabled={status === "in_progress"}
            >
              {status === "in_progress" ? (
                <>
                  <div className="mr-2 animate-spin">
                    <LoaderIcon />
                  </div>
                  {mode === "login" ? "Signing in..." : "Creating account..."}
                </>
              ) : (
                mode === "login" ? "Sign In" : "Sign Up"
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleModeSwitch}
              disabled={status === "in_progress"}
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
