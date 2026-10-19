import { db, type Note, type SyncStatus } from "./db";
import {
  mergeCompletionFlags,
  monotonicMergeStatus,
  type LessonStatus,
} from "./completion";
import { mergeResourceProgress, type GithubResourceState } from "./resource-rules";
import { detectNoteConflict } from "./conflicts";
import { syncQueue } from "./sync-queue";
import { createBase, nowIso } from "./records";

export interface CloudLesson {
  lessonId: string;
  status: LessonStatus;
  readingComplete?: boolean;
  requiredResourcesComplete?: boolean;
  practiceComplete?: boolean;
  projectComplete?: boolean;
  masteryScore?: number | null;
  needsReview?: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  masteredAt?: string | null;
  localRevision?: number;
  title?: string | null;
  href?: string | null;
}

export interface CloudNote {
  id: string;
  lessonId?: string | null;
  resourceId?: string | null;
  projectId?: string | null;
  content: string;
  contentRevision?: number;
  updatedAt?: string;
}

export interface CloudBookmark {
  id: string;
  lessonId?: string | null;
  resourceId?: string | null;
  projectId?: string | null;
  targetType?: string;
  title?: string | null;
  href?: string | null;
  deletedAt?: string | null;
}

export interface CloudSnapshotLike {
  lessons?: CloudLesson[];
  resources?: Array<{
    resourceId: string;
    started?: boolean;
    completed?: boolean;
    githubState?: GithubResourceState | null;
    completedAt?: string | null;
  }>;
  notes?: CloudNote[];
  bookmarks?: CloudBookmark[];
  studySessions?: Array<{
    clientSessionId: string;
    deviceId?: string | null;
    lessonId?: string | null;
    resourceId?: string | null;
    projectId?: string | null;
    startedAt: string;
    endedAt?: string | null;
    durationSeconds?: number;
  }>;
  quizAttempts?: Array<{
    attemptId: string;
    quizId?: string | null;
    lessonId?: string | null;
    answers?: unknown;
    score?: number | null;
    maxScore?: number | null;
    percentage?: number | null;
    startedAt?: string | null;
    submittedAt?: string | null;
    attemptNumber?: number;
  }>;
  projectProgress?: Array<{
    projectId: string;
    milestoneId?: string | null;
    completed?: boolean;
    completedAt?: string | null;
    evidenceUrl?: string | null;
    notes?: string | null;
  }>;
  tombstones?: Array<{
    entityId: string;
    entityType: string;
    deletedAt: string;
    revision?: number;
  }>;
  roadmapState?: Record<string, unknown> | null;
  cursor?: string | null;
}

export interface MergeCounts {
  lessonProgress: number;
  resourceProgress: number;
  notes: number;
  bookmarks: number;
  studySessions: number;
  quizAttempts: number;
  projectProgress: number;
}

export interface MergeSummary {
  /** Records that live on this device and were pushed toward the account. */
  localUploaded: MergeCounts;
  /** Cloud records that survived the merge (cloud-only or cloud-newer). */
  cloudPreserved: MergeCounts;
  conflicts: number;
  mergedAt: string;
}

export function emptyMergeCounts(): MergeCounts {
  return {
    lessonProgress: 0,
    resourceProgress: 0,
    notes: 0,
    bookmarks: 0,
    studySessions: 0,
    quizAttempts: 0,
    projectProgress: 0,
  };
}

export function mergeLessonRecords<T extends CloudLesson & { id?: string }>(
  local?: T,
  cloud?: T
): T {
  const a = local ?? cloud;
  const b = cloud ?? local;
  if (!a || !b) return (a ?? b) as T;

  const flags = mergeCompletionFlags(
    {
      readingComplete: a.readingComplete ?? false,
      requiredResourcesComplete: a.requiredResourcesComplete ?? false,
      practiceComplete: a.practiceComplete ?? false,
      projectComplete: a.projectComplete ?? false,
    },
    {
      readingComplete: b.readingComplete ?? false,
      requiredResourcesComplete: b.requiredResourcesComplete ?? false,
      practiceComplete: b.practiceComplete ?? false,
      projectComplete: b.projectComplete ?? false,
    }
  );

  const masteryScores = [a.masteryScore, b.masteryScore].filter(
    (score): score is number => typeof score === "number"
  );

  return {
    ...a,
    ...flags,
    status: monotonicMergeStatus(a.status, b.status),
    masteryScore: masteryScores.length ? Math.max(...masteryScores) : null,
    needsReview: Boolean(a.needsReview || b.needsReview),
    startedAt: earliest(a.startedAt ?? null, b.startedAt ?? null),
    completedAt: earliest(a.completedAt ?? null, b.completedAt ?? null),
    masteredAt: earliest(a.masteredAt ?? null, b.masteredAt ?? null),
  };
}

function earliest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function localBase(overrides?: { id?: string; syncStatus?: SyncStatus }) {
  return createBase({ syncStatus: overrides?.syncStatus });
}

/**
 * Deterministic guest -> account merge.
 *
 * Local data is never deleted. Cloud records are merged monotonically into the
 * local database and every local record that differs from cloud is queued for
 * upload, so the merge summary reflects both directions.
 */
export async function performGuestAccountMerge(
  cloud: CloudSnapshotLike
): Promise<MergeSummary> {
  const summary: MergeSummary = {
    localUploaded: emptyMergeCounts(),
    cloudPreserved: emptyMergeCounts(),
    conflicts: 0,
    mergedAt: nowIso(),
  };

  await applyCloudTombstones(cloud.tombstones ?? []);
  await mergeLessons(cloud.lessons ?? [], summary);
  await mergeResources(cloud.resources ?? [], summary);
  await mergeNotes(cloud.notes ?? [], summary);
  await mergeBookmarks(cloud.bookmarks ?? [], summary);
  await mergeStudySessions(cloud.studySessions ?? [], summary);
  await mergeQuizAttempts(cloud.quizAttempts ?? [], summary);
  await mergeProjects(cloud.projectProgress ?? [], summary);
  await mergeRoadmap(cloud.roadmapState ?? null);

  return summary;
}

async function applyCloudTombstones(
  tombstones: NonNullable<CloudSnapshotLike["tombstones"]>
) {
  for (const tombstone of tombstones) {
    if (tombstone.entityType === "note") {
      await db.notes.delete(tombstone.entityId);
      await db.conflicts.delete(tombstone.entityId);
      await db.conflicts.delete(`sync-conflict-${tombstone.entityId}`);
      continue;
    }
    if (tombstone.entityType === "bookmark") {
      const existing = await db.bookmarks.get(tombstone.entityId);
      if (existing) {
        await db.bookmarks.update(existing.id, {
          deletedAt: tombstone.deletedAt,
          syncStatus: "synced",
          updatedAt: nowIso(),
        });
      }
      await db.tombstones.put({
        id: `cloud-tombstone-${tombstone.entityId}`,
        createdAt: tombstone.deletedAt,
        updatedAt: tombstone.deletedAt,
        localRevision: 1,
        syncStatus: "synced",
        entityId: tombstone.entityId,
        entityType: "bookmark",
        deletedAt: tombstone.deletedAt,
        revision: tombstone.revision ?? 1,
      });
    }
  }
}

async function mergeLessons(cloudLessons: CloudLesson[], summary: MergeSummary) {
  const local = await db.lessonProgress.toArray();
  const localByLesson = new Map(local.map((row) => [row.lessonId, row]));
  const cloudByLesson = new Map(cloudLessons.map((row) => [row.lessonId, row]));

  for (const lessonId of new Set([...localByLesson.keys(), ...cloudByLesson.keys()])) {
    const localRow = localByLesson.get(lessonId);
    const cloudRow = cloudByLesson.get(lessonId);

    const merged = mergeLessonRecords(
      localRow
        ? {
            ...localRow,
            lessonId: localRow.lessonId,
            readingComplete: localRow.readingComplete,
            requiredResourcesComplete: localRow.requiredResourcesComplete,
            practiceComplete: localRow.practiceComplete,
            projectComplete: localRow.projectComplete,
            masteryScore: localRow.masteryScore,
            needsReview: localRow.needsReview,
            title: localRow.lessonTitle ?? null,
            href: localRow.lessonHref ?? null,
          }
        : undefined,
      cloudRow
    );

    const statusDifferent =
      !cloudRow ||
      merged.status !== cloudRow.status ||
      merged.readingComplete !== Boolean(cloudRow.readingComplete) ||
      merged.requiredResourcesComplete !== Boolean(cloudRow.requiredResourcesComplete) ||
      merged.practiceComplete !== Boolean(cloudRow.practiceComplete) ||
      merged.projectComplete !== Boolean(cloudRow.projectComplete) ||
      (merged.masteryScore ?? null) !== (cloudRow.masteryScore ?? null);

    const record = {
      ...(localRow ?? {
        ...localBase(),
        lessonId,
        lessonTitle: merged.title ?? null,
        lessonHref: merged.href ?? null,
        phaseSlug: null,
        phaseNumber: null,
      }),
      lessonId,
      status: merged.status,
      readingComplete: merged.readingComplete ?? false,
      requiredResourcesComplete: merged.requiredResourcesComplete ?? false,
      practiceComplete: merged.practiceComplete ?? false,
      projectComplete: merged.projectComplete ?? false,
      masteryScore: merged.masteryScore ?? null,
      needsReview: Boolean(merged.needsReview),
      startedAt: merged.startedAt ?? localRow?.startedAt ?? null,
      completedAt: merged.completedAt ?? localRow?.completedAt ?? null,
      masteredAt: merged.masteredAt ?? localRow?.masteredAt ?? null,
      localRevision: (localRow?.localRevision ?? 0) + 1,
      syncStatus: statusDifferent ? ("pending" as const) : localRow?.syncStatus ?? "synced",
      updatedAt: nowIso(),
    };

    await db.lessonProgress.put(record);

    if (localRow) summary.localUploaded.lessonProgress += 1;
    if (cloudRow && !localRow) summary.cloudPreserved.lessonProgress += 1;

    if (statusDifferent || !cloudRow) {
      await syncQueue.enqueue({
        entityType: "lesson_progress",
        entityId: record.id,
        operation: "update",
        payload: record,
        baseRevision: record.localRevision - 1,
      });
    }
  }
}

async function mergeResources(
  cloudResources: NonNullable<CloudSnapshotLike["resources"]>,
  summary: MergeSummary
) {
  const local = await db.resourceProgress.toArray();
  const localById = new Map(local.map((row) => [row.resourceId, row]));
  const cloudById = new Map(cloudResources.map((row) => [row.resourceId, row]));

  for (const resourceId of new Set([...localById.keys(), ...cloudById.keys()])) {
    const localRow = localById.get(resourceId);
    const cloudRow = cloudById.get(resourceId);
    if (!localRow && !cloudRow) continue;

    const merged = mergeResourceProgress(
      {
        started: localRow?.started ?? false,
        completed: localRow?.completed ?? false,
        githubState: localRow?.githubState ?? null,
        completedAt: localRow?.completedAt ?? null,
        lastOpenedAt: localRow?.lastOpenedAt ?? null,
      },
      {
        started: cloudRow?.started ?? false,
        completed: cloudRow?.completed ?? false,
        githubState: cloudRow?.githubState ?? null,
        completedAt: cloudRow?.completedAt ?? null,
        lastOpenedAt: null,
      }
    );

    const record = {
      ...(localRow ?? {
        ...localBase(),
        resourceId,
        bookmarked: false,
        notes: null,
        resourceType: null,
        resourceTitle: null,
        href: null,
      }),
      resourceId,
      started: merged.started,
      completed: merged.completed,
      githubState: merged.githubState,
      completedAt: merged.completedAt,
      lastOpenedAt: merged.lastOpenedAt,
      localRevision: (localRow?.localRevision ?? 0) + 1,
      syncStatus: "pending" as const,
      updatedAt: nowIso(),
    };

    await db.resourceProgress.put(record);
    if (localRow) summary.localUploaded.resourceProgress += 1;
    if (cloudRow && !localRow) summary.cloudPreserved.resourceProgress += 1;

    await syncQueue.enqueue({
      entityType: "resource_progress",
      entityId: record.id,
      operation: "update",
      payload: record,
      baseRevision: record.localRevision - 1,
    });
  }
}

async function mergeNotes(cloudNotes: CloudNote[], summary: MergeSummary) {
  const local = await db.notes.toArray();
  const localById = new Map(local.map((row) => [row.id, row]));
  const cloudById = new Map(cloudNotes.map((row) => [row.id, row]));

  for (const noteId of new Set([...localById.keys(), ...cloudById.keys()])) {
    const localRow = localById.get(noteId);
    const cloudRow = cloudById.get(noteId);

    if (localRow && cloudRow) {
      const conflict = detectNoteConflict(
        { content: localRow.content, localRevision: localRow.contentRevision },
        {
          content: cloudRow.content,
          localRevision: cloudRow.contentRevision ?? 1,
        },
        Math.min(localRow.contentRevision, cloudRow.contentRevision ?? 1) - 1
      );

      if (conflict) {
        summary.conflicts += 1;
        const conflictBackup = cloudRow.content;
        await db.notes.update(noteId, {
          conflictState: "unresolved",
          conflictBackup,
          updatedAt: nowIso(),
        });
        await db.conflicts.put({
          id: `note-conflict-${noteId}`,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          localRevision: localRow.localRevision,
          syncStatus: "conflict",
          entityType: "note",
          entityId: noteId,
          localData: { ...localRow, conflictBackup: null },
          remoteData: cloudRow,
          conflictState: "unresolved",
          resolvedAt: null,
        });
        await syncQueue.enqueue({
          entityType: "note",
          entityId: noteId,
          operation: "update",
          payload: { ...localRow, conflictState: "unresolved", conflictBackup },
          baseRevision: localRow.localRevision,
        });
        summary.localUploaded.notes += 1;
        continue;
      }

      // Identical content: keep the newest revision without a conflict.
      const keepLocal = localRow.content === cloudRow.content;
      if (!keepLocal) {
        await db.notes.update(noteId, {
          content: cloudRow.content,
          contentRevision: Math.max(
            localRow.contentRevision,
            cloudRow.contentRevision ?? 1
          ),
          syncStatus: "synced",
          updatedAt: nowIso(),
        });
        summary.cloudPreserved.notes += 1;
      } else {
        summary.localUploaded.notes += 1;
      }
      continue;
    }

    if (localRow && !cloudRow) {
      summary.localUploaded.notes += 1;
      await syncQueue.enqueue({
        entityType: "note",
        entityId: noteId,
        operation: "update",
        payload: localRow,
        baseRevision: localRow.localRevision,
      });
      continue;
    }

    if (cloudRow && !localRow) {
      summary.cloudPreserved.notes += 1;
      const record: Note = {
        ...localBase({ id: cloudRow.id, syncStatus: "synced" }),
        lessonId: cloudRow.lessonId ?? null,
        resourceId: cloudRow.resourceId ?? null,
        projectId: cloudRow.projectId ?? null,
        content: cloudRow.content,
        contentRevision: cloudRow.contentRevision ?? 1,
        conflictState: "none",
        conflictBackup: null,
      };
      await db.notes.put(record);
    }
  }
}

async function mergeBookmarks(cloudBookmarks: CloudBookmark[], summary: MergeSummary) {
  const local = await db.bookmarks.toArray();
  const localById = new Map(local.map((row) => [row.id, row]));
  const cloudById = new Map(cloudBookmarks.map((row) => [row.id, row]));

  for (const bookmarkId of new Set([...localById.keys(), ...cloudById.keys()])) {
    const localRow = localById.get(bookmarkId);
    const cloudRow = cloudById.get(bookmarkId);

    if (cloudRow?.deletedAt) {
      if (localRow && !localRow.deletedAt) {
        await db.bookmarks.update(bookmarkId, {
          deletedAt: cloudRow.deletedAt,
          syncStatus: "synced",
          updatedAt: nowIso(),
        });
        await db.tombstones.put({
          ...localBase(),
          entityId: bookmarkId,
          entityType: "bookmark",
          deletedAt: cloudRow.deletedAt,
          revision: localRow.localRevision,
        });
      }
      continue;
    }

    if (localRow) {
      if (!localRow.deletedAt) {
        summary.localUploaded.bookmarks += 1;
        await syncQueue.enqueue({
          entityType: "bookmark",
          entityId: bookmarkId,
          operation: "update",
          payload: localRow,
          baseRevision: localRow.localRevision,
        });
      }
      continue;
    }

    if (cloudRow) {
      summary.cloudPreserved.bookmarks += 1;
      await db.bookmarks.put({
        ...localBase({ id: cloudRow.id, syncStatus: "synced" }),
        lessonId: cloudRow.lessonId ?? null,
        resourceId: cloudRow.resourceId ?? null,
        projectId: cloudRow.projectId ?? null,
        targetType: (cloudRow.targetType as never) ?? "lesson",
        title: cloudRow.title ?? null,
        href: cloudRow.href ?? null,
        note: null,
        deletedAt: null,
      });
    }
  }
}

async function mergeStudySessions(
  cloudSessions: NonNullable<CloudSnapshotLike["studySessions"]>,
  summary: MergeSummary
) {
  const local = await db.studySessions.toArray();
  const localIds = new Set(local.map((row) => row.clientSessionId));

  summary.localUploaded.studySessions = local.length;

  for (const session of cloudSessions) {
    if (localIds.has(session.clientSessionId)) continue;
    summary.cloudPreserved.studySessions += 1;
    await db.studySessions.put({
      ...localBase({ syncStatus: "synced" }),
      clientSessionId: session.clientSessionId,
      deviceId: session.deviceId ?? "",
      lessonId: session.lessonId ?? null,
      resourceId: session.resourceId ?? null,
      projectId: session.projectId ?? null,
      startedAt: session.startedAt,
      endedAt: session.endedAt ?? null,
      durationSeconds: session.durationSeconds ?? 0,
    });
  }

  for (const localRow of local) {
    await syncQueue.enqueue({
      entityType: "study_session",
      entityId: localRow.id,
      operation: "create",
      payload: localRow,
      baseRevision: 0,
    });
  }
}

async function mergeQuizAttempts(
  cloudAttempts: NonNullable<CloudSnapshotLike["quizAttempts"]>,
  summary: MergeSummary
) {
  const local = await db.quizAttempts.toArray();
  const localIds = new Set(local.map((row) => row.attemptId));

  summary.localUploaded.quizAttempts = local.length;

  for (const attempt of cloudAttempts) {
    if (localIds.has(attempt.attemptId)) continue;
    summary.cloudPreserved.quizAttempts += 1;
    await db.quizAttempts.put({
      ...localBase({ syncStatus: "synced" }),
      attemptId: attempt.attemptId,
      quizId: attempt.quizId ?? "",
      lessonId: attempt.lessonId ?? "",
      answers: attempt.answers ?? {},
      score: attempt.score ?? null,
      maxScore: attempt.maxScore ?? null,
      percentage: attempt.percentage ?? null,
      startedAt: attempt.startedAt ?? nowIso(),
      submittedAt: attempt.submittedAt ?? null,
      attemptNumber: attempt.attemptNumber ?? 1,
    });
  }

  for (const localRow of local) {
    await syncQueue.enqueue({
      entityType: "quiz_attempt",
      entityId: localRow.id,
      operation: "create",
      payload: localRow,
      baseRevision: 0,
    });
  }
}

async function mergeProjects(
  cloudProjects: NonNullable<CloudSnapshotLike["projectProgress"]>,
  summary: MergeSummary
) {
  const local = await db.projectProgress.toArray();
  const key = (projectId: string, milestoneId: string | null) =>
    `${projectId}:${milestoneId ?? ""}`;
  const localByKey = new Map(local.map((row) => [key(row.projectId, row.milestoneId), row]));

  for (const cloudRow of cloudProjects) {
    const k = key(cloudRow.projectId, cloudRow.milestoneId ?? null);
    const localRow = localByKey.get(k);

    if (localRow) {
      const completed = localRow.completed || Boolean(cloudRow.completed);
      if (completed !== localRow.completed) {
        await db.projectProgress.update(localRow.id, {
          completed,
          completedAt: localRow.completedAt ?? cloudRow.completedAt ?? nowIso(),
          updatedAt: nowIso(),
        });
      }
      summary.localUploaded.projectProgress += 1;
      await syncQueue.enqueue({
        entityType: "project_progress",
        entityId: localRow.id,
        operation: "update",
        payload: { ...localRow, completed },
        baseRevision: localRow.localRevision,
      });
      continue;
    }

    summary.cloudPreserved.projectProgress += 1;
    await db.projectProgress.put({
      ...localBase({ syncStatus: "synced" }),
      projectId: cloudRow.projectId,
      milestoneId: cloudRow.milestoneId ?? null,
      completed: Boolean(cloudRow.completed),
      completedAt: cloudRow.completedAt ?? null,
      evidenceUrl: cloudRow.evidenceUrl ?? null,
      notes: cloudRow.notes ?? null,
    });
  }

}

async function mergeRoadmap(cloudRoadmap: Record<string, unknown> | null) {
  if (!cloudRoadmap) return;
  const local = await db.roadmapState.toArray();
  if (local.length > 0) return;
  await db.roadmapState.put({
    ...localBase({ syncStatus: "synced" }),
    state: cloudRoadmap.state ?? cloudRoadmap,
  });
}
