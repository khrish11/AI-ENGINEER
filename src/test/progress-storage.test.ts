import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/progress/db";
import { getOrCreateDeviceId, generateDeviceId } from "@/lib/progress/device";
import { lessonProgressRepo } from "@/lib/progress/repositories/lesson-progress";
import { resourceProgressRepo } from "@/lib/progress/repositories/resource-progress";
import { bookmarksRepo } from "@/lib/progress/repositories/bookmarks";
import { notesRepo } from "@/lib/progress/repositories/notes";
import { studySessionsRepo } from "@/lib/progress/repositories/study-sessions";
import { quizAttemptsRepo } from "@/lib/progress/repositories/quiz-attempts";
import { getLearnerStats } from "@/lib/progress/learner-stats";
import { computeStreak } from "@/lib/progress/learner-stats";
import { resetProgressDb } from "./progress-test-utils";

const AVAILABILITY = {
  hasVideo: false,
  hasQuiz: false,
  hasProject: false,
  hasResources: true,
};

describe("device identity", () => {
  beforeEach(async () => {
    await resetProgressDb();
  });

  it("generates a random uuid", () => {
    expect(generateDeviceId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("persists the device id across calls", async () => {
    const first = await getOrCreateDeviceId();
    const second = await getOrCreateDeviceId();
    expect(second).toBe(first);
    expect(await db.deviceMetadata.count()).toBe(1);
  });

  it("restores the persisted device id after a simulated reload", async () => {
    const first = await getOrCreateDeviceId();
    db.close();
    await db.open();
    expect(await getOrCreateDeviceId()).toBe(first);
  });
});

describe("lesson progress repository", () => {
  beforeEach(async () => {
    await resetProgressDb();
  });

  it("does not complete a lesson merely because it was opened", async () => {
    const record = await lessonProgressRepo.upsert({ lessonId: "lesson-open" });
    expect(record.status).toBe("not_started");
    expect(record.completedAt).toBeNull();
  });

  it("adapts to lessons with required resources", async () => {
    const afterReading = await lessonProgressRepo.markReadingComplete(
      "lesson-res",
      AVAILABILITY
    );
    expect(afterReading.status).toBe("in_progress");

    const afterResources = await lessonProgressRepo.markResourcesComplete(
      "lesson-res",
      AVAILABILITY
    );
    expect(afterResources.status).toBe("completed");
    expect(afterResources.completedAt).not.toBeNull();
  });

  it("never downgrades a completed lesson", async () => {
    await lessonProgressRepo.upsert({
      lessonId: "lesson-sticky",
      readingComplete: true,
      availability: {
        hasVideo: false,
        hasQuiz: false,
        hasProject: false,
        hasResources: false,
      },
    });
    const completed = await lessonProgressRepo.getByLesson("lesson-sticky");
    expect(completed?.status).toBe("completed");

    const downgraded = await lessonProgressRepo.upsert({
      lessonId: "lesson-sticky",
      readingComplete: false,
      availability: {
        hasVideo: true,
        hasQuiz: true,
        hasProject: true,
        hasResources: true,
      },
    });
    expect(downgraded.status).toBe("completed");
    expect(downgraded.readingComplete).toBe(true);
  });

  it("promotes to mastered only with a valid mastery score", async () => {
    await lessonProgressRepo.upsert({
      lessonId: "lesson-mastery",
      readingComplete: true,
      availability: {
        hasVideo: false,
        hasQuiz: false,
        hasProject: false,
        hasResources: false,
      },
    });
    const low = await lessonProgressRepo.upsert({
      lessonId: "lesson-mastery",
      masteryScore: 70,
      availability: {
        hasVideo: false,
        hasQuiz: false,
        hasProject: false,
        hasResources: false,
      },
    });
    expect(low.status).toBe("completed");

    const high = await lessonProgressRepo.upsert({
      lessonId: "lesson-mastery",
      masteryScore: 92,
      availability: {
        hasVideo: false,
        hasQuiz: false,
        hasProject: false,
        hasResources: false,
      },
    });
    expect(high.status).toBe("mastered");
    expect(high.masteredAt).not.toBeNull();
  });

  it("persists display metadata and phase identity", async () => {
    const record = await lessonProgressRepo.upsert({
      lessonId: "lesson-meta",
      lessonTitle: "Dev Environment",
      lessonHref: "/curriculum/00-setup-and-tooling/01-dev-environment",
      phaseSlug: "00-setup-and-tooling",
      phaseNumber: 0,
      readingComplete: true,
    });
    expect(record.lessonTitle).toBe("Dev Environment");
    expect(record.phaseSlug).toBe("00-setup-and-tooling");
    expect(await lessonProgressRepo.getByPhase("00-setup-and-tooling")).toHaveLength(1);
  });
});

describe("resource progress repository", () => {
  beforeEach(async () => {
    await resetProgressDb();
  });

  it("moves forward monotonically and never regresses completion", async () => {
    await resourceProgressRepo.markStarted("resource-1", "opened", {
      resourceType: "github_repo",
      resourceTitle: "Repo",
      href: "https://github.com/example/repo",
    });
    let record = await resourceProgressRepo.getByResource("resource-1");
    expect(record?.started).toBe(true);
    expect(record?.completed).toBe(false);
    expect(record?.githubState).toBe("opened");

    await resourceProgressRepo.markGithubState("resource-1", "explored");
    record = await resourceProgressRepo.getByResource("resource-1");
    expect(record?.githubState).toBe("explored");
    expect(record?.completed).toBe(false);

    await resourceProgressRepo.markCompleted("resource-1");
    await resourceProgressRepo.markStarted("resource-1");
    record = await resourceProgressRepo.getByResource("resource-1");
    expect(record?.completed).toBe(true);
    expect(record?.completedAt).not.toBeNull();
  });

  it("opening a repository does not complete the exercise", async () => {
    await resourceProgressRepo.markStarted("resource-2", "opened");
    const record = await resourceProgressRepo.getByResource("resource-2");
    expect(record?.completed).toBe(false);
  });
});

describe("bookmarks and tombstones", () => {
  beforeEach(async () => {
    await resetProgressDb();
  });

  it("removes a bookmark with a tombstone instead of silent absence", async () => {
    const bookmark = await bookmarksRepo.upsert({
      lessonId: "lesson-1",
      resourceId: null,
      projectId: null,
      targetType: "lesson",
      title: "Lesson one",
      href: "/curriculum/00/01",
    });
    expect(await bookmarksRepo.getAll()).toHaveLength(1);

    await bookmarksRepo.remove(bookmark.id);
    expect(await bookmarksRepo.getAll()).toHaveLength(0);
    expect(await bookmarksRepo.getByLesson("lesson-1")).toBeNull();

    const tombstones = await db.tombstones.toArray();
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0].entityType).toBe("bookmark");
    expect(tombstones[0].entityId).toBe(bookmark.id);

    const queued = await db.syncQueue.toArray();
    expect(queued.some((item) => item.operation === "delete")).toBe(true);
  });

  it("can re-bookmark after removal without reviving the tombstoned record", async () => {
    const first = await bookmarksRepo.upsert({
      lessonId: "lesson-2",
      resourceId: null,
      projectId: null,
      targetType: "lesson",
    });
    await bookmarksRepo.remove(first.id);
    const second = await bookmarksRepo.upsert({
      lessonId: "lesson-2",
      resourceId: null,
      projectId: null,
      targetType: "lesson",
    });
    expect(second.id).not.toBe(first.id);
    expect(await bookmarksRepo.getAll()).toHaveLength(1);
    expect(await db.tombstones.count()).toBe(1);
  });
});

describe("notes autosave", () => {
  beforeEach(async () => {
    await resetProgressDb();
  });

  it("updates a single note record and bumps its revision", async () => {
    const first = await notesRepo.upsert({
      lessonId: "lesson-note",
      resourceId: null,
      projectId: null,
      content: "first draft",
    });
    const second = await notesRepo.upsert({
      lessonId: "lesson-note",
      resourceId: null,
      projectId: null,
      content: "second draft",
    });
    expect(second.id).toBe(first.id);
    expect(second.contentRevision).toBe(2);
    expect(second.localRevision).toBe(2);
    expect(await db.notes.count()).toBe(1);
  });
});

describe("study sessions", () => {
  beforeEach(async () => {
    await resetProgressDb();
  });

  it("deduplicates immutable sessions and derives total time", async () => {
    const session = {
      clientSessionId: "88888888-8888-4888-8888-888888888888",
      deviceId: "99999999-9999-4999-8999-999999999999",
      lessonId: "lesson-1",
      resourceId: null,
      projectId: null,
      startedAt: "2026-10-17T10:00:00.000Z",
      endedAt: "2026-10-17T10:05:00.000Z",
      durationSeconds: 300,
    };
    await studySessionsRepo.create(session);
    await studySessionsRepo.create(session);
    expect(await db.studySessions.count()).toBe(1);
    expect(await studySessionsRepo.getTotalDuration()).toBe(300);
  });
});

describe("quiz attempts", () => {
  beforeEach(async () => {
    await resetProgressDb();
  });

  it("preserves immutable attempts and reports the best score", async () => {
    const base = {
      quizId: "quiz-1",
      lessonId: "lesson-quiz",
      answers: { 0: 1 },
      score: 6,
      maxScore: 10,
      percentage: 60,
      startedAt: "2026-10-17T10:00:00.000Z",
      submittedAt: "2026-10-17T10:05:00.000Z",
    };
    await quizAttemptsRepo.create({
      ...base,
      attemptId: "attempt-a",
      attemptNumber: 1,
    });
    await quizAttemptsRepo.create({
      ...base,
      attemptId: "attempt-b",
      attemptNumber: 2,
      score: 9,
      percentage: 90,
    });

    expect(await db.quizAttempts.count()).toBe(2);
    expect(await quizAttemptsRepo.getBestScore("lesson-quiz")).toBe(90);
    expect(await quizAttemptsRepo.nextAttemptNumber("lesson-quiz")).toBe(3);
  });

  it("does not overwrite an existing attempt id", async () => {
    const base = {
      attemptId: "attempt-immutable",
      quizId: "quiz-1",
      lessonId: "lesson-quiz",
      answers: {},
      score: 5,
      maxScore: 10,
      percentage: 50,
      startedAt: "2026-10-17T10:00:00.000Z",
      attemptNumber: 1,
    };
    await quizAttemptsRepo.create(base);
    await quizAttemptsRepo.create({ ...base, score: 2, percentage: 20 });
    const attempts = await quizAttemptsRepo.getByLesson("lesson-quiz");
    expect(attempts).toHaveLength(1);
    expect(attempts[0].percentage).toBe(50);
  });
});

describe("learner stats", () => {
  beforeEach(async () => {
    await resetProgressDb();
  });

  it("returns zeros for a brand new learner", async () => {
    const stats = await getLearnerStats();
    expect(stats.lessonsStarted).toBe(0);
    expect(stats.lessonsCompleted).toBe(0);
    expect(stats.totalStudySeconds).toBe(0);
    expect(stats.studySessionCount).toBe(0);
  });

  it("computes stats from persisted activity", async () => {
    await lessonProgressRepo.upsert({
      lessonId: "lesson-stats",
      readingComplete: true,
      availability: {
        hasVideo: false,
        hasQuiz: false,
        hasProject: false,
        hasResources: false,
      },
    });
    await resourceProgressRepo.markCompleted("resource-stats", {
      resourceType: "youtube_video",
    });
    await studySessionsRepo.create({
      clientSessionId: "77777777-7777-4777-8777-777777777777",
      deviceId: "99999999-9999-4999-8999-999999999999",
      lessonId: "lesson-stats",
      resourceId: null,
      projectId: null,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      durationSeconds: 120,
    });

    const stats = await getLearnerStats();
    expect(stats.lessonsStarted).toBe(1);
    expect(stats.lessonsCompleted).toBe(1);
    expect(stats.resourcesCompleted).toBe(1);
    expect(stats.videosWatched).toBe(1);
    expect(stats.totalStudySeconds).toBe(120);
    expect(stats.currentStreak).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(stats.reviewQueue)).toBe(false);
  });

  it("computes consecutive-day streaks", () => {
    const today = new Date("2026-10-17T12:00:00.000Z");
    expect(
      computeStreak(
        ["2026-10-17T08:00:00.000Z", "2026-10-16T08:00:00.000Z", "2026-10-15T08:00:00.000Z"],
        today
      )
    ).toBe(3);
    expect(computeStreak([], today)).toBe(0);
  });
});
