import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/middleware";
import { setSessionCookie } from "@/lib/auth/middleware";
import { createSessionToken } from "@/lib/auth/jwt";
import { createGuestUser } from "@/lib/db/queries";
import { isDevelopmentEnvironment } from "@/lib/constants";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const redirectUrl = searchParams.get("redirectUrl") || "/";

    // Check if already authenticated
    const session = await auth();
    if (session) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Create guest user
    const [guestUser] = await createGuestUser();

    if (!guestUser) {
      return NextResponse.json(
        { error: "Failed to create guest user" },
        { status: 500 }
      );
    }

    // Create session token
    const sessionToken = await createSessionToken(
      guestUser.id,
      guestUser.email,
      "guest"
    );

    // Set session cookie
    await setSessionCookie(sessionToken);

    // Redirect to the requested URL
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  } catch (error) {
    console.error("Guest user creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
