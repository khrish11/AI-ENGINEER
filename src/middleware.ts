import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export default auth((req) => {
  const isAuthenticated = !!req.auth?.user?.id;
  const { pathname } = req.nextUrl;

  // Allow auth pages, health checks, version, MCP endpoint, and public portfolios
  const isPublicRoute =
    pathname.startsWith("/settings") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/version") ||
    pathname.startsWith("/api/mcp") ||
    pathname.startsWith("/portfolio") ||
    pathname.startsWith("/api/portfolio/public");

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Handle unauthenticated requests
  if (!isAuthenticated) {
    // Return 401 for unauthenticated API requests rather than HTML redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const signInUrl = new URL("/settings", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static assets (.svg, .png, .jpg, .jpeg, .gif, .webp, .woff, .woff2, .ttf, .ico)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|ico)$).*)",
  ],
};
