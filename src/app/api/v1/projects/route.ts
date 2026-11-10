import { NextRequest, NextResponse } from "next/server";
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
    const { searchParams } = new URL(request.url);
    const phase = searchParams.get("phase");
    const query = searchParams.get("query");
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const filtered = projectCatalog
      .filter((project) => !phase || project.phaseSlugs.includes(phase))
      .filter((project) => {
        if (!query) return true;
        return `${project.title} ${project.description}`.toLowerCase().includes(query.toLowerCase());
      })
      .slice(0, limit)
      .map((project) => ({
        slug: project.slug,
        title: project.title,
        description: project.description,
        level: project.level,
        phaseSlugs: project.phaseSlugs,
        estimatedHours: project.estimatedHours,
      }));

    return NextResponse.json({ success: true, data: filtered, total: filtered.length });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to search projects", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
