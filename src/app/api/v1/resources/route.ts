import { NextRequest, NextResponse } from "next/server";
import { getAllResourceViews, getResourcesForLesson } from "@/lib/resources/service";
import { withApiKeyAuth } from "@/lib/auth/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const auth = withApiKeyAuth(request);
    if (!(await auth).authorized) return (await auth).response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get("lessonId");
    const type = searchParams.get("type");
    const query = searchParams.get("query");
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const resources = lessonId
      ? await getResourcesForLesson(lessonId)
      : await getAllResourceViews();

    const filtered = resources
      .filter((resource) => !type || resource.type === type)
      .filter((resource) => {
        if (!query) return true;
        return `${resource.title} ${resource.description ?? ""} ${resource.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase());
      })
      .slice(0, limit)
      .map((resource) => ({
        id: resource.id,
        key: resource.key,
        type: resource.type,
        title: resource.title,
        description: resource.description,
        canonicalUrl: resource.canonicalUrl,
        verificationStatus: resource.verificationStatus,
        editorialStatus: resource.editorialStatus,
        license: resource.license,
        sourcePlatform: resource.sourcePlatform,
        tags: resource.tags,
      }));

    return NextResponse.json({ success: true, data: filtered, total: filtered.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch resources", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
