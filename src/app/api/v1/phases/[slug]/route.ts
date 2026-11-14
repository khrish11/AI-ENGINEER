import { NextRequest, NextResponse } from "next/server";
import { getPhaseDetails } from "@/lib/curriculum/service";
import { withApiKeyAuth } from "@/lib/auth/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const auth = withApiKeyAuth(request);
    if (!(await auth).authorized) return (await auth).response;
  }

  try {
    const { slug } = await params;
    const details = await getPhaseDetails(slug);
    if (!details) {
      return NextResponse.json({ success: false, error: "Phase not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        phaseNumber: details.phase.phaseNumber,
        slug: details.phase.slug,
        title: details.phase.title,
        lessons: details.lessons.map((lesson) => ({
          slug: lesson.slug,
          title: lesson.title,
          tagline: lesson.tagline,
          estimatedMinutes: lesson.estimatedMinutes,
        })),
        lessonCount: details.lessons.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch phase details", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
