import { NextRequest, NextResponse } from "next/server";
import { getAllPhases, getPhaseDetails } from "@/lib/curriculum/service";
import { withApiKeyAuth, extractApiKey } from "@/lib/auth/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiKey = extractApiKey(request);
  if (apiKey) {
    const auth = withApiKeyAuth(request);
    if (!(await auth).authorized) return (await auth).response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const phase = searchParams.get("phase");
    const query = searchParams.get("query");
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const phases = await getAllPhases();
    const results = [];

    for (const phaseData of phases) {
      if (phase && phaseData.phaseNumber !== parseInt(phase, 10)) continue;

      const details = await getPhaseDetails(phaseData.slug);
      for (const lesson of details?.lessons ?? []) {
        const haystack = `${lesson.title} ${lesson.tagline ?? ""} ${lesson.slug}`.toLowerCase();
        if (query && !haystack.includes(query.toLowerCase())) continue;

        results.push({
          phaseSlug: phaseData.slug,
          phaseNumber: phaseData.phaseNumber,
          slug: lesson.lessonSlug ?? lesson.slug,
          title: lesson.title,
          tagline: lesson.tagline,
          estimatedMinutes: lesson.estimatedMinutes,
        });

        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    }

    return NextResponse.json({ success: true, data: results, total: results.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to search lessons", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
