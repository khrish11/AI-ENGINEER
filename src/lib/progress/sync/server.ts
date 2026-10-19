import { and, asc, eq, gt, lte, type AnyColumn } from "drizzle-orm";
import { db } from "@/db";
import {
  reviewHistory,
  bookmarks,
  notes,
  projectEvidence,
  projectProgress,
  projectSelfAssessments,
  quizAttempts,
  roadmapState,
  studySessions,
  syncBatches,
  tombstones,
  userLessonProgress,
  userResourceProgress,
} from "@/db/schema";
import type { LessonStatus } from "../completion";
import type { GithubResourceState } from "../resource-rules";
import { MemorySyncStore, type MemoryUserState } from "./engine";

/**
 * The sync engine is a pure function over an in-memory store. On the server we
 * hydrate that store from PostgreSQL before processing a batch so that conflict
 * detection and monotonic merges are deterministic across process restarts and
 * across multiple application instances.
 */
export async function hydrateStore(userId: string): Promise<MemorySyncStore> {
  const store = new MemorySyncStore();
  const state: MemoryUserState = store.getUser(userId);

  const [
    lessonRows,
    resourceRows,
    noteRows,
    bookmarkRows,
    sessionRows,
    attemptRows,
    projectRows,
    tombstoneRows,
    evidenceRows,
    assessmentRows,
    reviewRows,
    latestBatch,
  ] = await Promise.all([
    db.select().from(userLessonProgress).where(eq(userLessonProgress.userId, userId)),

    db.select().from(userResourceProgress).where(eq(userResourceProgress.userId, userId)),
    db.select().from(notes).where(eq(notes.userId, userId)),
    db.select().from(bookmarks).where(eq(bookmarks.userId, userId)),
    db.select().from(studySessions).where(eq(studySessions.userId, userId)),
    db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)),
    db.select().from(projectProgress).where(eq(projectProgress.userId, userId)),
    db.select().from(tombstones).where(eq(tombstones.userId, userId)),
    db.select().from(projectEvidence).where(eq(projectEvidence.userId, userId)),
    db.select().from(projectSelfAssessments).where(eq(projectSelfAssessments.userId, userId)),
    db.select().from(reviewHistory).where(eq(reviewHistory.userId, userId)),
    db
      .select({ createdAt: syncBatches.createdAt })
      .from(syncBatches)
      .where(eq(syncBatches.userId, userId))
      .orderBy(asc(syncBatches.createdAt)),
  ]);

  for (const row of lessonRows) {
    state.lessons.set(row.lessonKey, {
      id: row.id,
      lessonId: row.lessonKey,
      status: row.status as LessonStatus,
      readingComplete: row.readingComplete,
      requiredResourcesComplete: row.requiredResourcesComplete,
      practiceComplete: row.practiceComplete,
      projectComplete: row.projectComplete,
      masteryScore: row.masteryScore,
      needsReview: row.needsReview,
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      masteredAt: row.masteredAt ? row.masteredAt.toISOString() : null,
      localRevision: row.localRevision,
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  for (const row of resourceRows) {
    const metadata = (row.metadata ?? {}) as { githubState?: GithubResourceState | null };
    state.resources.set(row.resourceId, {
      resourceId: row.resourceId,
      started: true,
      completed: row.status === "completed",
      githubState: metadata.githubState ?? null,
      localRevision: row.localRevision,
    });
  }

  for (const row of noteRows) {
    state.notes.set(row.id, {
      id: row.id,
      content: row.content,
      contentRevision: row.contentRevision,
      localRevision: row.localRevision,
      conflictState: row.conflictState,
      conflictBackup: row.conflictBackup,
      lessonId: row.lessonKey,
      resourceId: row.resourceId,
      projectId: row.projectId,
    });
  }

  for (const row of bookmarkRows) {
    state.bookmarks.set(row.id, {
      id: row.id,
      lessonId: row.lessonKey,
      resourceId: row.resourceId,
      projectId: row.projectId,
      targetType: row.targetType,
      title: row.title,
      href: row.href,
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      localRevision: row.localRevision,
    });
  }

  for (const row of sessionRows) {
    state.studySessions.set(row.clientSessionId, {
      id: row.id,
      clientSessionId: row.clientSessionId,
      deviceId: row.deviceId ?? "",
      durationSeconds: row.durationSeconds ?? 0,
    });
  }

  for (const row of attemptRows) {
    state.quizAttempts.set(row.attemptId, {
      id: row.id,
      attemptId: row.attemptId,
      lessonId: row.lessonId ?? "",
      score: row.score,
      percentage: row.percentage,
    });
  }

  for (const row of projectRows) {
    state.projects.set(`${row.projectId}:${row.milestoneId ?? ""}`, {
      id: row.id,
      projectId: row.projectId,
      milestoneId: row.milestoneId,
      completed: row.completed,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      evidenceUrl: row.evidenceUrl,
      notes: row.note,
    });
  }

  // Phase 6: evidence + rubric self-assessments hydrate into the generic
  // project store; they are passive records (merge keeps newest revision).
  for (const row of evidenceRows) {
    state.projects.set(`evidence:${row.id}`, {
      entityType: "project_evidence",
      id: row.id,
      projectId: row.projectId,
      kind: row.kind,
      value: row.value,
      title: row.title,
      details: row.details,
      selfReported: row.selfReported,
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      localRevision: row.localRevision,
    });
  }
  for (const row of assessmentRows) {
    state.projects.set(`selfAssessment:${row.id}`, {
      entityType: "project_self_assessment",
      id: row.id,
      projectId: row.projectId,
      scores: row.scores,
      totalEarned: row.totalEarned,
      totalMax: row.totalMax,
      localRevision: row.localRevision,
    });
  }

  for (const row of reviewRows) {
    state.projects.set(`reviewHistory:${row.id}`, {
      entityType: "review_history",
      id: row.id,
      skillId: row.skillId,
      successfulReviews: row.successfulReviews,
      lastReviewedAt: row.lastReviewedAt ? row.lastReviewedAt.toISOString() : null,
      snoozedUntil: row.snoozedUntil ? row.snoozedUntil.toISOString() : null,
      localRevision: row.localRevision,
    });
  }

  for (const row of tombstoneRows) {
    state.tombstones.set(`${row.entityType}:${row.entityId}`, {
      entityId: row.entityId,
      entityType: row.entityType,
      deletedAt: row.deletedAt.toISOString(),
      revision: row.revision,
    });
  }

  state.cursor = latestBatch.length
    ? latestBatch[latestBatch.length - 1].createdAt.toISOString()
    : "";

  return store;
}

export interface RemoteChange {
  entityType: string;
  entityId: string;
  operation: "upsert" | "delete";
  data: Record<string, unknown>;
  updatedAt: string;
}

function parseCursor(cursor: string | null | undefined): Date | null {
  if (!cursor) return null;
  const parsed = new Date(cursor);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Collects cloud records changed in `(since, until]`. Used to echo other
 * devices' writes back to a syncing client without echoing the client's own
 * batch (which completed before `until`).
 */
export async function fetchRemoteChanges(
  userId: string,
  since: string | null | undefined,
  until: Date
): Promise<RemoteChange[]> {
  const sinceDate = parseCursor(since);
  const changed = (column: AnyColumn) =>
    sinceDate ? and(gt(column, sinceDate), lte(column, until)) : lte(column, until);

  const [
    lessonRows,
    noteRows,
    bookmarkRows,
    sessionRows,
    attemptRows,
    projectRows,
    resourceRows,
    tombstoneRows,
    evidenceRows,
    assessmentRows,
    reviewRows,
  ] = await Promise.all([
      db.select().from(userLessonProgress).where(and(eq(userLessonProgress.userId, userId), changed(userLessonProgress.updatedAt))),
      db.select().from(notes).where(and(eq(notes.userId, userId), changed(notes.updatedAt))),
      db.select().from(bookmarks).where(and(eq(bookmarks.userId, userId), changed(bookmarks.updatedAt))),
      db.select().from(studySessions).where(and(eq(studySessions.userId, userId), changed(studySessions.updatedAt))),
      db.select().from(quizAttempts).where(and(eq(quizAttempts.userId, userId), changed(quizAttempts.updatedAt))),
      db.select().from(projectProgress).where(and(eq(projectProgress.userId, userId), changed(projectProgress.updatedAt))),
      db.select().from(userResourceProgress).where(and(eq(userResourceProgress.userId, userId), changed(userResourceProgress.updatedAt))),
      db.select().from(tombstones).where(and(eq(tombstones.userId, userId), changed(tombstones.createdAt))),
      db.select().from(projectEvidence).where(and(eq(projectEvidence.userId, userId), changed(projectEvidence.updatedAt))),
      db.select().from(projectSelfAssessments).where(and(eq(projectSelfAssessments.userId, userId), changed(projectSelfAssessments.updatedAt))),
      db.select().from(reviewHistory).where(and(eq(reviewHistory.userId, userId), changed(reviewHistory.updatedAt))),
    ]);

  const changes: RemoteChange[] = [];

  for (const row of lessonRows) {
    changes.push({
      entityType: "lesson_progress",
      entityId: row.lessonKey,
      operation: "upsert",
      updatedAt: row.updatedAt.toISOString(),
      data: {
        lessonId: row.lessonKey,
        status: row.status,
        readingComplete: row.readingComplete,
        requiredResourcesComplete: row.requiredResourcesComplete,
        practiceComplete: row.practiceComplete,
        projectComplete: row.projectComplete,
        masteryScore: row.masteryScore,
        needsReview: row.needsReview,
        startedAt: row.startedAt?.toISOString() ?? null,
        completedAt: row.completedAt?.toISOString() ?? null,
        masteredAt: row.masteredAt?.toISOString() ?? null,
        localRevision: row.localRevision,
      },
    });
  }

  for (const row of resourceRows) {
    const metadata = (row.metadata ?? {}) as { githubState?: string | null };
    changes.push({
      entityType: "resource_progress",
      entityId: row.resourceId,
      operation: "upsert",
      updatedAt: row.updatedAt.toISOString(),
      data: {
        resourceId: row.resourceId,
        started: true,
        completed: row.status === "completed",
        githubState: metadata.githubState ?? null,
        completedAt: row.completedAt?.toISOString() ?? null,
      },
    });
  }

  for (const row of noteRows) {
    changes.push({
      entityType: "note",
      entityId: row.id,
      operation: "upsert",
      updatedAt: row.updatedAt.toISOString(),
      data: {
        id: row.id,
        lessonId: row.lessonKey,
        resourceId: row.resourceId,
        projectId: row.projectId,
        content: row.content,
        contentRevision: row.contentRevision,
        conflictState: row.conflictState,
      },
    });
  }

  for (const row of bookmarkRows) {
    changes.push({
      entityType: "bookmark",
      entityId: row.id,
      operation: row.deletedAt ? "delete" : "upsert",
      updatedAt: row.updatedAt.toISOString(),
      data: {
        id: row.id,
        lessonId: row.lessonKey,
        resourceId: row.resourceId,
        projectId: row.projectId,
        targetType: row.targetType,
        title: row.title,
        href: row.href,
        deletedAt: row.deletedAt?.toISOString() ?? null,
      },
    });
  }

  for (const row of sessionRows) {
    changes.push({
      entityType: "study_session",
      entityId: row.clientSessionId,
      operation: "upsert",
      updatedAt: row.updatedAt.toISOString(),
      data: {
        clientSessionId: row.clientSessionId,
        deviceId: row.deviceId,
        lessonId: row.lessonKey,
        resourceId: row.resourceId,
        projectId: row.projectId,
        startedAt: row.startedAt.toISOString(),
        endedAt: row.endedAt?.toISOString() ?? null,
        durationSeconds: row.durationSeconds ?? 0,
      },
    });
  }

  for (const row of attemptRows) {
    changes.push({
      entityType: "quiz_attempt",
      entityId: row.attemptId,
      operation: "upsert",
      updatedAt: row.updatedAt.toISOString(),
      data: {
        attemptId: row.attemptId,
        quizId: row.quizId,
        lessonId: row.lessonId,
        answers: row.answers,
        score: row.score,
        maxScore: row.maxScore,
        percentage: row.percentage,
        startedAt: row.startedAt?.toISOString() ?? null,
        submittedAt: row.submittedAt?.toISOString() ?? null,
        attemptNumber: row.attemptNumber,
      },
    });
  }

  for (const row of reviewRows) {
    changes.push({
      entityType: "review_history",
      entityId: row.id,
      operation: "upsert",
      updatedAt: row.updatedAt.toISOString(),
      data: {
        skillId: row.skillId,
        successfulReviews: row.successfulReviews,
        lastReviewedAt: row.lastReviewedAt ? row.lastReviewedAt.toISOString() : null,
        snoozedUntil: row.snoozedUntil ? row.snoozedUntil.toISOString() : null,
      },
    });
  }

  for (const row of tombstoneRows) {
    changes.push({
      entityType: "tombstone",
      entityId: row.entityId,
      operation: "delete",
      updatedAt: row.deletedAt.toISOString(),
      data: {
        entityId: row.entityId,
        entityType: row.entityType,
        deletedAt: row.deletedAt.toISOString(),
        revision: row.revision,
      },
    });
  }

  for (const row of projectRows) {
    changes.push({
      entityType: "project_progress",
      entityId: row.id,
      operation: "upsert",
      updatedAt: row.updatedAt.toISOString(),
      data: {
        projectId: row.projectId,
        milestoneId: row.milestoneId,
        completed: row.completed,
        completedAt: row.completedAt?.toISOString() ?? null,
        evidenceUrl: row.evidenceUrl,
        notes: row.note,
      },
    });
  }

  for (const row of evidenceRows) {
    changes.push({
      entityType: "project_evidence",
      entityId: row.id,
      operation: row.deletedAt ? "delete" : "upsert",
      updatedAt: row.updatedAt.toISOString(),
      data: {
        id: row.id,
        projectId: row.projectId,
        kind: row.kind,
        value: row.value,
        title: row.title,
        details: row.details,
        selfReported: row.selfReported,
        deletedAt: row.deletedAt?.toISOString() ?? null,
        localRevision: row.localRevision,
      },
    });
  }

  for (const row of assessmentRows) {
    changes.push({
      entityType: "project_self_assessment",
      entityId: row.id,
      operation: "upsert",
      updatedAt: row.updatedAt.toISOString(),
      data: {
        id: row.id,
        projectId: row.projectId,
        scores: row.scores,
        totalEarned: row.totalEarned,
        totalMax: row.totalMax,
        localRevision: row.localRevision,
      },
    });
  }

  return changes;
}

export interface CloudSnapshot {
  cursor: string | null;
  lessons: Array<Record<string, unknown>>;
  resources: Array<Record<string, unknown>>;
  notes: Array<Record<string, unknown>>;
  bookmarks: Array<Record<string, unknown>>;
  studySessions: Array<Record<string, unknown>>;
  quizAttempts: Array<Record<string, unknown>>;
  projectProgress: Array<Record<string, unknown>>;
  projectEvidence: Array<Record<string, unknown>>;
  projectSelfAssessments: Array<Record<string, unknown>>;
  reviewHistory: Array<Record<string, unknown>>;
  tombstones: Array<Record<string, unknown>>;
  roadmapState: Record<string, unknown> | null;
}

/** Full cloud snapshot used by the guest -> account merge flow. */
export async function getCloudSnapshot(userId: string): Promise<CloudSnapshot> {
  const [
    lessonRows,
    resourceRows,
    noteRows,
    bookmarkRows,
    sessionRows,
    attemptRows,
    projectRows,
    roadmapRows,
    batches,
    tombstoneRows,
    evidenceRows,
    assessmentRows,
    reviewRows,
  ] = await Promise.all([
      db.select().from(userLessonProgress).where(eq(userLessonProgress.userId, userId)),
      db.select().from(userResourceProgress).where(eq(userResourceProgress.userId, userId)),
      db.select().from(notes).where(eq(notes.userId, userId)),
      db.select().from(bookmarks).where(eq(bookmarks.userId, userId)),
      db.select().from(studySessions).where(eq(studySessions.userId, userId)),
      db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)),
      db.select().from(projectProgress).where(eq(projectProgress.userId, userId)),
      db.select().from(roadmapState).where(eq(roadmapState.userId, userId)),
      db.select().from(syncBatches).where(eq(syncBatches.userId, userId)).orderBy(asc(syncBatches.createdAt)),
      db.select().from(tombstones).where(eq(tombstones.userId, userId)),
      db.select().from(projectEvidence).where(eq(projectEvidence.userId, userId)),
      db.select().from(projectSelfAssessments).where(eq(projectSelfAssessments.userId, userId)),
      db.select().from(reviewHistory).where(eq(reviewHistory.userId, userId)),
    ]);

  const deletedIds = new Set(tombstoneRows.map((row) => `${row.entityType}:${row.entityId}`));
  const visibleNotes = noteRows.filter((row) => !deletedIds.has(`note:${row.id}`));
  const visibleBookmarks = bookmarkRows.filter(
    (row) => !deletedIds.has(`bookmark:${row.id}`)
  );

  return {
    cursor: batches.length ? batches[batches.length - 1].createdAt.toISOString() : null,
    lessons: lessonRows.map((row) => ({
      lessonId: row.lessonKey,
      status: row.status,
      readingComplete: row.readingComplete,
      requiredResourcesComplete: row.requiredResourcesComplete,
      practiceComplete: row.practiceComplete,
      projectComplete: row.projectComplete,
      masteryScore: row.masteryScore,
      needsReview: row.needsReview,
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      masteredAt: row.masteredAt?.toISOString() ?? null,
    })),
    resources: resourceRows.map((row) => ({
      resourceId: row.resourceId,
      completed: row.status === "completed",
      started: true,
      githubState: ((row.metadata ?? {}) as { githubState?: string | null }).githubState ?? null,
    })),
    notes: visibleNotes.map((row) => ({
      id: row.id,
      lessonId: row.lessonKey,
      resourceId: row.resourceId,
      projectId: row.projectId,
      content: row.content,
      contentRevision: row.contentRevision,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    bookmarks: visibleBookmarks.map((row) => ({
      id: row.id,
      lessonId: row.lessonKey,
      resourceId: row.resourceId,
      projectId: row.projectId,
      targetType: row.targetType,
      title: row.title,
      href: row.href,
      deletedAt: row.deletedAt?.toISOString() ?? null,
    })),
    studySessions: sessionRows.map((row) => ({
      clientSessionId: row.clientSessionId,
      deviceId: row.deviceId,
      lessonId: row.lessonKey,
      resourceId: row.resourceId,
      projectId: row.projectId,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt?.toISOString() ?? null,
      durationSeconds: row.durationSeconds ?? 0,
    })),
    quizAttempts: attemptRows.map((row) => ({
      attemptId: row.attemptId,
      quizId: row.quizId,
      lessonId: row.lessonId,
      answers: row.answers,
      score: row.score,
      maxScore: row.maxScore,
      percentage: row.percentage,
      startedAt: row.startedAt?.toISOString() ?? null,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      attemptNumber: row.attemptNumber,
    })),
    tombstones: tombstoneRows.map((row) => ({
      entityId: row.entityId,
      entityType: row.entityType,
      deletedAt: row.deletedAt.toISOString(),
      revision: row.revision,
    })),
    projectProgress: projectRows.map((row) => ({
      projectId: row.projectId,
      milestoneId: row.milestoneId,
      completed: row.completed,
      completedAt: row.completedAt?.toISOString() ?? null,
      evidenceUrl: row.evidenceUrl,
      notes: row.note,
    })),
    projectEvidence: evidenceRows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      kind: row.kind,
      value: row.value,
      title: row.title,
      details: row.details,
      selfReported: row.selfReported,
      deletedAt: row.deletedAt?.toISOString() ?? null,
      localRevision: row.localRevision,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    projectSelfAssessments: assessmentRows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      scores: row.scores,
      totalEarned: row.totalEarned,
      totalMax: row.totalMax,
      localRevision: row.localRevision,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    reviewHistory: reviewRows.map((row) => ({
      id: row.id,
      skillId: row.skillId,
      successfulReviews: row.successfulReviews,
      lastReviewedAt: row.lastReviewedAt ? row.lastReviewedAt.toISOString() : null,
      snoozedUntil: row.snoozedUntil ? row.snoozedUntil.toISOString() : null,
      localRevision: row.localRevision,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    roadmapState: roadmapRows[0]
      ? { state: roadmapRows[0].state, updatedAt: roadmapRows[0].updatedAt.toISOString() }
      : null,
  };
}
