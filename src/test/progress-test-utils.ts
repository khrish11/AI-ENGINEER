import { db, type LessonProgress, type Note, type StudySession } from "@/lib/progress/db";

export async function resetProgressDb(): Promise<void> {
  await Promise.all([
    db.localProfile.clear(),
    db.lessonProgress.clear(),
    db.resourceProgress.clear(),
    db.notes.clear(),
    db.bookmarks.clear(),
    db.studySessions.clear(),
    db.quizAttempts.clear(),
    db.projectProgress.clear(),
    db.syncQueue.clear(),
    db.syncMetadata.clear(),
    db.conflicts.clear(),
    db.roadmapState.clear(),
    db.deviceMetadata.clear(),
    db.tombstones.clear(),
    db.importBackups.clear(),
    db.projectEvidence.clear(),
    db.projectSelfAssessments.clear(),
    db.reviewHistory.clear(),
    db.portfolioDraft.clear(),
  ]);
}

export function makeLesson(overrides: Partial<LessonProgress> = {}): LessonProgress {
  const now = "2026-10-17T10:00:00.000Z";
  return {
    id: "11111111-1111-4111-8111-111111111111",
    createdAt: now,
    updatedAt: now,
    localRevision: 1,
    syncStatus: "pending",
    lessonId: "22222222-2222-4222-8222-222222222222",
    lessonTitle: "Test Lesson",
    lessonHref: "/curriculum/00-setup-and-tooling/01-dev-environment",
    phaseSlug: "00-setup-and-tooling",
    phaseNumber: 0,
    status: "not_started",
    readingComplete: false,
    requiredResourcesComplete: false,
    practiceComplete: false,
    projectComplete: false,
    masteryScore: null,
    needsReview: false,
    startedAt: null,
    completedAt: null,
    masteredAt: null,
    ...overrides,
  };
}

export function makeNote(overrides: Partial<Note> = {}): Note {
  const now = "2026-10-17T10:00:00.000Z";
  return {
    id: "33333333-3333-4333-8333-333333333333",
    createdAt: now,
    updatedAt: now,
    localRevision: 1,
    syncStatus: "pending",
    lessonId: "22222222-2222-4222-8222-222222222222",
    resourceId: null,
    projectId: null,
    content: "base content",
    contentRevision: 1,
    conflictState: "none",
    conflictBackup: null,
    ...overrides,
  };
}

export function makeStudySession(overrides: Partial<StudySession> = {}): StudySession {
  const now = "2026-10-17T10:00:00.000Z";
  return {
    id: "44444444-4444-4444-8444-444444444444",
    createdAt: now,
    updatedAt: now,
    localRevision: 1,
    syncStatus: "pending",
    clientSessionId: "55555555-5555-4555-8555-555555555555",
    deviceId: "66666666-6666-4666-8666-666666666666",
    lessonId: "22222222-2222-4222-8222-222222222222",
    resourceId: null,
    projectId: null,
    startedAt: now,
    endedAt: "2026-10-17T10:10:00.000Z",
    durationSeconds: 600,
    ...overrides,
  };
}

export function makeExport(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    app: "ai-engineer-os",
    exportedAt: "2026-10-17T10:00:00.000Z",
    data: {
      lessonProgress: [],
      resourceProgress: [],
      notes: [],
      bookmarks: [],
      studySessions: [],
      quizAttempts: [],
      projectProgress: [],
      roadmapState: [],
      ...overrides,
    },
  };
}
