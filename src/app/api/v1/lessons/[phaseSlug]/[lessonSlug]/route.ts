import { NextRequest, NextResponse } from "next/server";
import { getLessonDetails } from "@/lib/curriculum/service";
import { withApiKeyAuth } from "@/lib/auth/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { phaseSlug: string; lessonSlug: string } }
) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const auth = withApiKeyAuth(request);
    if (!auth.authorized) return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const includeContent = searchParams.get("includeContent") === "true";

    const lesson = await getLessonDetails(params.phaseSlug, params.lessonSlug);
    if (!lesson) {
      return NextResponse.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const response = {
      slug: lesson.slug,
      title: lesson.title,
      tagline: lesson.tagline,
      learningObjectives: lesson.learningObjectives,
      estimatedMinutes: lesson.estimatedMinutes,
      upstreamAttribution: lesson.upstreamAttribution,
    };

    if (includeContent) {
      (response as typeof response & { markdownContent: string; codeFiles: unknown[] }).markdownContent = lesson.markdownContent;
      (response as typeof response & { markdownContent: string; codeFiles: unknown[] }).codeFiles = lesson.codeFiles;
    }

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch lesson", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
