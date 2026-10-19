import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthPublicStatus } from "@/lib/auth/session";

export async function GET() {
  const publicStatus = getAuthPublicStatus();
  const session = publicStatus.configured ? await auth() : null;
  return NextResponse.json({
    ...publicStatus,
    authenticated: Boolean(session?.user?.id),
    user: session?.user
      ? {
          id: session.user.id,
          name: session.user.name ?? null,
          email: session.user.email ?? null,
          image: session.user.image ?? null,
        }
      : null,
  });
}
