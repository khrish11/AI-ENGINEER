"use client";

/**
 * §39 — analytics hooks. Each hook loads learner records from Dexie and feeds
 * the pure analytics modules (§3). Derived metrics are memoized on the loaded
 * bundle, so re-renders never re-aggregate (§54).
 */
import { useEffect, useMemo, useState } from "react";
import { lessonProgressRepo } from "@/lib/progress/repositories/lesson-progress";
import { studySessionsRepo } from "@/lib/progress/repositories/study-sessions";
import { quizAttemptsRepo } from "@/lib/progress/repositories/quiz-attempts";
import { projectProgressRepo } from "@/lib/progress/repositories/project-progress";
import { projectEvidenceRepo } from "@/lib/progress/repositories/project-evidence";
import { projectSelfAssessmentRepo } from "@/lib/progress/repositories/project-self-assessment";
import { reviewHistoryRepo } from "@/lib/progress/repositories/review-history";
import { roadmapStateRepo } from "@/lib/progress/repositories/roadmap-state";
import { db } from "@/lib/progress/db";
import type {
  LessonProgress,
  ProjectEvidence,
  ProjectProgress,
  ProjectSelfAssessment,
  QuizAttempt,
  ReviewHistory,
} from "@/lib/progress/db";
import type { RoadmapPlan } from "@/lib/roadmap/types";
import { PERIODS, type Period } from "@/lib/analytics/types";
import type { AnalyticsOverview } from "@/lib/analytics/overview";
import type { StudyTimeStats } from "@/lib/analytics/study-time";
import type { ProjectAnalytics } from "@/lib/analytics/projects";
import type { SkillEvidenceSummary } from "@/lib/analytics/skills";
import type { AssessmentAnalytics } from "@/lib/analytics/assessments";
import type { PaceAnalytics } from "@/lib/analytics/pacing";
import type { ReviewItem } from "@/lib/analytics/review";
import type { Achievement } from "@/lib/analytics/achievements";
import type { StreakStats } from "@/lib/analytics/streaks";
import { computeOverview } from "@/lib/analytics/overview";
import { studyTimeStats, studyTimeByDimension, type StudyTimeByDimension } from "@/lib/analytics/study-time";
import { streakStats } from "@/lib/analytics/streaks";
import { paceAnalytics } from "@/lib/analytics/pacing";
import { projectAnalytics } from "@/lib/analytics/projects";
import { assessmentAnalytics } from "@/lib/analytics/assessments";
import { skillAnalytics, type SkillAnalyticsInputs } from "@/lib/analytics/skills";
import { buildReviewQueue, roadmapSkillOccurrences } from "@/lib/analytics/review";
import { deriveAchievements } from "@/lib/analytics/achievements";
import { projectCatalog } from "@/lib/projects/catalog";

// ---------------------------------------------------------------------------
// Source loading
// ---------------------------------------------------------------------------

export interface AnalyticsSources {
  lessons: LessonProgress[];
  resources: Array<{
    resourceId: string;
    resourceType: string | null;
    resourceTitle: string | null;
  }>;
  studySessions: Parameters<typeof studyTimeStats>[0];
  quizAttempts: QuizAttempt[];
  projectProgress: ProjectProgress[];
  projectEvidence: ProjectEvidence[];
  projectSelfAssessments: ProjectSelfAssessment[];
  roadmapPlan: RoadmapPlan | null;
}

export interface AnalyticsBundle {
  sources: AnalyticsSources;
  reviewHistory: ReviewHistory[];
}

async function loadSources(): Promise<AnalyticsBundle> {
  const [lessons, resourceRows, studySessions, quizAttempts] = await Promise.all([
    lessonProgressRepo.getAll(),
    db.resourceProgress.toArray(),
    studySessionsRepo.getAll(),
    quizAttemptsRepo.getAll(),
  ]);
  const [projectProgress, projectEvidence, projectSelfAssessments, reviewHistory] =
    await Promise.all([
      projectProgressRepo.getAll(),
      projectEvidenceRepo.getAll(),
      projectSelfAssessmentRepo.getAll(),
      reviewHistoryRepo.getAll(),
    ]);
  const roadmapRecord = await roadmapStateRepo.get();
  const roadmapPlan =
    roadmapRecord && typeof roadmapRecord.state === "object" && roadmapRecord.state !== null
      ? (roadmapRecord.state as RoadmapPlan)
      : null;
  return {
    sources: {
      lessons,
      resources: resourceRows.map((row) => ({
        resourceId: row.resourceId,
        resourceType: row.resourceType ?? null,
        resourceTitle: row.resourceTitle ?? null,
      })),
      studySessions,
      quizAttempts,
      projectProgress,
      projectEvidence,
      projectSelfAssessments,
      roadmapPlan,
    },
    reviewHistory,
  };
}

/** Loads the analytics source bundle once; refetch reloads from Dexie. */
export function useAnalyticsSources() {
  const [bundle, setBundle] = useState<AnalyticsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadSources()
      .then((next) => {
        if (cancelled) return;
        setBundle(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refetch = () => setReloadKey((key) => key + 1);
  return { bundle, loading, error, refetch };
}

// ---------------------------------------------------------------------------
// Period filters (§5 — never mutate source data)
// ---------------------------------------------------------------------------

const PERIOD_DAYS: Record<Exclude<Period, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

export function periodStartIso(period: Period, now: Date): string {
  if (period === "all") return "0000-01-01T00:00:00.000Z";
  return new Date(now.getTime() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000).toISOString();
}

export function useAnalyticsPeriod(defaultPeriod: Period = "all") {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const now = useMemo(() => new Date(), []);
  const periodStart = useMemo(() => periodStartIso(period, now), [period, now]);
  return { period, setPeriod, periodStart, availablePeriods: PERIODS, now };
}

// ---------------------------------------------------------------------------
// Review-history helpers shared by skills + review queue
// ---------------------------------------------------------------------------

function lastReviewedMap(rows: ReviewHistory[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.lastReviewedAt) map.set(row.skillId, row.lastReviewedAt);
  }
  return map;
}

function attemptLikesFromQuiz(attempts: QuizAttempt[]): SkillAnalyticsInputs["attempts"] {
  return attempts.map((attempt) => ({
    assessmentId: attempt.quizId,
    percentage: attempt.percentage,
    submittedAt: attempt.submittedAt,
    answers: (attempt.answers ?? {}) as Record<string, unknown>,
  })) as unknown as SkillAnalyticsInputs["attempts"];
}

// ---------------------------------------------------------------------------
// Overview (§4 Overview)
// ---------------------------------------------------------------------------

export function useAnalyticsOverview(
  bundle: AnalyticsBundle | null,
  timeZone: string,
  periodStart: string
) {
  return useMemo<AnalyticsOverview | null>(() => {
    if (!bundle) return null;
    void periodStart;
    return computeOverview(
      {
        lessons: bundle.sources.lessons,
        resources: [],
        studySessions: bundle.sources.studySessions,
        quizAttempts: bundle.sources.quizAttempts,
        projectProgress: bundle.sources.projectProgress,
        projectEvidence: bundle.sources.projectEvidence,
        projectSelfAssessments: bundle.sources.projectSelfAssessments,
        roadmapPlan: bundle.sources.roadmapPlan,
      } as never,
      timeZone
    );
  }, [bundle, timeZone, periodStart]);
}

/** Overview includes per-skill band counts (injected here from the skills hook data). */
export function useOverviewSkillCounts(
  bundle: AnalyticsBundle | null,
  skillRows: SkillEvidenceSummary[] | null
) {
  return useMemo(() => {
    if (!bundle || !skillRows) return null;
    let developing = 0;
    let proficient = 0;
    let strong = 0;
    for (const row of skillRows) {
      const band = row.mastery?.band ?? null;
      if (band === "developing") developing += 1;
      else if (band === "proficient") proficient += 1;
      else if (band === "strong") strong += 1;
    }
    return { developing, proficient, strong };
  }, [bundle, skillRows]);
}

// ---------------------------------------------------------------------------
// Study time (§7)
// ---------------------------------------------------------------------------

export interface UseStudyAnalyticsResult {
  stats: StudyTimeStats;
  byPhase: StudyTimeByDimension;
  byProject: StudyTimeByDimension;
  byResourceType: StudyTimeByDimension;
}

export function useStudyAnalytics(
  bundle: AnalyticsBundle | null,
  timeZone: string,
  periodStart: string
): UseStudyAnalyticsResult | null {
  return useMemo(() => {
    if (!bundle) return null;
    const sessions = bundle.sources.studySessions;
    const phaseByLesson = new Map(
      bundle.sources.lessons.map((row) => [row.lessonId, row.phaseSlug ?? "other"])
    );
    const typeByResource = new Map(
      bundle.sources.resources.map((row) => [row.resourceId, row.resourceType ?? "unknown"])
    );
    return {
      stats: studyTimeStats(sessions, timeZone, { periodStart }),
      byPhase: studyTimeByDimension(
        sessions,
        (session) => phaseByLesson.get(session.lessonId ?? "") ?? "no lesson",
        timeZone,
        { periodStart }
      ),
      byProject: studyTimeByDimension(
        sessions,
        (session) => session.projectId ?? "no project",
        timeZone,
        { periodStart }
      ),
      byResourceType: studyTimeByDimension(
        sessions,
        (session) => (session.resourceId ? typeByResource.get(session.resourceId) ?? "resource" : "lesson"),
        timeZone,
        { periodStart }
      ),
    };
  }, [bundle, timeZone, periodStart]);
}

// ---------------------------------------------------------------------------
// Streaks (§8)
// ---------------------------------------------------------------------------

export function useStreaks(bundle: AnalyticsBundle | null, timeZone: string): StreakStats | null {
  return useMemo(() => {
    if (!bundle) return null;
    return streakStats(bundle.sources.studySessions, timeZone);
  }, [bundle, timeZone]);
}

// ---------------------------------------------------------------------------
// Skills (§9–§12)
// ---------------------------------------------------------------------------

export function useSkillAnalytics(bundle: AnalyticsBundle | null): {
  skills: SkillEvidenceSummary[];
  weakSkills: string[];
} | null {
  return useMemo(() => {
    if (!bundle) return null;
    return skillAnalytics({
      lessonProgress: bundle.sources.lessons,
      attempts: attemptLikesFromQuiz(bundle.sources.quizAttempts),
      projectProgress: completedProjectsFromProgress(bundle),
      reviewHistory: lastReviewedMap(bundle.reviewHistory),
    });
  }, [bundle]);
}

/** Project-level completion per catalog project from real milestone rows. */
function completedProjectsFromProgress(
  bundle: AnalyticsBundle
): SkillAnalyticsInputs["projectProgress"] {
  // Completed = every milestone row for the project is completed (real rows).
  const byProject = new Map<string, { total: number; done: number }>();
  for (const row of bundle.sources.projectProgress) {
    const entry = byProject.get(row.projectId) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (row.completed) entry.done += 1;
    byProject.set(row.projectId, entry);
  }
  const completedMilestonesRequired = new Map<string, number>();
  for (const project of projectCatalog) {
    completedMilestonesRequired.set(
      project.id,
      project.milestones.filter((milestone) => milestone.required).length
    );
  }
  return [...byProject.entries()].map(([projectId, entry]) => {
    const required = completedMilestonesRequired.get(projectId) ?? 0;
    const completedAll = entry.done > 0 && entry.done >= entry.total && entry.total >= required;
    return { projectId, completed: completedAll };
  });
}

// ---------------------------------------------------------------------------
// Roadmap pace (§15/§16)
// ---------------------------------------------------------------------------

export function useRoadmapPace(bundle: AnalyticsBundle | null): PaceAnalytics | null {
  return useMemo(() => {
    if (!bundle) return null;
    return paceAnalytics(bundle.sources.roadmapPlan, bundle.sources.studySessions);
  }, [bundle]);
}

// ---------------------------------------------------------------------------
// Projects (§18)
// ---------------------------------------------------------------------------

export function useProjectAnalytics(
  bundle: AnalyticsBundle | null,
  timeZone: string,
  periodStart: string
): ProjectAnalytics | null {
  return useMemo(() => {
    if (!bundle) return null;
    return projectAnalytics(
      bundle.sources.projectProgress,
      bundle.sources.projectEvidence,
      bundle.sources.projectSelfAssessments,
      timeZone,
      { periodStart }
    );
  }, [bundle, timeZone, periodStart]);
}

// ---------------------------------------------------------------------------
// Assessments (§17)
// ---------------------------------------------------------------------------

export function useAssessmentAnalytics(
  bundle: AnalyticsBundle | null,
  periodStart: string
): AssessmentAnalytics | null {
  return useMemo(() => {
    if (!bundle) return null;
    return assessmentAnalytics(bundle.sources.quizAttempts, { periodStart });
  }, [bundle, periodStart]);
}

// ---------------------------------------------------------------------------
// Review queue (§13/§14)
// ---------------------------------------------------------------------------

export function useReviewQueue(bundle: AnalyticsBundle | null): ReviewItem[] | null {
  return useMemo(() => {
    if (!bundle) return null;
    // Projects in progress per skill association.
    const projectAssociations = new Map<string, { inProgress: boolean; projectTitles: string[] }>();
    for (const project of projectCatalog) {
      for (const skillId of project.skills) {
        const entry = projectAssociations.get(skillId) ?? { inProgress: false, projectTitles: [] };
        entry.projectTitles.push(project.title);
        projectAssociations.set(skillId, entry);
      }
    }
    const inProgressProjects = new Set(
      bundle.sources.projectProgress
        .filter((row) => row.completed === false)
        .map((row) => row.projectId)
    );
    for (const [skillId, entry] of projectAssociations) {
      const projectsWithSkill = projectCatalog.filter((project) => project.skills.includes(skillId));
      entry.inProgress = projectsWithSkill.some((project) => inProgressProjects.has(project.id));
      projectAssociations.set(skillId, entry);
    }

    const flagged = new Set(
      bundle.sources.lessons.filter((lesson) => lesson.needsReview).map((lesson) => lesson.lessonId)
    );

    return buildReviewQueue({
      attempts: attemptLikesFromQuiz(bundle.sources.quizAttempts),
      projectSkillAssociations: projectAssociations,
      reviewHistory: lastReviewedMap(bundle.reviewHistory),
      manuallyFlagged: flagged,
      roadmapSkillOccurrences: roadmapSkillOccurrences(),
    });
  }, [bundle]);
}

// ---------------------------------------------------------------------------
// Achievements (§19/§20)
// ---------------------------------------------------------------------------

export function useAchievements(bundle: AnalyticsBundle | null): Achievement[] | null {
  return useMemo(() => {
    if (!bundle) return null;
    return deriveAchievements({
      lessons: bundle.sources.lessons,
      studySessions: bundle.sources.studySessions,
      quizAttempts: bundle.sources.quizAttempts,
      projectProgress: bundle.sources.projectProgress,
      projectEvidence: bundle.sources.projectEvidence,
    });
  }, [bundle]);
}
