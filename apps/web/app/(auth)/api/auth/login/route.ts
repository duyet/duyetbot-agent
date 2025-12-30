import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/crypto";
import { setSessionCookie } from "@/lib/auth/middleware";
import { createSessionToken } from "@/lib/auth/jwt";
import { getUser } from "@/lib/db/queries";
import type { LoginRequestBody } from "@/lib/auth/types";

export async function POST(request: Request) {
  try {
    const body = await request.json() as LoginRequestBody;
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const users = await getUser(email);

    if (users.length === 0) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const [user] = users;

    if (!user.password) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const passwordsMatch = await verifyPassword(password, user.password);

    if (!passwordsMatch) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Create session token
    const sessionToken = await createSessionToken(user.id, user.email, "regular");

    // Set session cookie
    await setSessionCookie(sessionToken);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
