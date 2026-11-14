import { NextRequest, NextResponse } from "next/server";
import { getAllPhases, getPhaseDetails } from "@/lib/curriculum/service";
import { withApiKeyAuth, extractApiKey } from "@/lib/auth/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/phases - Get all phases
export async function GET(request: NextRequest) {
  // Optional API key auth - if provided, must be valid
  const apiKey = extractApiKey(request);
  if (apiKey) {
    const auth = withApiKeyAuth(request);
    if (!(await auth).authorized) return (await auth).response;
  }

  try {
    const phases = await getAllPhases();
    return NextResponse.json({
      success: true,
      data: phases.map((phase) => ({
        phaseNumber: phase.phaseNumber,
        slug: phase.slug,
        title: phase.title,
        description: phase.description,
        lessonCount: phase.lessonCount,
      })),
      total: phases.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch phases",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
