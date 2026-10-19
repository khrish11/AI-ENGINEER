import { assessmentCatalog } from "@/lib/assessments/catalog";
import { weakSkillIds, reviewRecommendations, type AttemptLike } from "@/lib/assessments/weak-skills";
import type { QuizAttempt } from "@/lib/progress/db";
import { inPeriod } from "./dates";

/**
 * §17 — assessment analytics grouped per assessment (never one undifferentiated
 * average across incomparable checkpoints) plus per-skill trends.
 */
export interface AssessmentAnalyticsRow {
  assessmentId: string;
  title: string;
  attempts: number;
  bestScore: number | null;
  latestScore: number | null;
  averageRecentScore: number | null;
  improvementTrend: "improving" | "stable" | "declining" | "insufficient";
  skillsTested: string[];
}

export interface AssessmentAnalytics {
  rows: AssessmentAnalyticsRow[];
  weakSkills: string[];
  reviewRecommendations: Array<{ skillId: string; reason: string; detail: string }>;
}

function trendOf(percentages: number[], oldestFirst: number[]): AssessmentAnalyticsRow["improvementTrend"] {
  void percentages;
  if (oldestFirst.length < 2) return "insufficient";
  const first = oldestFirst[0];
  const last = oldestFirst[oldestFirst.length - 1];
  if (last - first >= 10) return "improving";
  if (first - last >= 10) return "declining";
  return "stable";
}

export function assessmentAnalytics(
  attempts: QuizAttempt[],
  options: { periodStart?: string } = {}
): AssessmentAnalytics {
  const periodStart = options.periodStart ?? "0000-01-01T00:00:00.000Z";
  const rows: AssessmentAnalyticsRow[] = [];

  for (const assessment of assessmentCatalog) {
    const scoped = attempts
      .filter((attempt) => attempt.quizId === assessment.id && inPeriod(attempt.startedAt, periodStart))
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const valid = scoped.filter((attempt) => attempt.percentage !== null);
    const percentages = valid.map((attempt) => attempt.percentage as number);
    const recent = percentages.slice(-3);
    rows.push({
      assessmentId: assessment.id,
      title: assessment.title,
      attempts: scoped.length,
      bestScore: percentages.length ? Math.max(...percentages) : null,
      latestScore: percentages.length ? percentages[percentages.length - 1] : null,
      averageRecentScore: recent.length
        ? Math.round(recent.reduce((sum, value) => sum + value, 0) / recent.length)
        : null,
      improvementTrend: trendOf(percentages, percentages),
      skillsTested: [
        ...new Set(assessment.questions.flatMap((question) => question.skills)),
      ].sort(),
    });
  }

  const attemptLikes: AttemptLike[] = attempts
    .filter((attempt) => assessmentCatalog.some((assessment) => assessment.id === attempt.quizId))
    .map((attempt) => ({
      assessmentId: attempt.quizId,
      percentage: attempt.percentage,
      submittedAt: attempt.submittedAt,
      answers: (attempt.answers ?? {}) as AttemptLike["answers"],
    }));
  const assessmentsById = new Map(assessmentCatalog.map((assessment) => [assessment.id, assessment]));

  return {
    rows,
    weakSkills: weakSkillIds(assessmentsById, attemptLikes),
    reviewRecommendations: reviewRecommendations(
      assessmentsById,
      attemptLikes,
      weakSkillIds(assessmentsById, attemptLikes),
      null
    ),
  };
}
