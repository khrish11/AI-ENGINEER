import { NextRequest, NextResponse } from "next/server";
import { getLessonDetails } from "@/lib/curriculum/service";
import { withApiKeyAuth, extractApiKey } from "@/lib/auth/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/quiz/[phaseSlug]/[lessonSlug] - Get quiz for a lesson
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
    const { phaseSlug, lessonSlug } = await params;
    const lesson = await getLessonDetails(phaseSlug, lessonSlug);
    if (!lesson) {
      return NextResponse.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const storedQuizzes = lesson.quizzes || [];
    if (storedQuizzes.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          lessonSlug: lesson.slug,
          lessonTitle: lesson.title,
          totalQuestions: 0,
          questions: [],
          message: "No quiz questions available for this lesson",
        },
      });
    }

    const quiz = {
      lessonSlug: lesson.slug,
      lessonTitle: lesson.title,
      totalQuestions: storedQuizzes.length,
      questions: storedQuizzes.map((q) => ({
        id: q.id,
        question: q.questionText,
        options: q.options,
        correctAnswer: String.fromCharCode(65 + q.correctAnswer), // 0->A, 1->B...
        explanation: q.explanation || "",
      })),
      estimatedTime: storedQuizzes.length * 2,
    };

    return NextResponse.json({ success: true, data: quiz });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to generate quiz", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
