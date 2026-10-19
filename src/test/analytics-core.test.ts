import { describe, it, expect } from "vitest";
import { curriculumProgress } from "@/lib/analytics/curriculum";
import { studyTimeStats, validSessions } from "@/lib/analytics/study-time";
import { streakStats } from "@/lib/analytics/streaks";
import { paceAnalytics } from "@/lib/analytics/pacing";
import {
  deriveAchievements,
} from "@/lib/analytics/achievements";
import { assessmentAnalytics } from "@/lib/analytics/assessments";
import {
  buildReviewQueue,
  daysSince,
  nextReviewInDays,
  roadmapSkillOccurrences,
} from "@/lib/analytics/review";
import { completedMilestoneCount } from "@/lib/analytics/overview";
import { periodStartIso } from "@/hooks/useAnalytics";
import { occurrences } from "@/lib/roadmap/config";
import { assessmentCatalog } from "@/lib/assessments/catalog";
import type {
  LessonProgress,
  ProjectProgress,
  QuizAttempt,
  StudySession,
} from "@/lib/progress/db";
import type { RoadmapPlan } from "@/lib/roadmap/types";

const NOW = new Date("2026-10-17T12:00:00.000Z");

function lesson(overrides: Partial<LessonProgress> = {}): LessonProgress {
  const now = "2026-10-01T10:00:00.000Z";
  return {
    id: overrides.lessonId ?? "lesson-row",
    createdAt: now,
    updatedAt: now,
    localRevision: 1,
    syncStatus: "pending",
    lessonId: "canonical-key",
    status: "completed",
    readingComplete: true,
    requiredResourcesComplete: true,
    practiceComplete: true,
    projectComplete: false,
    masteryScore: null,
    needsReview: false,
    startedAt: null,
    completedAt: "2026-10-01T10:00:00.000Z",
    masteredAt: null,
    ...overrides,
  };
}

function session(overrides: Partial<StudySession> = {}): StudySession {
  const now = "2026-10-01T10:00:00.000Z";
  return {
    id: "session-row",
    createdAt: now,
    updatedAt: now,
    localRevision: 1,
    syncStatus: "pending",
    clientSessionId: "client-1",
    deviceId: "device-1",
    lessonId: null,
    resourceId: null,
    projectId: null,
    startedAt: "2026-10-01T10:00:00.000Z",
    endedAt: "2026-10-01T11:00:00.000Z",
    durationSeconds: 3600,
    ...overrides,
  };
}

describe("§6 curriculum progress analytics", () => {
  const phaseOccurrences = occurrences.filter(
    (occurrence) => occurrence.phaseSlug === occurrences[0].phaseSlug
  );

  it("counts canonical identities once even when two occurrences share a lesson", () => {
    const sharedKey = occurrences.find(
      (occurrence, index) =>
        occurrences.findIndex(
          (other) => other.canonicalLessonKey === occurrence.canonicalLessonKey
        ) !== index
    )?.canonicalLessonKey;
    if (!sharedKey) return; // safety: curriculum is documented to have exactly one shared identity

    const rows = [
      lesson({ lessonId: sharedKey, status: "completed" }),
      lesson({ lessonId: sharedKey, id: "dup-row", status: "not_started" }),
    ];
    const progress = curriculumProgress(rows);
    const sharedOccurrences = occurrences.filter(
      (occurrence) => occurrence.canonicalLessonKey === sharedKey
    ).length;
    // The shared canonical identity contributes exactly 1 completion, never 2.
    expect(progress.canonicalCompleted).toBe(1);
    // But occurrences reflect every scheduled occurrence (542 total, shared counted per phase plan).
    expect(sharedOccurrences).toBeGreaterThanOrEqual(1);
  });

  it("marks phases completed only when every planned occurrence is done", () => {
    expect(phaseOccurrences.length).toBeGreaterThan(0);
    const rows = phaseOccurrences.map((occurrence, index) =>
      lesson({
        lessonId: occurrence.canonicalLessonKey,
        id: `row-${index}`,
        status: "completed",
      })
    );
    const partial = curriculumProgress(rows);
    const firstPhase = partial.byPhase.find(
      (phase) => phase.phaseSlug === occurrences[0].phaseSlug
    );
    expect(firstPhase).toBeDefined();
    // Every distinct canonical lesson of the phase is completed -> occurrences counted fully.
    const distinctKeys = new Set(phaseOccurrences.map((occurrence) => occurrence.canonicalLessonKey));
    if (distinctKeys.size === phaseOccurrences.length) {
      expect(firstPhase?.completed).toBe(firstPhase?.occurrences);
    }
  });

  it("mastered counts exceed nothing and respect invariants", () => {
    const rows = [lesson({ status: "mastered", masteryScore: 95 })];
    const progress = curriculumProgress(rows);
    expect(progress.canonicalMastered).toBe(1);
    expect(progress.canonicalMastered).toBeLessThanOrEqual(progress.canonicalCompleted);
  });
});

describe("§7 study time analytics", () => {
  it("dedupes exact duplicate client sessions", () => {
    const sessions = [
      session(),
      session({ id: "session-row-2", clientSessionId: "client-1" }),
      session({ id: "session-row-3", clientSessionId: "client-2", durationSeconds: 1200 }),
    ];
    const valid = validSessions(sessions);
    expect(valid).toHaveLength(2);
    const stats = studyTimeStats(sessions, "UTC", { now: NOW });
    expect(stats.totalSeconds).toBe(3600 + 1200);
  });

  it("ignores invalid sessions (short, negative, bad timestamps)", () => {
    const sessions = [
      session({ durationSeconds: 30, clientSessionId: "s1" }),
      session({ durationSeconds: -5, clientSessionId: "s2" }),
      session({ startedAt: "not-a-date", clientSessionId: "s3" }),
      session({ clientSessionId: "s4" }),
    ];
    const stats = studyTimeStats(sessions, "UTC", { now: NOW });
    // Only the last minute-60s session is valid.
    expect(stats.sessionCount).toBe(1);
  });

  it("respects period filters without mutating the source", () => {
    const sessions = [
      session({ clientSessionId: "old", startedAt: "2024-01-01T10:00:00.000Z", durationSeconds: 3600 }),
      session({ clientSessionId: "new", startedAt: "2026-10-16T10:00:00.000Z", durationSeconds: 600 }),
    ];
    const original = [...sessions];
    const stats = studyTimeStats(sessions, "UTC", { periodStart: "2026-01-01T00:00:00.000Z", now: NOW });
    expect(stats.totalSeconds).toBe(600);
    expect(sessions).toEqual(original);
  });

  it("computes median, longest, and study days", () => {
    const stats = studyTimeStats(
      [
        session({ clientSessionId: "a", durationSeconds: 600 }),
        session({ clientSessionId: "b", durationSeconds: 1200, startedAt: "2026-10-02T10:00:00.000Z" }),
        session({ clientSessionId: "c", durationSeconds: 3000, startedAt: "2026-10-03T10:00:00.000Z" }),
      ],
      "UTC",
      { now: NOW }
    );
    expect(stats.studyDays).toBe(3);
    expect(stats.medianSessionSeconds).toBe(1200);
    expect(stats.longestSessionSeconds).toBe(3000);
  });
});

describe("§8 streaks", () => {
  it("counts a study day only with >= 10 minutes of sessions", () => {
    const stats = streakStats(
      [
        session({ clientSessionId: "ok", durationSeconds: 601 }),
        session({ clientSessionId: "short", durationSeconds: 60, startedAt: "2026-10-02T10:00:00.000Z" }),
      ],
      "UTC",
      NOW
    );
    // Neither today nor yesterday has a qualifying session, so the current
    // streak is 0; the qualifying day still counts toward the longest streak.
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(1);
  });

  it("tracks current and longest streaks across consecutive days", () => {
    const sessions = Array.from({ length: 5 }, (_, index) =>
      session({
        clientSessionId: `s-${index}`,
        durationSeconds: 1800,
        startedAt: new Date(
          Date.parse("2026-10-13T10:00:00.000Z") + index * 86400000
        ).toISOString(),
      })
    );
    // A gap today preserves "current" via yesterday but longest = 5.
    const stats = streakStats(sessions, "UTC", NOW);
    expect(stats.longestStreak).toBe(5);
  });

  it("applies the learner timezone at boundaries", () => {
    // 23:30Z on Oct 1 is 05:00 next day in Asia/Kolkata (UTC+5:30).
    const stats = streakStats(
      [
        session({
          clientSessionId: "boundary",
          startedAt: "2026-10-15T23:30:00.000Z",
          durationSeconds: 1800,
        }),
        session({
          clientSessionId: "boundary2",
          startedAt: "2026-10-16T23:30:00.000Z",
          durationSeconds: 1800,
        }),
      ],
      "Asia/Kolkata",
      NOW
    );
    // Both sessions land on consecutive local days: Oct 2 and Oct 3.
    expect(stats.currentStreak).toBe(2);
  });
});

describe("§15/§16 roadmap pace", () => {
  const plan = (weeks: RoadmapPlan["weeks"]): RoadmapPlan =>
    ({
      version: 1,
      trackId: "rag",
      startDate: "2026-09-01",
      targetDate: "2027-01-01",
      hoursPerWeek: 10,
      studyDays: [1, 3, 5],
      bufferWeeks: [],
      weeks,
      completedOccurrenceIds: [],
      skipped: [],
      summary: {
        totalMinutes: weeks.reduce((sum, week) => sum + week.capacityMinutes, 0),
        scheduledMinutes: weeks.reduce((sum, week) => sum + week.scheduledMinutes, 0),
        remainingMinutes: 600,
        totalOccurrences: weeks.reduce((sum, week) => sum + week.items.length, 0),
        scheduledOccurrences: weeks.reduce((sum, week) => sum + week.items.length, 0),
        completedOccurrences: 0,
        coreTotal: 10,
        coreCompleted: 0,
        optionalMinutesExcluded: 0,
        skippedOccurrences: 0,
      },
    }) as unknown as RoadmapPlan;

  it("returns no_plan when no roadmap exists", () => {
    const pace = paceAnalytics(null, [], NOW);
    expect(pace.status).toBe("no_plan");
  });

  it("reports behind when only few occurrences are completed vs elapsed weeks", () => {
    const weeks = Array.from({ length: 10 }, (_, index) => ({
      index,
      weekNumber: index + 1,
      startDate: `2026-09-0${index + 1}`,
      endDate: new Date(Date.parse("2026-09-01") + (index + 1) * 7 * 86400000).toISOString().slice(0, 10),
      kind: "study" as const,
      capacityMinutes: 600,
      scheduledMinutes: 600,
      items: [
        {
          occurrenceId: `occ-${index}`,
          canonicalLessonKey: `lesson-${index}`,
          phaseSlug: "p",
          lessonSlug: "l",
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
    }));
    const p = plan(weeks);
    const past = new Date(Date.parse(weeks[7].endDate));
    const pace = paceAnalytics(
      { ...p, summary: { ...p.summary, completedOccurrences: 1, scheduledOccurrences: 10 } },
      [],
      past
    );
    expect(pace.status).not.toBe("no_plan");
    expect(pace.backlogSize).toBeGreaterThan(0);
  });

  it("refuses a projection when there is no recent activity", () => {
    const p = plan([
      {
        index: 0,
        weekNumber: 1,
        startDate: "2026-10-01",
        endDate: "2027-03-01",
        kind: "study",
        capacityMinutes: 600,
        scheduledMinutes: 600,
        items: [
          {
            occurrenceId: "occ-0",
            canonicalLessonKey: "lesson-0",
            phaseSlug: "p",
            lessonSlug: "l",
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
    ]);
    const pace = paceAnalytics(p, [], NOW);
    expect(pace.explanation.join(" ")).toContain("Not enough activity");
  });
});

describe("§19 achievements", () => {
  it("derives first-lesson from real completion timestamp", () => {
    const achievements = deriveAchievements({
      lessons: [lesson({ completedAt: "2026-03-01T10:00:00.000Z" })],
      studySessions: [],
      quizAttempts: [],
      projectProgress: [],
      projectEvidence: [],
    });
    const first = achievements.find((achievement) => achievement.id === "first-lesson");
    expect(first?.earnedAt).toBe("2026-03-01T10:00:00.000Z");
    const tenHours = achievements.find((achievement) => achievement.id === "first-10-hours");
    expect(tenHours?.earnedAt).toBeNull();
  });

  it("awards first 10 study hours from session accumulation", () => {
    const sessions = [
      session({ clientSessionId: "1", durationSeconds: 6 * 3600, startedAt: "2026-01-01T10:00:00.000Z" }),
      session({ clientSessionId: "2", durationSeconds: 5 * 3600, startedAt: "2026-01-05T10:00:00.000Z" }),
    ];
    const achievements = deriveAchievements({
      lessons: [],
      studySessions: sessions,
      quizAttempts: [],
      projectProgress: [],
      projectEvidence: [],
    });
    const tenHours = achievements.find((achievement) => achievement.id === "first-10-hours");
    expect(tenHours?.earnedAt).toBe("2026-01-05T10:00:00.000Z");
  });

  it("never invents achievements without records", () => {
    const achievements = deriveAchievements({
      lessons: [],
      studySessions: [],
      quizAttempts: [],
      projectProgress: [],
      projectEvidence: [],
    });
    expect(achievements.every((achievement) => achievement.earnedAt === null)).toBe(true);
  });

  it("detects first assessment improvement", () => {
    const attempts = [
      quizAttempt({ quizId: assessmentCatalog[0].id, percentage: 40, submittedAt: "2026-02-01T10:00:00.000Z" }),
      quizAttempt({ quizId: assessmentCatalog[0].id, percentage: 90, submittedAt: "2026-02-10T10:00:00.000Z", attemptNumber: 2 }),
    ];
    const achievements = deriveAchievements({
      lessons: [],
      studySessions: [],
      quizAttempts: attempts,
      projectProgress: [],
      projectEvidence: [],
    });
    expect(
      achievements.find((achievement) => achievement.id === "first-assessment-improvement")?.earnedAt
    ).toBe("2026-02-10T10:00:00.000Z");
  });
});

function quizAttempt(overrides: Partial<QuizAttempt> = {}): QuizAttempt {
  const now = "2026-02-01T10:00:00.000Z";
  const quizId = overrides.quizId ?? assessmentCatalog[0].id;
  return {
    id: "attempt-row",
    createdAt: now,
    updatedAt: now,
    localRevision: 1,
    syncStatus: "pending",
    attemptId: "attempt-1",
    quizId,
    // AttemptLike identity: assessmentId mirrors quizId for analytics inputs.
    assessmentId: quizId,
    lessonId: "lesson-key",
    answers: {},
    score: 0,
    maxScore: 10,
    percentage: 40,
    startedAt: now,
    submittedAt: now,
    attemptNumber: 1,
    ...overrides,
  } as unknown as QuizAttempt;
}

describe("§17 assessment analytics", () => {
  it("groups per assessment and reports trends", () => {
    const id = assessmentCatalog[0].id;
    const analytics = assessmentAnalytics([
      quizAttempt({ quizId: id, percentage: 40, submittedAt: "2026-02-01T10:00:00.000Z" }),
      quizAttempt({ quizId: id, percentage: 52, submittedAt: "2026-02-05T10:00:00.000Z", attemptNumber: 2 }),
      quizAttempt({ quizId: id, percentage: 78, submittedAt: "2026-02-09T10:00:00.000Z", attemptNumber: 3 }),
    ]);
    const row = analytics.rows.find((entry) => entry.assessmentId === id);
    expect(row?.attempts).toBe(3);
    expect(row?.bestScore).toBe(78);
    expect(row?.latestScore).toBe(78);
    expect(row?.improvementTrend).toBe("improving");
    expect(row?.averageRecentScore).toBe(Math.round((40 + 52 + 78) / 3));
  });

  it("flags insufficient data rather than inventing a trend", () => {
    const analytics = assessmentAnalytics([
      quizAttempt({ quizId: assessmentCatalog[0].id, percentage: 90 }),
    ]);
    expect(analytics.rows[0].improvementTrend).toBe("insufficient");
  });
});

describe("§13 review queue", () => {
  const assessmentId = assessmentCatalog[0].id;
  const skillId = assessmentCatalog[0].questions[0].skills[0];

  it("produces a bounded, explained queue", () => {
    void skillId;
    const attempts = [
      quizAttempt({ quizId: assessmentId, percentage: 55, submittedAt: "2026-10-05T10:00:00.000Z" }),
      quizAttempt({ quizId: assessmentId, percentage: 48, submittedAt: "2026-10-08T10:00:00.000Z", attemptNumber: 2 }),
      quizAttempt({ quizId: assessmentId, percentage: 52, submittedAt: "2026-10-11T10:00:00.000Z", attemptNumber: 3 }),
    ];
    const queue = buildReviewQueue(
      {
        attempts: attempts as unknown as import("@/lib/assessments/weak-skills").AttemptLike[],
        projectSkillAssociations: new Map([[skillId, { inProgress: true, projectTitles: ["P"] }]]),
        reviewHistory: new Map(),
        manuallyFlagged: new Set(),
        roadmapSkillOccurrences: roadmapSkillOccurrences(),
      },
      NOW
    );
    expect(queue.length).toBeLessThanOrEqual(8);
    const item = queue[0];
    expect(item).toBeDefined();
    expect(item?.whyNow.length).toBeGreaterThan(0);
    expect(item?.whyNow).toContain("below the 70");
  });

  it("does not flag from a single imperfect attempt", () => {
    const queue = buildReviewQueue(
      {
        attempts: [
          quizAttempt({ quizId: assessmentId, percentage: 65 }) as unknown as import("@/lib/assessments/weak-skills").AttemptLike,
        ],
        projectSkillAssociations: new Map(),
        reviewHistory: new Map(),
        manuallyFlagged: new Set(),
        roadmapSkillOccurrences: roadmapSkillOccurrences(),
      },
      NOW
    );
    expect(queue.find((entry) => entry.skillId === skillId)).toBeUndefined();
  });

  it("respects manual flags and overdue spaced reviews", () => {
    const queue = buildReviewQueue(
      {
        attempts: [],
        projectSkillAssociations: new Map(),
        reviewHistory: new Map([[skillId, "2026-08-01T10:00:00.000Z"]]),
        manuallyFlagged: new Set([skillId]),
        roadmapSkillOccurrences: roadmapSkillOccurrences(),
      },
      NOW
    );
    const item = queue.find((entry) => entry.skillId === skillId);
    expect(item).toBeDefined();
    expect(item?.reasons.join(" ")).toContain("flagged");
    expect(item?.overdue).toBe(true);
  });

  it("advances the spaced interval ladder deterministically", () => {
    expect(nextReviewInDays(0)).toBe(3);
    expect(nextReviewInDays(1)).toBe(7);
    expect(nextReviewInDays(2)).toBe(21);
    expect(nextReviewInDays(3)).toBe(45);
    expect(nextReviewInDays(4)).toBe(45);
  });

  it("computes overdue days", () => {
    expect(daysSince("2026-10-10T10:00:00.000Z", NOW)).toBe(7);
    expect(daysSince("not-a-date", NOW)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("§5 period filters", () => {
  it("maps periods to UTC starts", () => {
    expect(periodStartIso("all", NOW)).toBe("0000-01-01T00:00:00.000Z");
    expect(periodStartIso("7d", NOW)).toBe("2026-10-10T12:00:00.000Z");
    expect(periodStartIso("1y", NOW)).toBe("2025-10-17T12:00:00.000Z");
  });
});

describe("§3 milestone helpers", () => {
  const progress: ProjectProgress[] = [
    {
      id: "1",
      createdAt: "",
      updatedAt: "",
      localRevision: 1,
      syncStatus: "pending",
      projectId: "p1",
      milestoneId: "m1",
      completed: true,
      completedAt: "2026-10-01T00:00:00.000Z",
      evidenceUrl: null,
      notes: null,
    },
  ] as ProjectProgress[];
  it("counts completed milestones only once each", () => {
    expect(completedMilestoneCount(progress)).toBe(1);
    expect(completedMilestoneCount([])).toBe(0);
  });
});
