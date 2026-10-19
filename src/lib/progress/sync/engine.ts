import { monotonicMergeStatus, type LessonStatus, earliestTimestamp, mergeCompletionFlags } from "../completion";
import { mergeResourceProgress, type GithubResourceState } from "../resource-rules";
import { detectNoteConflict } from "../conflicts";
import type { SyncMutation, SyncRequest, SyncResponse } from "./protocol";

export interface StoredBatch {
  clientBatchId: string;
  userId: string;
  response: SyncResponse;
}

export interface LessonRecord {
  id: string;
  lessonId: string;
  status: LessonStatus;
  readingComplete: boolean;
  requiredResourcesComplete: boolean;
  practiceComplete: boolean;
  projectComplete: boolean;
  masteryScore: number | null;
  needsReview: boolean;
  startedAt: string | null;
  completedAt: string | null;
  masteredAt: string | null;
  localRevision: number;
  updatedAt: string;
}

export interface NoteRecord {
  id: string;
  content: string;
  contentRevision: number;
  localRevision: number;
  conflictState: string;
  conflictBackup?: string | null;
  lessonId?: string | null;
  resourceId?: string | null;
  projectId?: string | null;
}

export interface BookmarkRecord {
  id: string;
  lessonId: string | null;
  resourceId: string | null;
  projectId: string | null;
  targetType?: string;
  title?: string | null;
  href?: string | null;
  deletedAt: string | null;
  localRevision: number;
}

export interface StudySessionRecord {
  id: string;
  clientSessionId: string;
  deviceId: string;
  durationSeconds: number;
}

export interface QuizAttemptRecord {
  id: string;
  attemptId: string;
  lessonId: string;
  score: number | null;
  percentage: number | null;
}

export interface TombstoneRecord {
  entityId: string;
  entityType: string;
  deletedAt: string;
  revision: number;
}

export interface MemoryUserState {
  lessons: Map<string, LessonRecord>;
  notes: Map<string, NoteRecord>;
  bookmarks: Map<string, BookmarkRecord>;
  studySessions: Map<string, StudySessionRecord>;
  quizAttempts: Map<string, QuizAttemptRecord>;
  resources: Map<string, {
    resourceId: string;
    started: boolean;
    completed: boolean;
    githubState: GithubResourceState | null;
    localRevision: number;
  }>;
  projects: Map<string, Record<string, unknown>>;
  tombstones: Map<string, TombstoneRecord>;
  cursor: string;
}

export class MemorySyncStore {
  batches = new Map<string, StoredBatch>();
  users = new Map<string, MemoryUserState>();

  private key(userId: string, batchId: string) {
    return `${userId}:${batchId}`;
  }

  getUser(userId: string): MemoryUserState {
    let state = this.users.get(userId);
    if (!state) {
      state = {
        lessons: new Map(),
        notes: new Map(),
        bookmarks: new Map(),
        studySessions: new Map(),
        quizAttempts: new Map(),
        resources: new Map(),
        projects: new Map(),
        tombstones: new Map(),
        cursor: "",
      };
      this.users.set(userId, state);
    }
    return state;
  }

  getBatch(userId: string, clientBatchId: string): StoredBatch | undefined {
    return this.batches.get(this.key(userId, clientBatchId));
  }

  saveBatch(batch: StoredBatch) {
    this.batches.set(this.key(batch.userId, batch.clientBatchId), batch);
  }
}

function asRecord(payload: Record<string, unknown>): Record<string, unknown> {
  return payload;
}

/**
 * Mastery is monotonic: a learner's best valid score is never overwritten by a
 * lower one arriving from a stale client.
 */
export function mergeMasteryScore(
  current: number | null | undefined,
  candidate: unknown
): number | null {
  const parsed = typeof candidate === "number" ? candidate : Number(candidate);
  const validCandidate = Number.isFinite(parsed) ? parsed : null;
  if (current === null || current === undefined) return validCandidate;
  if (validCandidate === null) return current;
  return Math.max(current, validCandidate);
}

export function processSyncBatch(
  store: MemorySyncStore,
  userId: string,
  request: SyncRequest
): SyncResponse {
  const existing = store.getBatch(userId, request.clientBatchId);
  if (existing) {
    return existing.response;
  }

  const state = store.getUser(userId);
  const accepted: string[] = [];
  const rejected: Array<{ entityId: string; reason: string; retryable?: boolean }> = [];
  const conflicts: unknown[] = [];
  const remoteChanges: unknown[] = [];

  for (const mutation of request.mutations) {
    try {
      const payloadUserId = mutation.payload.userId;
      if (typeof payloadUserId === "string" && payloadUserId !== userId) {
        rejected.push({ entityId: mutation.entityId, reason: "Unauthorized", retryable: false });
        continue;
      }
      applyMutation(state, mutation, conflicts, accepted, rejected, remoteChanges);
    } catch (err) {
      rejected.push({
        entityId: mutation.entityId,
        reason: err instanceof Error ? err.message : "Processing error",
        retryable: false,
      });
    }
  }

  state.cursor = new Date().toISOString();
  const response: SyncResponse = {
    accepted,
    rejected,
    remoteChanges,
    conflicts,
    nextSyncCursor: state.cursor,
  };

  store.saveBatch({
    clientBatchId: request.clientBatchId,
    userId,
    response,
  });

  return response;
}

function applyMutation(
  state: MemoryUserState,
  mutation: SyncMutation,
  conflicts: unknown[],
  accepted: string[],
  rejected: Array<{ entityId: string; reason: string; retryable?: boolean }>,
  remoteChanges: unknown[]
) {
  const payload = asRecord(mutation.payload);

  switch (mutation.entityType) {
    case "lesson_progress": {
      const lessonId = String(payload.lessonId ?? mutation.entityId);
      const current = state.lessons.get(lessonId);
      const candidateStatus = (payload.status as LessonStatus) ?? "not_started";
      const flags = mergeCompletionFlags(
        {
          readingComplete: Boolean(current?.readingComplete),
          requiredResourcesComplete: Boolean(current?.requiredResourcesComplete),
          practiceComplete: Boolean(current?.practiceComplete),
          projectComplete: Boolean(current?.projectComplete),
        },
        {
          readingComplete: Boolean(payload.readingComplete),
          requiredResourcesComplete: Boolean(payload.requiredResourcesComplete),
          practiceComplete: Boolean(payload.practiceComplete),
          projectComplete: Boolean(payload.projectComplete),
        }
      );
      const mergedStatus = monotonicMergeStatus(current?.status ?? "not_started", candidateStatus);
      const next: LessonRecord = {
        id: current?.id ?? mutation.entityId,
        lessonId,
        status: mergedStatus,
        ...flags,
        masteryScore: mergeMasteryScore(current?.masteryScore ?? null, payload.masteryScore),
        needsReview: Boolean(current?.needsReview || payload.needsReview),
        startedAt: earliestTimestamp(current?.startedAt ?? null, (payload.startedAt as string | null) ?? null),
        completedAt: earliestTimestamp(current?.completedAt ?? null, (payload.completedAt as string | null) ?? null),
        masteredAt: earliestTimestamp(current?.masteredAt ?? null, (payload.masteredAt as string | null) ?? null),
        localRevision: Math.max(current?.localRevision ?? 0, mutation.baseRevision) + 1,
        updatedAt: new Date().toISOString(),
      };
      state.lessons.set(lessonId, next);
      accepted.push(mutation.entityId);
      break;
    }
    case "resource_progress": {
      const resourceId = String(payload.resourceId ?? mutation.entityId);
      const current = state.resources.get(resourceId);
      const merged = mergeResourceProgress(
        {
          started: Boolean(current?.started),
          completed: Boolean(current?.completed),
          githubState: current?.githubState ?? null,
        },
        {
          started: Boolean(payload.started),
          completed: Boolean(payload.completed),
          githubState: (payload.githubState as GithubResourceState | null) ?? null,
        }
      );
      state.resources.set(resourceId, {
        resourceId,
        ...merged,
        localRevision: Math.max(current?.localRevision ?? 0, mutation.baseRevision) + 1,
      });
      accepted.push(mutation.entityId);
      break;
    }
    case "note": {
      const current = state.notes.get(mutation.entityId);
      if (
        current &&
        detectNoteConflict(
          { content: String(payload.content ?? ""), localRevision: mutation.baseRevision + 1 },
          { content: current.content, localRevision: current.contentRevision },
          mutation.baseRevision
        )
      ) {
        const conflict = {
          entityType: "note",
          entityId: mutation.entityId,
          localData: payload,
          remoteData: current,
          conflictState: "unresolved",
        };
        conflicts.push(conflict);
        current.conflictState = "unresolved";
        current.conflictBackup = String(payload.content ?? "");
        accepted.push(mutation.entityId);
        remoteChanges.push({ type: "note_conflict", entityId: mutation.entityId, remote: current });
        break;
      }
      state.notes.set(mutation.entityId, {
        id: mutation.entityId,
        content: String(payload.content ?? current?.content ?? ""),
        contentRevision: (current?.contentRevision ?? 0) + 1,
        localRevision: (current?.localRevision ?? 0) + 1,
        conflictState: "none",
        lessonId: (payload.lessonId as string | null) ?? current?.lessonId ?? null,
        resourceId: (payload.resourceId as string | null) ?? current?.resourceId ?? null,
        projectId: (payload.projectId as string | null) ?? current?.projectId ?? null,
      });
      accepted.push(mutation.entityId);
      break;
    }
    case "bookmark": {
      if (mutation.operation === "delete") {
        const existing = state.bookmarks.get(mutation.entityId);
        const deletedAt = new Date().toISOString();
        state.bookmarks.set(mutation.entityId, {
          id: mutation.entityId,
          lessonId: existing?.lessonId ?? (payload.lessonId as string | null) ?? null,
          resourceId: existing?.resourceId ?? (payload.resourceId as string | null) ?? null,
          projectId: existing?.projectId ?? (payload.projectId as string | null) ?? null,
          deletedAt,
          localRevision: (existing?.localRevision ?? 0) + 1,
        });
        state.tombstones.set(`bookmark:${mutation.entityId}`, {
          entityId: mutation.entityId,
          entityType: "bookmark",
          deletedAt,
          revision: (existing?.localRevision ?? 0) + 1,
        });
        accepted.push(mutation.entityId);
        break;
      }
      const existing = state.bookmarks.get(mutation.entityId);
      if (existing?.deletedAt) {
        accepted.push(mutation.entityId);
        break;
      }
      state.bookmarks.set(mutation.entityId, {
        id: mutation.entityId,
        lessonId: (payload.lessonId as string | null) ?? existing?.lessonId ?? null,
        resourceId: (payload.resourceId as string | null) ?? existing?.resourceId ?? null,
        projectId: (payload.projectId as string | null) ?? existing?.projectId ?? null,
        targetType: (payload.targetType as string) ?? existing?.targetType,
        title: (payload.title as string | null) ?? existing?.title ?? null,
        href: (payload.href as string | null) ?? existing?.href ?? null,
        deletedAt: null,
        localRevision: (existing?.localRevision ?? 0) + 1,
      });
      accepted.push(mutation.entityId);
      break;
    }
    case "study_session": {
      const clientSessionId = String(payload.clientSessionId ?? mutation.entityId);
      if (!state.studySessions.has(clientSessionId)) {
        state.studySessions.set(clientSessionId, {
          id: mutation.entityId,
          clientSessionId,
          deviceId: String(payload.deviceId ?? ""),
          durationSeconds: Number(payload.durationSeconds ?? 0),
        });
      }
      accepted.push(mutation.entityId);
      break;
    }
    case "quiz_attempt": {
      const attemptId = String(payload.attemptId ?? mutation.entityId);
      if (!state.quizAttempts.has(attemptId)) {
        state.quizAttempts.set(attemptId, {
          id: mutation.entityId,
          attemptId,
          lessonId: String(payload.lessonId ?? ""),
          score: (payload.score as number | null) ?? null,
          percentage: (payload.percentage as number | null) ?? null,
        });
      }
      accepted.push(mutation.entityId);
      break;
    }
    case "tombstone": {
      state.tombstones.set(`${payload.entityType}:${mutation.entityId}`, {
        entityId: mutation.entityId,
        entityType: String(payload.entityType ?? "bookmark"),
        deletedAt: String(payload.deletedAt ?? new Date().toISOString()),
        revision: Number(payload.revision ?? mutation.baseRevision),
      });
      accepted.push(mutation.entityId);
      break;
    }
    case "project_progress":
    case "roadmap_state":
    default:
      state.projects.set(mutation.entityId, payload);
      accepted.push(mutation.entityId);
      break;
  }
}

export function dedupeStudySessions(
  sessions: Array<{ clientSessionId: string; durationSeconds: number }>
): { unique: typeof sessions; totalSeconds: number } {
  const seen = new Set<string>();
  const unique: typeof sessions = [];
  for (const session of sessions) {
    if (seen.has(session.clientSessionId)) continue;
    seen.add(session.clientSessionId);
    unique.push(session);
  }
  return {
    unique,
    totalSeconds: unique.reduce((sum, s) => sum + s.durationSeconds, 0),
  };
}

export function mergeGuestAndCloud<T extends { id: string; localRevision?: number }>(
  local: T[],
  cloud: T[],
  mergeOne: (localRow: T | undefined, cloudRow: T | undefined) => T
): { merged: T[]; localUploaded: number; cloudPreserved: number } {
  const ids = new Set([...local.map((r) => r.id), ...cloud.map((r) => r.id)]);
  const localById = new Map(local.map((r) => [r.id, r]));
  const cloudById = new Map(cloud.map((r) => [r.id, r]));
  const merged: T[] = [];
  let localUploaded = 0;
  let cloudPreserved = 0;
  for (const id of ids) {
    const l = localById.get(id);
    const c = cloudById.get(id);
    if (l && !c) localUploaded += 1;
    if (c && !l) cloudPreserved += 1;
    if (l && c) cloudPreserved += 1;
    merged.push(mergeOne(l, c));
  }
  return { merged, localUploaded, cloudPreserved };
}
