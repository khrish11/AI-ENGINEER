import { NextRequest, NextResponse } from "next/server";
import { getLessonDetails } from "@/lib/curriculum/service";
import { withApiKeyAuth } from "@/lib/auth/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/quiz/[phaseSlug]/[lessonSlug] - Get quiz for a lesson
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
    const lesson = await getLessonDetails(params.phaseSlug, params.lessonSlug);
    if (!lesson) {
      return NextResponse.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    // Generate quiz questions based on lesson content
    const quiz = generateQuizFromLesson(lesson);

    return NextResponse.json({ success: true, data: quiz });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to generate quiz", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function generateQuizFromLesson(lesson: any) {
  const objectives = lesson.learningObjectives || [];
  const quizQuestions = objectives.slice(0, 5).map((objective: string, index: number) => ({
    id: `q${index + 1}`,
    question: `Based on this learning objective: "${objective}", which concept is most relevant?`,
    options: [
      generateOption(objective, "A"),
      generateOption(objective, "B"),
      generateOption(objective, "C"),
      generateOption(objective, "D"),
    ],
    correctAnswer: "A", // In production, this would be intelligently generated
    explanation: `This question tests understanding of: ${objective}`,
  }));

  return {
    lessonSlug: lesson.slug,
    lessonTitle: lesson.title,
    totalQuestions: quizQuestions.length,
    questions: quizQuestions,
    estimatedTime: quizQuestions.length * 2, // 2 minutes per question
  };
}

function generateOption(objective: string, letter: string): string {
  const keywords = objective.split(" ").filter((w: string) => w.length > 4);
  const keyword = keywords[Math.floor(Math.random() * keywords.length)] || "concept";
  return `Option ${letter}: ${keyword} based understanding`;
}
