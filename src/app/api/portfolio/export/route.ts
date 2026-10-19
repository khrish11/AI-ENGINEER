import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/session";
import { loadPortfolioSettings } from "@/lib/portfolio/profile";
import { loadPublishedProfile, loadPublicPortfolio } from "@/lib/portfolio/publication";

export const runtime = "nodejs";

/**
 * §32 — owner export: structured JSON of the publication configuration plus the
 * exact public view that would be shown. Contains no private records beyond the
 * serialized public fields, and no fabricated resume claims are synthesized.
 */
export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to export your portfolio." }, { status: 401 });
  }
  try {
    const settings = await loadPortfolioSettings(userId);
    let portfolio = null;
    if (settings?.username && settings.published && settings.portfolioEnabled) {
      const profile = await loadPublishedProfile(settings.username);
      if (profile) {
        portfolio = await loadPublicPortfolio(profile);
      }
    }
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      settings,
      portfolio,
      note: "Self-assessed scores are learner-entered and are not verified grades.",
    });
  } catch (error) {
    void error;
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
