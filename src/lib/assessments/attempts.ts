import { db, type QuizAttempt } from "@/lib/progress/db";
import { createBase, nowIso } from "@/lib/progress/records";
import { syncQueue } from "@/lib/progress/sync-queue";
import type { AnswerMap, Assessment } from "./schema";
import type { ScoredAssessment } from "./scoring";

/** Platform assessments reuse the Phase 4 attempt registry (§22): attempt
 * rows are immutable; a new submission always creates a new attempt row. */
export async function recordAssessmentAttempt(input: {
  assessment: Assessment;
  answers: AnswerMap;
  scored: ScoredAssessment;
  startedAt: string;
}): Promise<QuizAttempt> {
  const existing = await db.quizAttempts
    .where("quizId")
    .equals(input.assessment.id)
    .toArray();
  const attemptNumber = existing.length + 1;
  const now = nowIso();
  const record: QuizAttempt = {
    ...createBase(),
    attemptId: `${input.assessment.id}#${attemptNumber}`,
    quizId: input.assessment.id,
    lessonId: `assessment:${input.assessment.phaseSlug}`,
    answers: input.answers as unknown,
    score: input.scored.earned,
    maxScore: input.scored.max,
    percentage: input.scored.percentage,
    startedAt: input.startedAt,
    submittedAt: now,
    attemptNumber,
  };
  await db.quizAttempts.put(record);
  await syncQueue.enqueue({
    entityType: "quiz_attempt",
    entityId: record.id,
    operation: "create",
    payload: {
      attemptId: record.attemptId,
      quizId: record.quizId,
      lessonId: record.lessonId,
      score: record.score,
      maxScore: record.maxScore,
      percentage: record.percentage,
      startedAt: record.startedAt,
      submittedAt: record.submittedAt,
      attemptNumber: record.attemptNumber,
      answers: record.answers,
    },
    baseRevision: record.localRevision,
  });
  return record;
}

export async function getAttemptsByAssessment(assessmentId: string): Promise<QuizAttempt[]> {
  const rows = await db.quizAttempts.where("quizId").equals(assessmentId).toArray();
  return rows.sort((a, b) => a.attemptNumber - b.attemptNumber);
}

export async function getAllAssessmentAttempts(): Promise<QuizAttempt[]> {
  return db.quizAttempts.toArray();
}
