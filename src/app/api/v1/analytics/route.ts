import { NextRequest, NextResponse } from "next/server";
import { getAllPhases } from "@/lib/curriculum/service";
import { getAllResourceViews } from "@/lib/resources/service";
import { projectCatalog } from "@/lib/projects/catalog";
import { withApiKeyAuth } from "@/lib/auth/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const auth = withApiKeyAuth(request);
    if (!auth.authorized) return auth.response;
  }

  try {
    const phases = await getAllPhases();
    const totalLessons = phases.reduce((sum, p) => sum + p.lessonCount, 0);
    const resources = await getAllResourceViews();

    const analytics = {
      curriculum: {
        totalPhases: phases.length,
        totalLessons,
        averageLessonsPerPhase: Math.round(totalLessons / phases.length),
        firstPhase: phases[0]?.slug || null,
        lastPhase: phases[phases.length - 1]?.slug || null,
      },
      projects: {
        total: projectCatalog.length,
        byLevel: {
          beginner: projectCatalog.filter(p => p.level === "beginner").length,
          intermediate: projectCatalog.filter(p => p.level === "intermediate").length,
          advanced: projectCatalog.filter(p => p.level === "advanced").length,
        },
      },
      resources: {
        total: resources.length,
        byType: resources.reduce((acc, r) => {
          acc[r.type] = (acc[r.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        verified: resources.filter(r => r.verificationStatus === "verified").length,
      },
    };

    return NextResponse.json({ success: true, data: analytics });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch analytics", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
