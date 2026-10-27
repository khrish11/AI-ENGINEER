import { v4 as uuidv4 } from "uuid";
import { db, type SyncStatus } from "../db";
import { syncQueue } from "../sync-queue";
import { getOrCreateDeviceId, getLocalProfile, updateLastSync } from "../device";
import { SyncRequestSchema, SyncResponseSchema, type SyncResponse } from "./protocol";
import {
  performGuestAccountMerge,
  type CloudSnapshotLike,
  type MergeSummary,
} from "../merge";
import {
  mergeCompletionFlags,
  monotonicMergeStatus,
  type LessonStatus,
} from "../completion";
import { mergeResourceProgress, type GithubResourceState } from "../resource-rules";
import { nowIso } from "../records";

interface ProjectEvidenceRemoteDetails {
  branch?: string | null;
  commitSha?: string | null;
  prUrl?: string | null;
  directory?: string | null;
}

// BUG-10 retention policy: local delete tombstones are bookkeeping only —
// deletes reach the cloud through the mutation queue, and no application
// read path queries db.tombstones — so keep a bounded 90-day audit window
// instead of letting the table grow forever with createBase()-id rows.
const TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export async function pruneLocalTombstones(): Promise<number> {
  const cutoff = new Date(Date.now() - TOMBSTONE_RETENTION_MS).toISOString();
  const stale = await db.tombstones
    .filter((row) => typeof row.deletedAt === "string" && row.deletedAt < cutoff)
    .primaryKeys();
  if (stale.length > 0) await db.tombstones.bulkDelete(stale);
  return stale.length;
}

export interface QueuedRemoteChange {
  entityType: string;
  entityId: string;
  operation: "upsert" | "delete";
  data: Record<string, unknown>;
  updatedAt: string;
}

export async function flushSyncQueue(): Promise<
  SyncResponse | { skipped: "offline" | "guest" | "unauthenticated" | "backoff" }
> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { skipped: "offline" };
  }

  const profile = await getLocalProfile();
  if (!profile?.isAuthenticated) {
    return { skipped: "guest" };
  }

  const pending = await syncQueue.getPending();
  if (pending.length === 0) {
    return {
      accepted: [],
      rejected: [],
      remoteChanges: [],
      conflicts: [],
      nextSyncCursor: (await db.syncMetadata.get("sync_meta"))?.lastSyncCursor ?? "",
    };
  }

  const now = Date.now();
  const eligible = pending.filter((item) => {
    if (item.retryCount <= 0) return true;
    const lastAttempt = Date.parse(item.updatedAt);
    if (Number.isNaN(lastAttempt)) return true;
    return now - lastAttempt >= syncQueue.retryDelayMs(item.retryCount);
  });

  if (eligible.length === 0) {
    return { skipped: "backoff" };
  }

  const deviceId = await getOrCreateDeviceId();
  const metadata = await db.syncMetadata.get("sync_meta");
  // First sync ever on this device: the server treats a null cursor as
  // "send the whole account history", which would merge another device or
  // browser session's cloud rows straight into this client. That passive
  // full-history download breaks account isolation (req #8); a genuine merge
  // is an explicit action (settings sign-in / Sync now -> forceMerge). So the
  // initial flush only uploads local mutations and advances the cursor.
  const isBootstrapSync = !metadata?.lastSyncCursor;
  const body = SyncRequestSchema.parse({
    clientBatchId: uuidv4(),
    deviceId,
    lastSyncCursor: metadata?.lastSyncCursor ?? null,
    mutations: eligible.map((item) => ({
      mutationId: item.mutationId,
      entityType: item.entityType as never,
      entityId: item.entityId,
      operation: item.operation,
      payload: (item.payload ?? {}) as Record<string, unknown>,
      baseRevision: item.baseRevision,
    })),
  });

  const response = await fetch("/api/sync/v1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    return { skipped: "unauthenticated" };
  }

  if (!response.ok) {
    // Only touch rows this batch still owns. If a newer mutation coalesced
    // into one while the request was in flight (its mutationId turned over),
    // leave it pending — a stale 5xx/4xx must not retry/fail fresh work.
    const current = await db.syncQueue.bulkGet(eligible.map((item) => item.id));
    for (let i = 0; i < eligible.length; i += 1) {
      const item = eligible[i];
      if (current[i]?.mutationId !== item.mutationId) continue;
      if (response.status >= 500) await syncQueue.incrementRetry(item.id);
      else await syncQueue.markFailed(item.id);
    }
    throw new Error(`Sync failed: ${response.status}`);
  }

  const json = SyncResponseSchema.parse(await response.json());

  // Apply real-time deltas on every sync *after* bootstrap; skip the full
  // history download on the first one (see isBootstrapSync above).
  if (!isBootstrapSync) {
    await applyRemoteChanges(json.remoteChanges as QueuedRemoteChange[]);
  }

  const rejectedIds = new Set(json.rejected.map((r) => r.entityId));
  const acceptedItems = eligible.filter((item) => !rejectedIds.has(item.entityId));
  // Acknowledge by identity, not just row id: rows re-mutated during this
  // request stay pending so their newer mutation is flushed next cycle.
  await syncQueue.acknowledgeCommitted(
    acceptedItems.map((item) => ({ id: item.id, mutationId: item.mutationId }))
  );

  for (const rejected of json.rejected) {
    const item = eligible.find((p) => p.entityId === rejected.entityId);
    if (!item) continue;
    if ((await db.syncQueue.get(item.id))?.mutationId !== item.mutationId) continue;
    if (rejected.retryable) await syncQueue.incrementRetry(item.id);
    else await syncQueue.markFailed(item.id);
  }

  for (const conflict of json.conflicts) {
    const row = conflict as {
      entityId: string;
      entityType: string;
      localData?: unknown;
      remoteData?: unknown;
    };
    await db.conflicts.put({
      id: `sync-conflict-${row.entityId}`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      localRevision: 1,
      syncStatus: "conflict",
      entityType: row.entityType,
      entityId: row.entityId,
      localData: row.localData ?? null,
      remoteData: row.remoteData ?? null,
      conflictState: "unresolved",
      resolvedAt: null,
    });
    const existingNote = await db.notes.get(row.entityId);
    if (existingNote) {
      await db.notes.update(row.entityId, {
        conflictState: "unresolved",
        conflictBackup:
          existingNote.conflictBackup ??
          (typeof (row.remoteData as { content?: unknown } | null)?.content === "string"
            ? String((row.remoteData as { content?: unknown }).content)
            : null),
        updatedAt: nowIso(),
      });
    }
  }

  const conflictsRemaining = await db.conflicts
    .where("conflictState")
    .equals("unresolved")
    .count();

  await db.syncMetadata.put({
    id: "sync_meta",
    createdAt: metadata?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    localRevision: (metadata?.localRevision ?? 0) + 1,
    syncStatus: (conflictsRemaining > 0 ? "conflict" : "synced") as SyncStatus,
    lastSyncCursor: json.nextSyncCursor,
    lastSuccessfulSync: nowIso(),
    pendingCount: await syncQueue.getPendingCount(),
    deviceId,
  });
  await updateLastSync();
  // Only after a fully server-acknowledged cycle (never on skips/errors).
  await pruneLocalTombstones();
  return json;
}

/**
 * Applies pulled cloud changes locally. Pulled data is marked `synced` and is
 * never re-queued for upload, which prevents sync echo loops.
 */
export async function applyRemoteChanges(changes: QueuedRemoteChange[]): Promise<void> {
  for (const change of changes) {
    const data = change.data ?? {};
    switch (change.entityType) {
      case "lesson_progress": {
        const lessonId = String(data.lessonId ?? change.entityId);
        const existing = await db.lessonProgress
          .where("lessonId")
          .equals(lessonId)
          .first();
        if (!existing) {
          await db.lessonProgress.put({
            id: `remote-${lessonId}`,
            createdAt: change.updatedAt,
            updatedAt: change.updatedAt,
            localRevision: Number(data.localRevision ?? 1),
            syncStatus: "synced",
            lessonId,
            status: (data.status as LessonStatus) ?? "not_started",
            readingComplete: Boolean(data.readingComplete),
            requiredResourcesComplete: Boolean(data.requiredResourcesComplete),
            practiceComplete: Boolean(data.practiceComplete),
            projectComplete: Boolean(data.projectComplete),
            masteryScore: (data.masteryScore as number | null) ?? null,
            needsReview: Boolean(data.needsReview),
            startedAt: (data.startedAt as string | null) ?? null,
            completedAt: (data.completedAt as string | null) ?? null,
            masteredAt: (data.masteredAt as string | null) ?? null,
          });
          break;
        }
        const flags = mergeCompletionFlags(
          {
            readingComplete: existing.readingComplete,
            requiredResourcesComplete: existing.requiredResourcesComplete,
            practiceComplete: existing.practiceComplete,
            projectComplete: existing.projectComplete,
          },
          {
            readingComplete: Boolean(data.readingComplete),
            requiredResourcesComplete: Boolean(data.requiredResourcesComplete),
            practiceComplete: Boolean(data.practiceComplete),
            projectComplete: Boolean(data.projectComplete),
          }
        );
        const remoteMastery =
          typeof data.masteryScore === "number" ? data.masteryScore : null;
        await db.lessonProgress.update(existing.id, {
          ...flags,
          status: monotonicMergeStatus(
            existing.status,
            (data.status as LessonStatus) ?? "not_started"
          ),
          masteryScore:
            remoteMastery === null
              ? existing.masteryScore
              : Math.max(existing.masteryScore ?? 0, remoteMastery),
          needsReview: existing.needsReview || Boolean(data.needsReview),
          updatedAt: change.updatedAt,
          syncStatus: "synced",
        });
        break;
      }

      case "resource_progress": {
        const resourceId = String(data.resourceId ?? change.entityId);
        const existing = await db.resourceProgress
          .where("resourceId")
          .equals(resourceId)
          .first();
        const merged = mergeResourceProgress(
          {
            started: existing?.started ?? false,
            completed: existing?.completed ?? false,
            githubState: existing?.githubState ?? null,
            completedAt: existing?.completedAt ?? null,
            lastOpenedAt: existing?.lastOpenedAt ?? null,
          },
          {
            started: Boolean(data.started),
            completed: Boolean(data.completed),
            githubState: (data.githubState as GithubResourceState | null) ?? null,
            completedAt: (data.completedAt as string | null) ?? null,
            lastOpenedAt: null,
          }
        );
        if (existing) {
          await db.resourceProgress.update(existing.id, {
            ...merged,
            syncStatus: "synced",
            updatedAt: change.updatedAt,
          });
        } else {
          await db.resourceProgress.put({
            id: `remote-${resourceId}`,
            createdAt: change.updatedAt,
            updatedAt: change.updatedAt,
            localRevision: 1,
            syncStatus: "synced",
            resourceId,
            bookmarked: false,
            notes: null,
            ...merged,
          });
        }
        break;
      }

      case "note": {
        const existing = await db.notes.get(change.entityId);
        const remoteContent = String(data.content ?? "");
        if (!existing) {
          await db.notes.put({
            id: change.entityId,
            createdAt: change.updatedAt,
            updatedAt: change.updatedAt,
            localRevision: 1,
            syncStatus: "synced",
            lessonId: (data.lessonId as string | null) ?? null,
            resourceId: (data.resourceId as string | null) ?? null,
            projectId: (data.projectId as string | null) ?? null,
            content: remoteContent,
            contentRevision: Number(data.contentRevision ?? 1),
            conflictState: "none",
            conflictBackup: null,
          });
          break;
        }
        if (existing.content === remoteContent) {
          await db.notes.update(existing.id, {
            contentRevision: Math.max(
              existing.contentRevision,
              Number(data.contentRevision ?? 1)
            ),
            syncStatus: "synced",
            updatedAt: change.updatedAt,
          });
          break;
        }
        if (existing.syncStatus === "pending" || existing.syncStatus === "conflict") {
          await db.notes.update(existing.id, {
            conflictState: "unresolved",
            conflictBackup: remoteContent,
            syncStatus: "conflict",
            updatedAt: nowIso(),
          });
          await db.conflicts.put({
            id: `sync-conflict-${existing.id}`,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            localRevision: existing.localRevision,
            syncStatus: "conflict",
            entityType: "note",
            entityId: existing.id,
            localData: existing,
            remoteData: data,
            conflictState: "unresolved",
            resolvedAt: null,
          });
          break;
        }
        await db.notes.update(existing.id, {
          content: remoteContent,
          contentRevision: Number(data.contentRevision ?? existing.contentRevision),
          conflictState: "none",
          syncStatus: "synced",
          updatedAt: change.updatedAt,
        });
        break;
      }

      case "bookmark": {
        if (change.operation === "delete") {
          const existing = await db.bookmarks.get(change.entityId);
          const deletedAt =
            (data.deletedAt as string | null) ?? change.updatedAt ?? nowIso();
          if (existing) {
            await db.bookmarks.update(existing.id, {
              deletedAt,
              syncStatus: "synced",
              updatedAt: deletedAt,
            });
          }
          await db.tombstones.put({
            id: `remote-tombstone-${change.entityId}`,
            createdAt: deletedAt,
            updatedAt: deletedAt,
            localRevision: 1,
            syncStatus: "synced",
            entityId: change.entityId,
            entityType: "bookmark",
            deletedAt,
            revision: Number(data.revision ?? 1),
          });
          break;
        }
        const existing = await db.bookmarks.get(change.entityId);
        if (!existing) {
          await db.bookmarks.put({
            id: change.entityId,
            createdAt: change.updatedAt,
            updatedAt: change.updatedAt,
            localRevision: 1,
            syncStatus: "synced",
            lessonId: (data.lessonId as string | null) ?? null,
            resourceId: (data.resourceId as string | null) ?? null,
            projectId: (data.projectId as string | null) ?? null,
            targetType: (data.targetType as never) ?? "lesson",
            title: (data.title as string | null) ?? null,
            href: (data.href as string | null) ?? null,
            note: null,
            deletedAt: null,
          });
        }
        break;
      }

      case "study_session": {
        const clientSessionId = String(data.clientSessionId ?? change.entityId);
        const existing = await db.studySessions
          .where("clientSessionId")
          .equals(clientSessionId)
          .first();
        if (existing) break;
        await db.studySessions.put({
          id: `remote-${clientSessionId}`,
          createdAt: change.updatedAt,
          updatedAt: change.updatedAt,
          localRevision: 1,
          syncStatus: "synced",
          clientSessionId,
          deviceId: String(data.deviceId ?? ""),
          lessonId: (data.lessonId as string | null) ?? null,
          resourceId: (data.resourceId as string | null) ?? null,
          projectId: (data.projectId as string | null) ?? null,
          startedAt: String(data.startedAt ?? change.updatedAt),
          endedAt: (data.endedAt as string | null) ?? null,
          durationSeconds: Number(data.durationSeconds ?? 0),
        });
        break;
      }

      case "quiz_attempt": {
        const attemptId = String(data.attemptId ?? change.entityId);
        const existing = await db.quizAttempts.where("attemptId").equals(attemptId).first();
        if (existing) break;
        await db.quizAttempts.put({
          id: `remote-${attemptId}`,
          createdAt: change.updatedAt,
          updatedAt: change.updatedAt,
          localRevision: 1,
          syncStatus: "synced",
          attemptId,
          quizId: String(data.quizId ?? ""),
          lessonId: String(data.lessonId ?? ""),
          answers: data.answers ?? {},
          score: (data.score as number | null) ?? null,
          maxScore: (data.maxScore as number | null) ?? null,
          percentage: (data.percentage as number | null) ?? null,
          startedAt: String(data.startedAt ?? change.updatedAt),
          submittedAt: (data.submittedAt as string | null) ?? null,
          attemptNumber: Number(data.attemptNumber ?? 1),
        });
        break;
      }

      case "tombstone": {
        const entityType = String(data.entityType ?? "");
        if (entityType === "note") {
          await db.notes.delete(change.entityId);
          await db.conflicts.delete(change.entityId);
          await db.conflicts.delete(`sync-conflict-${change.entityId}`);
        } else if (entityType === "bookmark") {
          const existing = await db.bookmarks.get(change.entityId);
          if (existing && !existing.deletedAt) {
            const deletedAt =
              (data.deletedAt as string | null) ?? change.updatedAt ?? nowIso();
            await db.bookmarks.update(existing.id, {
              deletedAt,
              syncStatus: "synced",
              updatedAt: deletedAt,
            });
          }
          await db.tombstones.put({
            id: `remote-tombstone-${change.entityId}`,
            createdAt: change.updatedAt,
            updatedAt: change.updatedAt,
            localRevision: 1,
            syncStatus: "synced",
            entityId: change.entityId,
            entityType: "bookmark",
            deletedAt: (data.deletedAt as string | null) ?? change.updatedAt,
            revision: Number(data.revision ?? 1),
          });
        }
        break;
      }

      case "review_history": {
        const skillId = String(data.skillId ?? "");
        if (!skillId) break;
        const reviewRows = await db.reviewHistory.where("skillId").equals(skillId).toArray();
        const existingReview = reviewRows.filter((row) => !row.id.startsWith("remote-"))[0] ?? reviewRows[0];
        if (existingReview) {
          await db.reviewHistory.update(existingReview.id, {
            successfulReviews: Math.max(existingReview.successfulReviews, Number(data.successfulReviews ?? 0)),
            lastReviewedAt: (data.lastReviewedAt as string | null) ?? existingReview.lastReviewedAt,
            snoozedUntil: (data.snoozedUntil as string | null) ?? null,
            syncStatus: "synced",
            updatedAt: change.updatedAt,
          });
        } else {
          await db.reviewHistory.put({
            id: `remote-${change.entityId}`,
            createdAt: change.updatedAt,
            updatedAt: change.updatedAt,
            localRevision: 1,
            syncStatus: "synced",
            skillId,
            successfulReviews: Number(data.successfulReviews ?? 0),
            lastReviewedAt: (data.lastReviewedAt as string | null) ?? null,
            snoozedUntil: (data.snoozedUntil as string | null) ?? null,
          });
        }
        break;
      }

      case "project_evidence": {
        // Evidence entries are immutable; a differing remote copy is applied only
        // when the local row is not pending (never smothering local edits).
        const evidenceId = change.entityId;
        const existingEvidence = await db.projectEvidence.get(evidenceId);
        if (change.operation === "delete") {
          if (existingEvidence) {
            await db.projectEvidence.update(evidenceId, {
              deletedAt: (data.deletedAt as string | null) ?? change.updatedAt,
              syncStatus: "synced",
              updatedAt: change.updatedAt,
            });
          }
          break;
        }
        if (existingEvidence?.syncStatus === "pending" || existingEvidence?.syncStatus === "conflict") {
          break;
        }
        await db.projectEvidence.put({
          id: evidenceId,
          createdAt: (existingEvidence?.createdAt as string) ?? change.updatedAt,
          updatedAt: change.updatedAt,
          localRevision: Number(data.localRevision ?? existingEvidence?.localRevision ?? 1),
          syncStatus: "synced",
          projectId: String(data.projectId ?? ""),
          kind: (data.kind as never) ?? "github_repo_url",
          value: String(data.value ?? ""),
          title: (data.title as string | null) ?? null,
          details: (data.details as ProjectEvidenceRemoteDetails) ?? null,
          selfReported: true,
          deletedAt: (data.deletedAt as string | null) ?? null,
        });
        break;
      }

      case "project_self_assessment": {
        const projectId = String(data.projectId ?? change.entityId);
        const rows = await db.projectSelfAssessments
          .where("projectId")
          .equals(projectId)
          .toArray();
        const existingAssessment = rows[0];
        const remoteScores = (data.scores as Record<string, unknown> | undefined) ?? {};
        if (existingAssessment) {
          if (existingAssessment.syncStatus === "pending") break;
          // Per-category merge upward mirrors the export/import rule.
          const mergedScores: Record<string, number> = { ...existingAssessment.scores };
          for (const [categoryId, score] of Object.entries(remoteScores)) {
            const numeric = typeof score === "number" ? score : null;
            if (numeric === null) continue;
            const current = mergedScores[categoryId];
            if (typeof current !== "number" || numeric > current) mergedScores[categoryId] = numeric;
          }
          await db.projectSelfAssessments.update(existingAssessment.id, {
            scores: mergedScores,
            totalEarned: (data.totalEarned as number | null) ?? existingAssessment.totalEarned,
            totalMax: (data.totalMax as number | null) ?? existingAssessment.totalMax,
            updatedAt: change.updatedAt,
            syncStatus: "synced",
          });
        } else {
          await db.projectSelfAssessments.put({
            id: change.entityId,
            createdAt: change.updatedAt,
            updatedAt: change.updatedAt,
            localRevision: 1,
            syncStatus: "synced",
            projectId,
            scores: remoteScores as Record<string, number>,
            totalEarned: (data.totalEarned as number | null) ?? null,
            totalMax: (data.totalMax as number | null) ?? null,
          });
        }
        break;
      }

      case "project_progress": {
        const projectId = String(data.projectId ?? "unknown");
        const milestoneId = (data.milestoneId as string | null) ?? null;
        const rows = await db.projectProgress.where("projectId").equals(projectId).toArray();
        const existing = rows.find((row) => row.milestoneId === milestoneId);
        if (existing) {
          await db.projectProgress.update(existing.id, {
            completed: existing.completed || Boolean(data.completed),
            completedAt:
              existing.completedAt ??
              ((data.completedAt as string | null) ?? null) ??
              (data.completed ? nowIso() : null),
            evidenceUrl: (data.evidenceUrl as string | null) ?? existing.evidenceUrl,
            notes: (data.notes as string | null) ?? existing.notes,
            syncStatus: "synced",
            updatedAt: change.updatedAt,
          });
        } else {
          await db.projectProgress.put({
            id: `remote-${projectId}-${milestoneId ?? "root"}`,
            createdAt: change.updatedAt,
            updatedAt: change.updatedAt,
            localRevision: 1,
            syncStatus: "synced",
            projectId,
            milestoneId,
            completed: Boolean(data.completed),
            completedAt: (data.completedAt as string | null) ?? null,
            evidenceUrl: (data.evidenceUrl as string | null) ?? null,
            notes: (data.notes as string | null) ?? null,
          });
        }
        break;
      }

      default:
        break;
    }
  }
}

/**
 * Guest -> account migration. Local IndexedDB data is retained, cloud state is
 * merged in deterministically, differing local records are queued and flushed,
 * and the caller receives a merge summary for display.
 */
export async function mergeOnSignIn(): Promise<MergeSummary | { skipped: string }> {
  const profile = await getLocalProfile();
  if (!profile?.isAuthenticated) {
    return { skipped: "guest" };
  }

  const response = await fetch("/api/sync/v1", { method: "GET" });
  if (response.status === 401) {
    return { skipped: "unauthenticated" };
  }
  if (!response.ok) {
    throw new Error(`Cloud state fetch failed: ${response.status}`);
  }

  const snapshot = (await response.json()) as CloudSnapshotLike;
  const summary = await performGuestAccountMerge(snapshot);

  try {
    await flushSyncQueue();
  } catch {
    // Guest data is preserved locally even if the first upload fails.
  }

  return summary;
}
