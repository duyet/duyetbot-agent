import { NextResponse } from "next/server";
import { storeOAuthState } from "@/lib/auth/github";

export async function GET(request: Request) {
  try {
    // Generate state token
    const state = crypto.randomUUID();

    // Store state in KV
    await storeOAuthState(state);

    // Build GitHub OAuth URL
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID || "",
      redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/auth/github/callback`,
      scope: "read:user user:email",
      state,
    });

    const githubUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

    // Redirect to GitHub
    return NextResponse.redirect(githubUrl);
  } catch (error) {
    console.error("GitHub OAuth error:", error);
    return NextResponse.json(
      { error: "Failed to initiate GitHub OAuth" },
      { status: 500 }
    );
  }
}
