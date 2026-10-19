import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { canonicalLessons, canonicalPhases, quizzes } from "@/db/schema";
import { occurrences } from "@/lib/roadmap/config";

export const dynamic = "force-dynamic";

const TARGET_PHASES = [
  "00-setup-and-tooling",
  "01-math-foundations",
  "02-ml-fundamentals",
  "03-deep-learning-core",
];

const QUESTION_LIMIT = 6;

const AnswersSchema = z.object({
  answers: z.record(z.string().min(1), z.number().int().min(-1).max(10)),
});

interface PlacementQuestion {
  id: string;
  questionText: string;
  options: string[];
  phaseSlug: string;
  correctAnswer: number;
  skillTags: string[];
}

async function loadQuestions(): Promise<PlacementQuestion[]> {
  const rows = await db
    .select({
      id: quizzes.id,
      questionText: quizzes.questionText,
      options: quizzes.options,
      correctAnswer: quizzes.correctAnswer,
      currentSlug: canonicalLessons.currentSlug,
      phaseSlug: canonicalPhases.defaultSlug,
      phaseNumber: canonicalPhases.phaseNumber,
    })
    .from(quizzes)
    .innerJoin(canonicalLessons, eq(quizzes.canonicalLessonId, canonicalLessons.id))
    .innerJoin(canonicalPhases, eq(canonicalLessons.canonicalPhaseId, canonicalPhases.id))
    .where(
      and(
        inArray(canonicalPhases.defaultSlug, TARGET_PHASES),
        eq(canonicalLessons.isDeprecated, false)
      )
    )
    .orderBy(asc(canonicalPhases.phaseNumber), asc(canonicalLessons.currentSlug), asc(quizzes.questionOrder))
    .limit(60);

  // Deterministic spread: take one question per lesson, up to the limit.
  const seenLessons = new Set<string>();
  const picked: PlacementQuestion[] = [];
  for (const row of rows) {
    if (seenLessons.has(row.currentSlug)) continue;
    if (picked.length >= QUESTION_LIMIT) break;
    seenLessons.add(row.currentSlug);
    const occurrence = occurrences.find((item) => item.occurrenceId === row.currentSlug);
    picked.push({
      id: row.id,
      questionText: row.questionText,
      options: (row.options as string[]) ?? [],
      phaseSlug: row.phaseSlug,
      correctAnswer: row.correctAnswer,
      skillTags: occurrence?.skillTags ?? [],
    });
  }
  return picked;
}

export async function GET() {
  try {
    const questions = await loadQuestions();
    return NextResponse.json({
      questions: questions.map(({ correctAnswer: _correctAnswer, ...question }) => question),
      total: questions.length,
    });
  } catch (error) {
    console.warn("Failed to load placement questions:", error);
    return NextResponse.json({ questions: [], total: 0 });
  }
}

export async function POST(request: Request) {
  let body: z.infer<typeof AnswersSchema>;
  try {
    body = AnswersSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid placement payload." }, { status: 400 });
  }

  try {
    const questions = await loadQuestions();
    let correct = 0;
    const weakSkills = new Set<string>();

    for (const question of questions) {
      const given = body.answers[question.id];
      if (given === undefined || given < 0) continue;
      if (given === question.correctAnswer) {
        correct += 1;
      } else {
        // The skills this question exercised are the ones worth reviewing.
        for (const skill of question.skillTags.slice(0, 2)) weakSkills.add(skill);
      }
    }

    return NextResponse.json({
      correct,
      total: questions.length,
      weakSkillIds: [...weakSkills].sort(),
    });
  } catch (error) {
    console.warn("Failed to grade placement answers:", error);
    return NextResponse.json({ error: "Placement grading unavailable." }, { status: 500 });
  }
}
