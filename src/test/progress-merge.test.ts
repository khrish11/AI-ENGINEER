import { describe, it, expect, beforeEach } from "vitest";
import { performGuestAccountMerge } from "@/lib/progress/merge";
import { db } from "@/lib/progress/db";
import { lessonProgressRepo } from "@/lib/progress/repositories/lesson-progress";
import { bookmarksRepo } from "@/lib/progress/repositories/bookmarks";
import {
  makeNote,
  makeStudySession,
  resetProgressDb,
} from "./progress-test-utils";

describe("guest -> account merge", () => {
  beforeEach(async () => {
    await resetProgressDb();
  });

  it("keeps guest progress and merges cloud-only records", async () => {
    await lessonProgressRepo.upsert({
      lessonId: "local-lesson",
      readingComplete: true,
      availability: {
        hasVideo: false,
        hasQuiz: false,
        hasProject: false,
        hasResources: false,
      },
    });

    const summary = await performGuestAccountMerge({
      lessons: [
        {
          lessonId: "local-lesson",
          status: "in_progress",
          readingComplete: false,
        },
        {
          lessonId: "cloud-lesson",
          status: "completed",
          readingComplete: true,
        },
      ],
    });

    expect(summary.localUploaded.lessonProgress).toBe(1);
    expect(summary.cloudPreserved.lessonProgress).toBe(1);

    const local = await lessonProgressRepo.getByLesson("local-lesson");
    expect(local?.status).toBe("completed");
    expect(local?.readingComplete).toBe(true);

    const cloud = await lessonProgressRepo.getByLesson("cloud-lesson");
    expect(cloud?.status).toBe("completed");
    expect(cloud?.syncStatus).toBe("synced");
  });

  it("never deletes guest notes and preserves conflicting copies", async () => {
    await db.notes.put(makeNote({ content: "guest notes", contentRevision: 2 }));

    const summary = await performGuestAccountMerge({
      notes: [
        {
          id: makeNote().id,
          content: "cloud notes",
          contentRevision: 2,
          updatedAt: "2026-10-17T11:00:00.000Z",
        },
      ],
    });

    expect(summary.conflicts).toBe(1);
    const note = await db.notes.get(makeNote().id);
    expect(note?.content).toBe("guest notes");
    expect(note?.conflictState).toBe("unresolved");
    expect(note?.conflictBackup).toBe("cloud notes");
    expect(await db.conflicts.count()).toBe(1);
  });

  it("imports cloud bookmarks and honours cloud deletions", async () => {
    const kept = await bookmarksRepo.upsert({
      lessonId: "bookmark-kept",
      resourceId: null,
      projectId: null,
      targetType: "lesson",
    });
    const removed = await bookmarksRepo.upsert({
      lessonId: "bookmark-removed",
      resourceId: null,
      projectId: null,
      targetType: "lesson",
    });

    const summary = await performGuestAccountMerge({
      bookmarks: [
        {
          id: kept.id,
          lessonId: "bookmark-kept",
          targetType: "lesson",
          title: "Remote title",
        },
        {
          id: removed.id,
          lessonId: "bookmark-removed",
          deletedAt: "2026-10-17T09:00:00.000Z",
        },
        {
          id: "cloud-bookmark",
          lessonId: "cloud-lesson",
          targetType: "lesson",
          title: "Cloud bookmark",
        },
      ],
    });

    expect(summary.localUploaded.bookmarks).toBe(1);
    expect(summary.cloudPreserved.bookmarks).toBe(1);
    expect(await bookmarksRepo.getAll()).toHaveLength(2);
    expect(await bookmarksRepo.getByLesson("bookmark-removed")).toBeNull();
    expect(await db.tombstones.count()).toBe(1);
  });

  it("unions study sessions and quiz attempts without duplicating", async () => {
    const session = makeStudySession();
    await db.studySessions.put(session);

    const summary = await performGuestAccountMerge({
      studySessions: [
        {
          clientSessionId: session.clientSessionId,
          deviceId: session.deviceId,
          startedAt: session.startedAt,
          durationSeconds: 600,
        },
        {
          clientSessionId: "cloud-session",
          deviceId: session.deviceId,
          startedAt: "2026-10-16T10:00:00.000Z",
          durationSeconds: 1800,
        },
      ],
      quizAttempts: [
        {
          attemptId: "cloud-attempt",
          lessonId: "cloud-lesson",
          score: 9,
          maxScore: 10,
          percentage: 90,
          attemptNumber: 1,
        },
      ],
    });

    expect(summary.localUploaded.studySessions).toBe(1);
    expect(summary.cloudPreserved.studySessions).toBe(1);
    expect(await db.studySessions.count()).toBe(2);
    expect(summary.cloudPreserved.quizAttempts).toBe(1);
    expect(await db.quizAttempts.count()).toBe(1);
  });

  it("is deterministic across repeated merges", async () => {
    const cloud = {
      lessons: [
        {
          lessonId: "stable-lesson",
          status: "completed" as const,
          readingComplete: true,
        },
      ],
    };
    const first = await performGuestAccountMerge(cloud);
    const second = await performGuestAccountMerge(cloud);

    expect(first.cloudPreserved.lessonProgress).toBe(1);
    // Once merged locally, the record is no longer cloud-only, but re-merging
    // still yields exactly one deterministic row.
    expect(second.localUploaded.lessonProgress).toBe(1);
    expect(await lessonProgressRepo.getByLesson("stable-lesson")).not.toBeNull();
    expect(await db.lessonProgress.count()).toBe(1);
  });

  it("applies cloud tombstones for deleted notes and bookmarks", async () => {
    await db.notes.put(makeNote({ id: "note-deleted" }));
    const bookmark = await bookmarksRepo.upsert({
      lessonId: "bookmark-deleted",
      resourceId: null,
      projectId: null,
      targetType: "lesson",
    });

    await performGuestAccountMerge({
      tombstones: [
        {
          entityId: "note-deleted",
          entityType: "note",
          deletedAt: "2026-10-17T10:00:00.000Z",
          revision: 2,
        },
        {
          entityId: bookmark.id,
          entityType: "bookmark",
          deletedAt: "2026-10-17T10:00:00.000Z",
          revision: 2,
        },
      ],
      notes: [],
      bookmarks: [],
    });

    expect(await db.notes.get("note-deleted")).toBeUndefined();
    expect(await bookmarksRepo.getByLesson("bookmark-deleted")).toBeNull();
  });

  it("retains local records that only exist on this device", async () => {
    await db.notes.put(
      makeNote({ id: "guest-only-note", content: "only here" })
    );
    const summary = await performGuestAccountMerge({ notes: [] });
    expect(summary.localUploaded.notes).toBe(1);
    expect(await db.notes.get("guest-only-note")).not.toBeNull();
  });
});
