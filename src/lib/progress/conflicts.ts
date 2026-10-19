import { db, type ConflictRecord, type SyncStatus } from "./db";
import { monotonicMergeStatus, statusRank, type LessonStatus } from "./completion";
import { syncQueue } from "./sync-queue";
import { nowIso } from "./records";

export type ConflictResolution = "keep_local" | "keep_remote" | "manual_merge";

export interface ConflictItem {
  id: string;
  entityType: string;
  entityId: string;
  localData: unknown;
  remoteData: unknown;
  conflictState: ConflictRecord["conflictState"];
  createdAt: string;
}

export function detectNoteConflict(
  local: { content: string; localRevision: number },
  remote: { content: string; localRevision: number },
  baseRevision: number
): boolean {
  return (
    local.localRevision > baseRevision &&
    remote.localRevision > baseRevision &&
    local.content !== remote.content
  );
}

export function detectLessonProgressConflict(
  currentStatus: string,
  candidateStatus: string
): { conflict: boolean; mergedStatus: string } {
  const currentRank = statusRank(currentStatus as LessonStatus);
  const candidateRank = statusRank(candidateStatus as LessonStatus);
  const merged = monotonicMergeStatus(
    currentStatus as LessonStatus,
    candidateStatus as LessonStatus
  );
  return {
    conflict: candidateRank < currentRank,
    mergedStatus: merged,
  };
}

type ConflictData = Record<string, unknown> & { id?: string };

export class ConflictResolver {
  async getUnresolved(): Promise<ConflictItem[]> {
    const rows = await db.conflicts.where("conflictState").equals("unresolved").toArray();
    return rows.map((row) => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      localData: row.localData,
      remoteData: row.remoteData,
      conflictState: row.conflictState,
      createdAt: row.createdAt,
    }));
  }

  async resolve(
    conflictId: string,
    resolution: ConflictResolution,
    mergedData?: unknown
  ): Promise<void> {
    const conflict = await db.conflicts.get(conflictId);
    if (!conflict) return;

    if (resolution === "keep_local") {
      await this.apply(conflict, conflict.localData);
    } else if (resolution === "keep_remote") {
      await this.apply(conflict, conflict.remoteData);
    } else if (resolution === "manual_merge") {
      await this.apply(conflict, mergedData ?? conflict.localData);
    }

    const now = nowIso();
    await db.conflicts.update(conflictId, {
      conflictState: "none",
      resolvedAt: now,
      updatedAt: now,
      localRevision: conflict.localRevision + 1,
      syncStatus: "synced",
    });
  }

  private async apply(conflict: ConflictRecord, rawData: unknown): Promise<void> {
    if (!rawData || typeof rawData !== "object") return;
    const data = rawData as ConflictData;
    const now = nowIso();
    const syncStatus: SyncStatus = "pending";
    const id = data.id ?? conflict.entityId;

    if (conflict.entityType === "note") {
      const existing = await db.notes.get(id);
      if (!existing) return;
      const content = typeof data.content === "string" ? data.content : existing.content;
      await db.notes.put({
        ...existing,
        content,
        contentRevision: existing.contentRevision + 1,
        conflictState: "none",
        conflictBackup: null,
        updatedAt: now,
        localRevision: existing.localRevision + 1,
        syncStatus,
      });
      await syncQueue.enqueue({
        entityType: "note",
        entityId: id,
        operation: "update",
        payload: { ...existing, content, conflictState: "none" },
        baseRevision: existing.localRevision,
      });
      return;
    }

    if (conflict.entityType === "lesson_progress") {
      const lessonId = String(data.lessonId ?? conflict.entityId);
      const existing = await db.lessonProgress
        .where("lessonId")
        .equals(lessonId)
        .first();
      const merged = {
        ...(existing ?? {}),
        ...data,
        id: existing?.id ?? id,
        lessonId,
        status: monotonicMergeStatus(
          existing?.status ?? "not_started",
          (data.status as LessonStatus) ?? "not_started"
        ),
        updatedAt: now,
        localRevision: (existing?.localRevision ?? 0) + 1,
        syncStatus,
      };
      await db.lessonProgress.put(merged as never);
      await syncQueue.enqueue({
        entityType: "lesson_progress",
        entityId: merged.id,
        operation: "update",
        payload: merged,
        baseRevision: existing?.localRevision ?? 0,
      });
      return;
    }

    if (conflict.entityType === "resource_progress") {
      const resourceId = String(data.resourceId ?? conflict.entityId);
      const existing = await db.resourceProgress
        .where("resourceId")
        .equals(resourceId)
        .first();
      const merged = {
        ...(existing ?? {}),
        ...data,
        id: existing?.id ?? id,
        resourceId,
        updatedAt: now,
        localRevision: (existing?.localRevision ?? 0) + 1,
        syncStatus,
      };
      await db.resourceProgress.put(merged as never);
      await syncQueue.enqueue({
        entityType: "resource_progress",
        entityId: merged.id,
        operation: "update",
        payload: merged,
        baseRevision: existing?.localRevision ?? 0,
      });
    }
  }

  detectNoteConflict = detectNoteConflict;
  detectLessonProgressConflict = detectLessonProgressConflict;
}

export const conflictResolver = new ConflictResolver();
