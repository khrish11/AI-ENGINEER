import { NextRequest, NextResponse } from "next/server";
import { handlers, isAuthConfigured, configuredProviders } from "@/auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  if (!isAuthConfigured()) {
    const params = await context.params;
    const action = params.nextauth?.[params.nextauth.length - 1];
    if (action === "session" || action === "providers") {
      return NextResponse.json({
        configured: false,
        providers: [],
        user: null,
      });
    }
    return NextResponse.json(
      {
        error: "Authentication is not configured",
        providers: configuredProviders,
        hint: "Set AUTH_SECRET and OAuth client credentials. Guest Mode still works.",
      },
      { status: 501 }
    );
  }
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        error: "Authentication is not configured",
        hint: "Guest Mode is available without OAuth credentials.",
      },
      { status: 501 }
    );
  }
  return handlers.POST(request);
}
