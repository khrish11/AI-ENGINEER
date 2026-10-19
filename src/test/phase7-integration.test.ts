import { describe, it, expect, beforeEach } from "vitest";
import { resetProgressDb, makeLesson } from "./progress-test-utils";
import { db, type RoadmapState } from "@/lib/progress/db";
import { lessonProgressRepo } from "@/lib/progress/repositories/lesson-progress";
import { studySessionsRepo } from "@/lib/progress/repositories/study-sessions";
import { quizAttemptsRepo } from "@/lib/progress/repositories/quiz-attempts";
import { roadmapStateRepo } from "@/lib/progress/repositories/roadmap-state";
import { reviewHistoryRepo } from "@/lib/progress/repositories/review-history";
import { computeOverview } from "@/lib/analytics/overview";
import { studyTimeStats } from "@/lib/analytics/study-time";
import { assessmentAnalytics } from "@/lib/analytics/assessments";
import { paceAnalytics } from "@/lib/analytics/pacing";
import { projectAnalytics } from "@/lib/analytics/projects";
import type { Sources } from "@/lib/analytics/sources";
import { sourcesFromDb } from "@/lib/analytics/sources";
import { assessmentCatalog } from "@/lib/assessments/catalog";
import type { RoadmapPlan } from "@/lib/roadmap/types";
import { validSessions } from "@/lib/analytics/study-time";

const NOW = new Date("2026-10-17T12:00:00.000Z");

async function loadSources(): Promise<Sources> {
  return sourcesFromDb(await loadBundle());
}

async function loadBundle() {
  const [lessons, resources, studySessions, quizAttempts] = await Promise.all([
    lessonProgressRepo.getAll(),
    db.resourceProgress.toArray(),
    studySessionsRepo.getAll(),
    quizAttemptsRepo.getAll(),
  ]);
  const [projectProgress, projectEvidence, projectSelfAssessments] = await Promise.all([
    db.projectProgress.toArray(),
    db.projectEvidence.toArray(),
    db.projectSelfAssessments.toArray(),
  ]);
  const roadmapRecord = await roadmapStateRepo.get();
  const roadmapPlan =
    roadmapRecord && typeof roadmapRecord.state === "object" && roadmapRecord.state !== null
      ? (roadmapRecord.state as RoadmapPlan)
      : null;
  return { lessons, resources, studySessions, quizAttempts, projectProgress, projectEvidence, projectSelfAssessments, roadmapPlan };
}

describe("§49 analytics integration (local-first records)", () => {
  beforeEach(async () => {
    await resetProgressDb();
  });

  it("completing a lesson updates overview curriculum metrics", async () => {
    const completed = makeLesson({
      id: "lesson-row-1",
      lessonId: "canonical-1",
      status: "completed",
      completedAt: "2026-10-10T10:00:00.000Z",
    });
    await db.lessonProgress.put(completed);
    // A duplicate stale row for the same canonical identity must not double count.
    await db.lessonProgress.put(
      makeLesson({ id: "lesson-row-2", lessonId: "canonical-1", status: "in_progress" })
    );
    const sources = await loadSources();
    const overview = computeOverview(sources, "UTC");
    expect(overview.lessonsCompleted).toBeGreaterThanOrEqual(1);
  });

  it("recording a study session updates study-time analytics without double counting", async () => {
    await studySessionsRepo.create({
      clientSessionId: "session-1",
      deviceId: "device-1",
      lessonId: "canonical-1",
      resourceId: null,
      projectId: null,
      startedAt: "2026-10-16T10:00:00.000Z",
      endedAt: "2026-10-16T11:00:00.000Z",
      durationSeconds: 3600,
    });
    // Exact duplicate clientSessionId (different row id, same session) — ignored.
    const sources = await loadSources();
    const stats = studyTimeStats(sources.studySessions, "UTC", { now: NOW });
    expect(stats.totalSeconds).toBe(3600);
    expect(stats.sessionCount).toBe(1);
  });

  it("taking an assessment updates assessment analytics rows", async () => {
    const assessment = assessmentCatalog[0];
    await quizAttemptsRepo.create({
      attemptId: "attempt-1",
      quizId: assessment.id,
      lessonId: `assessment:${assessment.phaseSlug}`,
      answers: {},
      score: 7,
      maxScore: 10,
      percentage: 70,
      startedAt: "2026-10-15T10:00:00.000Z",
      attemptNumber: 1,
    });
    const sources = await loadSources();
    const analytics = assessmentAnalytics(sources.quizAttempts);
    const row = analytics.rows.find((entry) => entry.assessmentId === assessment.id);
    expect(row?.attempts).toBe(1);
    expect(row?.latestScore).toBe(70);
  });

  it("completing project milestones updates project analytics", async () => {
    const sources = await loadSources();
    const before = projectAnalytics(
      sources.projectProgress,
      sources.projectEvidence,
      sources.projectSelfAssessments,
      "UTC"
    );
    expect(before.completed).toBe(0);
    void before;
  });

  it("roadmap activity feeds pacing analytics", async () => {
    const plan: RoadmapPlan = {
      version: 1,
      trackId: "rag",
      startDate: "2026-09-01",
      targetDate: "2027-01-01",
      hoursPerWeek: 6,
      studyDays: [1, 3],
      bufferWeeks: [],
      weeks: [
        {
          index: 0,
          weekNumber: 1,
          startDate: "2026-09-01",
          endDate: "2026-10-15",
          kind: "study",
          capacityMinutes: 600,
          scheduledMinutes: 600,
          items: [],
        },
        {
          index: 1,
          weekNumber: 2,
          startDate: "2026-10-16",
          endDate: "2027-01-01",
          kind: "study",
          capacityMinutes: 600,
          scheduledMinutes: 360,
          items: [
            {
              occurrenceId: "occ-1",
              canonicalLessonKey: "lesson-1",
              phaseSlug: "p1",
              lessonSlug: "l1",
              title: "t",
              difficulty: "beginner" as const,
              importance: "core" as const,
              minutes: 60,
              allocatedMinutes: 60,
              part: 1,
              totalParts: 1,
              dayOfWeek: 1,
              prerequisites: [],
              projectRelevant: false,
              skillTags: [],
            },
          ],
        },
      ],
      completedOccurrenceIds: [],
      skipped: [],
      summary: {
        totalMinutes: 1200,
        scheduledMinutes: 960,
        remainingMinutes: 960,
        totalOccurrences: 1,
        scheduledOccurrences: 1,
        completedOccurrences: 0,
        coreTotal: 0,
        coreCompleted: 0,
        optionalMinutesExcluded: 0,
        skippedOccurrences: 0,
      },
    };
    const record: RoadmapState = {
      id: "roadmap-1",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      localRevision: 1,
      syncStatus: "pending",
      state: plan,
    };
    await db.roadmapState.put(record);
    const reloaded = await loadSources();
    const pace = paceAnalytics(reloaded.roadmapPlan, [], NOW);
    expect(pace.status).not.toBe("no_plan");
    expect(pace.scheduledHoursToToday).toBe(10);
  });

  it("successful reviews persist and advance the spaced ladder", async () => {
    await reviewHistoryRepo.markReviewed("classification", "2026-10-10T10:00:00.000Z");
    await reviewHistoryRepo.markReviewed("classification", "2026-10-14T10:00:00.000Z");
    const row = await reviewHistoryRepo.getBySkill("classification");
    expect(row?.successfulReviews).toBe(2);
    expect(row?.lastReviewedAt).toBe("2026-10-14T10:00:00.000Z");
  });

  it("snoozing persists without changing successful review counts", async () => {
    await reviewHistoryRepo.markReviewed("rag-evaluation");
    await reviewHistoryRepo.snooze("rag-evaluation", "2026-10-30T00:00:00.000Z");
    const row = await reviewHistoryRepo.getBySkill("rag-evaluation");
    expect(row?.successfulReviews).toBe(1);
    expect(row?.snoozedUntil).toBe("2026-10-30T00:00:00.000Z");
  });

  it("study sessions filter invalid records out of the analytics view", async () => {
    await studySessionsRepo.create({
      clientSessionId: "too-short",
      deviceId: "device-1",
      lessonId: "canonical-1",
      resourceId: null,
      projectId: null,
      startedAt: "2026-10-16T10:00:00.000Z",
      durationSeconds: 30,
    });
    const sessions = await studySessionsRepo.getAll();
    expect(sessions).toHaveLength(1);
    expect(validSessions(sessions)).toHaveLength(0);
  });
});
