import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/middleware";

export async function POST(request: Request) {
  try {
    // Clear session cookie
    await clearSessionCookie();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
