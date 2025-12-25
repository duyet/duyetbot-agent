import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/middleware";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json(null, { status: 401 });
  }

  return NextResponse.json(session);
}
