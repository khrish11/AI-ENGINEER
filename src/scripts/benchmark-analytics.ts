/**
 * Phase 7 §55/§58 — analytics scale benchmark.
 *
 * Generates a synthetic learner dataset roughly equivalent to:
 *   500 lessons · 1,000 resource interactions · 5,000 study sessions ·
 *   1,000 assessment attempts · 100 project milestones
 * and measures core analytics aggregation + portfolio serialization.
 *
 * Synthetic data lives only in memory — nothing here touches seed files or
 * the production databases (§55).
 */
import { performance } from "node:perf_hooks";
import { curriculumProgress } from "@/lib/analytics/curriculum";
import { studyTimeStats, studyTimeByDimension } from "@/lib/analytics/study-time";
import { streakStats } from "@/lib/analytics/streaks";
import { skillAnalytics } from "@/lib/analytics/skills";
import { paceAnalytics } from "@/lib/analytics/pacing";
import { projectAnalytics } from "@/lib/analytics/projects";
import { assessmentAnalytics } from "@/lib/analytics/assessments";
import { buildReviewQueue } from "@/lib/analytics/review";
import { computeOverview } from "@/lib/analytics/overview";
import { deriveAchievements } from "@/lib/analytics/achievements";
import { buildPublicPortfolio } from "@/lib/portfolio/public-view";
import { roadmapSkillOccurrences } from "@/lib/analytics/review";
import { occurrences } from "@/lib/roadmap/config";
import { assessmentCatalog } from "@/lib/assessments/catalog";
import type { AnalyticsSources } from "@/lib/analytics/types";

const NODE = 5_000;
const LESSONS = 500;
const RESOURCES = 1_000;
const ATTEMPTS = 1_000;
const MILESTONES = 100;

function syntheticSources(): AnalyticsSources {
  const lessons: AnalyticsSources["lessons"] = [];
  for (let i = 0; i < LESSONS && i < occurrences.length; i += 1) {
    const occurrence = occurrences[i % occurrences.length];
    lessons.push({
      id: `lesson-${i}`,
      createdAt: "2025-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      localRevision: 1,
      syncStatus: "synced",
      lessonId: occurrence.canonicalLessonKey,
      status: i % 3 === 0 ? "mastered" : i % 3 === 1 ? "completed" : "in_progress",
      readingComplete: true,
      requiredResourcesComplete: true,
      practiceComplete: i % 3 !== 2,
      projectComplete: false,
      masteryScore: i % 3 === 2 ? null : 50 + (i % 50),
      needsReview: i % 7 === 0,
      startedAt: "2025-10-01T00:00:00.000Z",
      completedAt: "2025-11-01T00:00:00.000Z",
      masteredAt: i % 3 === 0 ? "2025-12-01T00:00:00.000Z" : null,
    });
  }

  const resources: AnalyticsSources["resources"] = [];
  for (let i = 0; i < RESOURCES; i += 1) {
    resources.push({
      id: `resource-row-${i}`,
      createdAt: "2025-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      localRevision: 1,
      syncStatus: "synced",
      resourceId: `resource-${i % 152}`,
      resourceType: `type-${i % 6}`,
      resourceTitle: null,
      href: null,
      started: i % 2 === 0,
      completed: i % 4 === 0,
      bookmarked: false,
      githubState: null,
      completedAt: "2026-01-01T00:00:00.000Z",
      lastOpenedAt: "2026-09-01T00:00:00.000Z",
      notes: null,
    });
  }

  const studySessions: AnalyticsSources["studySessions"] = [];
  const base = Date.parse("2026-01-01T00:00:00.000Z");
  for (let i = 0; i < NODE; i += 1) {
    const startedAt = new Date(
      base + Math.floor((i / NODE) * Date.parse("2026-10-16T00:00:00.000Z") - base)
    ).toISOString();
    studySessions.push({
      id: `session-${Math.floor(i / 4)}`,
      createdAt: startedAt,
      updatedAt: startedAt,
      localRevision: 1,
      syncStatus: "synced",
      clientSessionId: `session-domain-${i % Math.max(LESSONS + NODE, 1)}`,
      deviceId: `device-${i % 3}`,
      lessonId: i % 5 === 0 ? null : `lesson-${i % LESSONS}`,
      resourceId: i % 5 === 0 ? `resource-${i % RESOURCES}` : null,
      projectId: i % 10 === 0 ? "project-1" : null,
      startedAt,
      endedAt: startedAt,
      durationSeconds: 300 + (i % 5400),
    });
  }

  const quizAttempts: AnalyticsSources["quizAttempts"] = [];
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const assessment = assessmentCatalog[i % assessmentCatalog.length];
    const submittedAt = new Date(base + (i % 280) * 86400000).toISOString();
    quizAttempts.push({
      id: `attempt-${i}`,
      createdAt: submittedAt,
      updatedAt: submittedAt,
      localRevision: 1,
      syncStatus: "synced",
      attemptId: `attempt-domain-${i}`,
      quizId: assessment.id,
      lessonId: `assessment:${i % assessmentCatalog.length}`,
      answers: {},
      score: 3,
      maxScore: 10,
      percentage: 20 + (i % 80),
      startedAt: submittedAt,
      submittedAt,
      attemptNumber: i,
    });
  }

  const projectProgress: AnalyticsSources["projectProgress"] = [];
  for (let i = 0; i < MILESTONES; i += 1) {
    projectProgress.push({
      id: `milestone-${i}`,
      createdAt: "2025-10-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      localRevision: 1,
      syncStatus: "synced",
      projectId: `project-${i % 24}`,
      milestoneId: `milestone-${i}`,
      completed: i % 2 === 0,
      completedAt: i % 2 === 0 ? "2026-06-01T00:00:00.000Z" : null,
      evidenceUrl: null,
      notes: null,
    });
  }

  return {
    lessons,
    resources,
    studySessions,
    quizAttempts,
    projectProgress,
    projectEvidence: [],
    projectSelfAssessments: [],
    roadmapPlan: null,
  };
}

async function main() {
  const sources = syntheticSources();
  const timings: Record<string, number> = {};

  const timer = <T>(name: string, fn: () => T, rounds = 1): T => {
    const start = performance.now();
    let result: T | undefined;
    for (let round = 0; round < rounds; round += 1) result = fn();
    timings[name] = Math.round((performance.now() - start) * 100) / 100 / rounds;
    return result as T;
  };

  const timeZone = "UTC";
  timer("overview", () => computeOverview(sources, timeZone));
  timer("curriculum", () => curriculumProgress(sources.lessons), 3);
  timer("studyTime", () => studyTimeStats(sources.studySessions, timeZone), 3);
  timer(
    "studyTimeByDimension",
    () =>
      studyTimeByDimension(
        sources.studySessions,
        (session) => session.lessonId ?? "no lesson",
        timeZone
      ),
    3
  );
  timer("streaks", () => streakStats(sources.studySessions, timeZone), 3);
  timer(
    "skills",
    () =>
      skillAnalytics({
        lessonProgress: sources.lessons,
        attempts: sources.quizAttempts.map((attempt) => ({
          assessmentId: attempt.quizId,
          percentage: attempt.percentage,
          submittedAt: attempt.submittedAt,
          answers: (attempt.answers ?? {}) as Record<string, unknown>,
        })) as never,
        projectProgress: [...new Set(sources.projectProgress.map((row) => row.projectId))].map(
          (projectId) => ({ projectId, completed: true })
        ),
        reviewHistory: new Map(),
      }),
    2
  );
  timer("projects", () =>
    projectAnalytics(
      sources.projectProgress,
      sources.projectEvidence,
      sources.projectSelfAssessments,
      timeZone
    )
  );
  timer("assessments", () => assessmentAnalytics(sources.quizAttempts));
  timer("pace", () => paceAnalytics(null, sources.studySessions));
  timer(
    "achievements",
    () =>
      deriveAchievements({
        lessons: sources.lessons,
        studySessions: sources.studySessions,
        quizAttempts: sources.quizAttempts,
        projectProgress: sources.projectProgress,
        projectEvidence: sources.projectEvidence,
      }),
    2
  );
  timer(
    "reviewQueue",
    () =>
      buildReviewQueue(
        {
          attempts: sources.quizAttempts.map((attempt) => ({
            assessmentId: attempt.quizId,
            percentage: attempt.percentage,
            submittedAt: attempt.submittedAt,
            answers: {},
          })) as never,
          projectSkillAssociations: new Map(),
          reviewHistory: new Map(),
          manuallyFlagged: new Set(),
          roadmapSkillOccurrences: roadmapSkillOccurrences(),
        },
        new Date()
      )
  );
  timer(
    "portfolioSerialization",
    () =>
      buildPublicPortfolio(
        {
          settings: {
            visibility: {
              careerTrack: true,
              skills: true,
              projects: true,
              achievements: true,
              curriculumProgress: true,
              studyTime: true,
              assessments: true,
              exposeSelfAssessment: true,
              exposeProjectLinks: true,
            },
            publicProjectIds: ["project-1"],
            publicEvidenceIds: [],
            publicAchievementIds: [],
            publicSkillIds: [],
            careerTrackId: null,
          },
          skills: null,
          achievements: [],
          projectSources: new Map(),
          canonicalLessonsCompleted: 120,
          careerTrackFromRoadmap: "rag",
          assessments: { attempts: 20, latestPercentage: 88 },
          studyHours: 320,
        },
        new Date().toISOString()
      ),
    5
  );

  const slowest = Object.entries(timings).sort((a, b) => b[1] - a[1])[0];
  const totalDerivation = Object.entries(timings)
    .filter(([name]) => name !== "portfolioSerialization")
    .reduce((sum, [, value]) => sum + value, 0);

  console.log("== Phase 7 §55/§58 analytics benchmark ==");
  console.log(
    `dataset: ${sources.lessons.length} lessons, ${sources.resources.length} resource interactions, ${sources.studySessions.length} study sessions, ${sources.quizAttempts.length} attempts, ${sources.projectProgress.length} milestones`
  );
  for (const [name, ms] of Object.entries(timings).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name.padEnd(24)} ${ms}ms`);
  }
  console.log(`total core derivation: ${totalDerivation}ms`);
  console.log(`slowest operation: ${slowest[0]} (${slowest[1]}ms)`);
  console.log(
    `§54 target < 200ms for normal learner datasets (this synthetic dataset is larger scale).`
  );
}

void main();
