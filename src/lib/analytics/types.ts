import type { LessonProgress, ProjectEvidence, ProjectSelfAssessment, QuizAttempt, ResourceProgress, StudySession, ProjectProgress } from "@/lib/progress/db";
import type { RoadmapPlan } from "@/lib/roadmap/types";

/**
 * §2 — every analytics metric derives from stored learner records. These input
 * interfaces exist so analytics stays pure: hooks load the records, analytics
 * only computes. Period filters (§5) never mutate the sources.
 */
export interface AnalyticsSources {
  lessons: LessonProgress[];
  resources: ResourceProgress[];
  studySessions: StudySession[];
  quizAttempts: QuizAttempt[];
  projectProgress: ProjectProgress[];
  projectEvidence: ProjectEvidence[];
  projectSelfAssessments: ProjectSelfAssessment[];
  roadmapPlan: RoadmapPlan | null;
}

export const PERIODS = ["7d", "30d", "90d", "1y", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "1y": "1 year",
  all: "All time",
};

/** An anchor date (defaults to now) decides what "last N days" means. */
export function periodRange(period: Period, from: Date): Array<{ start: string; label: string }> {
  if (period === "all") {
    return [{ start: "0000-01-01T00:00:00.000Z", label: PERIOD_LABELS.all }];
  }
  const days = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 }[period];
  return [
    {
      start: new Date(from.getTime() - days * 24 * 60 * 60 * 1000).toISOString(),
      label: PERIOD_LABELS[period],
    },
  ];
}

/** Phase 7 §14 — centralized review intervals (days). */
export const REVIEW_INTERVALS_DAYS = [3, 7, 21, 45] as const;
/** §8 — a calendar day counts toward a streak when a valid session ran at least this long. */
export const STREAK_MIN_SESSION_MINUTES = 10;
