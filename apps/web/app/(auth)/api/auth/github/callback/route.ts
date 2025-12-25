import { NextResponse } from "next/server";
import {
  verifyOAuthState,
  exchangeCodeForToken,
  getGitHubUser,
  completeGitHubLogin,
} from "@/lib/auth/github";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      console.error("GitHub OAuth error:", error);
      return NextResponse.redirect(
        new URL("/login?error=oauth_error", request.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/login?error=missing_params", request.url)
      );
    }

    // Verify state to prevent CSRF attacks
    const isValidState = await verifyOAuthState(state);
    if (!isValidState) {
      return NextResponse.redirect(
        new URL("/login?error=invalid_state", request.url)
      );
    }

    // Exchange code for access token
    const { access_token } = await exchangeCodeForToken(code);

    // Fetch user profile from GitHub
    const githubUser = await getGitHubUser(access_token);

    // Complete login (create user and session)
    await completeGitHubLogin(githubUser);

    // Redirect to home page
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/login?error=oauth_failed", request.url)
    );
  }
}
