import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { usernameTakenByOther } from "@/lib/portfolio/profile";
import { validateSlug } from "@/lib/portfolio/slug";

export const runtime = "nodejs";

/** GET /api/portfolio/slug?slug=girish — validate + availability check. */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("slug") ?? "";
  const validation = validateSlug(raw);
  if (!validation.valid) {
    return NextResponse.json({ available: false, reason: validation.reason, valid: false });
  }
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    // §34 — availability is only meaningful for authenticated publishing.
    return NextResponse.json({ available: false, valid: true, reason: "Sign in to publish." });
  }
  try {
    const taken = await usernameTakenByOther(validation.normalized ?? "", userId);
    return NextResponse.json({ available: !taken, valid: true, reason: taken ? "Taken" : null });
  } catch {
    return NextResponse.json(
      { error: "Slug check unavailable" },
      { status: 503 }
    );
  }
}
