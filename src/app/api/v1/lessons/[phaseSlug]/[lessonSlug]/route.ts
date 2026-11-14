import { NextRequest, NextResponse } from "next/server";
import { getLessonDetails } from "@/lib/curriculum/service";
import { withApiKeyAuth, extractApiKey } from "@/lib/auth/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ phaseSlug: string; lessonSlug: string }> }
) {
  const apiKey = extractApiKey(request);
  if (apiKey) {
    const auth = withApiKeyAuth(request);
    if (!(await auth).authorized) return (await auth).response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const includeContent = searchParams.get("includeContent") === "true";

    const { phaseSlug, lessonSlug } = await params;
    const lesson = await getLessonDetails(phaseSlug, lessonSlug);
    if (!lesson) {
      return NextResponse.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const response: {
      slug: string;
      title: string;
      tagline: string | null;
      learningObjectives: string[];
      estimatedMinutes: number;
      upstreamAttribution: {
        repoUrl: string;
        commitSha: string;
        sourceFileUrl: string;
        author: string;
        license: string;
      };
      markdownContent?: string;
      codeFiles?: Array<{
        filename: string;
        relativePath: string;
        language: string;
        sizeBytes: number;
        content?: string;
      }>;
    } = {
      slug: lesson.slug,
      title: lesson.title,
      tagline: lesson.tagline,
      learningObjectives: lesson.learningObjectives,
      estimatedMinutes: lesson.estimatedMinutes,
      upstreamAttribution: lesson.upstreamAttribution,
    };

    if (includeContent) {
      response.markdownContent = lesson.markdownContent;
      response.codeFiles = lesson.codeFiles;
    }

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch lesson", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
