/**
 * Login Form Component
 *
 * Displays the GitHub OAuth login button
 */

'use client';

import { Github } from 'lucide-react';
import { Button } from './ui/button';

export function LoginForm() {
  const handleLogin = () => {
    window.location.href = '/api/auth/login';
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">DuyetBot Chat</h1>
          <p className="mt-2 text-sm text-gray-600">Sign in with GitHub to start chatting</p>
        </div>

        <div className="mt-8">
          <Button onClick={handleLogin} size="lg" className="w-full" variant="default">
            <Github className="mr-2 h-5 w-5" />
            Sign in with GitHub
          </Button>
        </div>

        <div className="text-center text-xs text-gray-500">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </div>
      </div>
    </div>
  );
}
