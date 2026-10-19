import { NextRequest, NextResponse } from "next/server";
import { loadPublishedProfile, loadPublicPortfolio } from "@/lib/portfolio/publication";
import { validateSlug } from "@/lib/portfolio/slug";

export const runtime = "nodejs";

/**
 * §35 — public portfolio fetch by slug. 404 for disabled/private/missing
 * portfolios without leaking existence (§31).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const validation = validateSlug(username);
  if (!validation.valid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const profile = await loadPublishedProfile(validation.normalized ?? "");
    if (!profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const portfolio = await loadPublicPortfolio(profile);
    if (!portfolio) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      portfolio: {
        ...portfolio,
        username: profile.username,
        displayName: profile.displayName,
        bio: profile.bio,
      },
    });
  } catch (error) {
    void error;
    // Never leak internals on the public route.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
