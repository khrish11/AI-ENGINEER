import { NextRequest } from "next/server";
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
    if (!(await auth).authorized) return (await auth).response;
  }

  try {
    const lesson = await getLessonDetails(params.phaseSlug, params.lessonSlug);
    if (!lesson) {
      return new Response(JSON.stringify({ success: false, error: "Lesson not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send metadata first
          const metadata = {
            type: "metadata",
            data: {
              slug: lesson.slug,
              title: lesson.title,
              tagline: lesson.tagline,
              learningObjectives: lesson.learningObjectives,
            },
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));

          // Stream content in chunks
          const content = lesson.markdownContent || "";
          const chunkSize = 500; // characters per chunk
          for (let i = 0; i < content.length; i += chunkSize) {
            const chunk = content.slice(i, i + chunkSize);
            const chunkData = {
              type: "content",
              data: chunk,
              progress: Math.min(100, Math.round(((i + chunkSize) / content.length) * 100)),
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`));

            // Small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          // Send completion signal
          const done = { type: "done", data: { totalLength: content.length } };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(done)}\n\n`));

          controller.close();
        } catch (error) {
          const errorData = { type: "error", data: { message: error instanceof Error ? error.message : "Unknown error" } };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: "Failed to stream lesson" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
