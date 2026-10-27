import { db, type SyncQueueItem } from "./db";
import { createBase, newId, nowIso } from "./records";

export type SyncOperation = "create" | "update" | "delete";

export interface QueueMutationInput {
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  payload: unknown;
  baseRevision: number;
}

const MAX_RETRY = 6;

export class SyncQueue {
  async enqueue(input: QueueMutationInput): Promise<SyncQueueItem> {
    const existing = await db.syncQueue
      .where("[entityType+entityId]")
      .equals([input.entityType, input.entityId])
      .first();

    const now = nowIso();

    if (existing && existing.operation !== "delete") {
      // Re-mutating a queued row turns over its mutationId: the row identity
      // now represents a *different* pending mutation than any batch that may
      // already be in flight. flushSyncQueue only acknowledges rows whose
      // mutationId still matches what it sent, so a newer mutation (e.g. a
      // delete coalesced into a create that is mid-upload) is never dropped by
      // that in-flight create's acknowledgement.
      await db.syncQueue.update(existing.id, {
        mutationId: newId(),
        operation: input.operation,
        payload: input.payload,
        baseRevision: input.baseRevision,
        retryCount: 0,
        updatedAt: now,
        syncStatus: "pending",
      });
      return (await db.syncQueue.get(existing.id)) as SyncQueueItem;
    }

    const item: SyncQueueItem = {
      ...createBase(),
      mutationId: newId(),
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      payload: input.payload,
      baseRevision: input.baseRevision,
      retryCount: 0,
    };

    await db.syncQueue.add(item);
    return item;
  }

  async getPending(): Promise<SyncQueueItem[]> {
    return db.syncQueue.filter((item) => item.syncStatus !== "failed").toArray();
  }

  async incrementRetry(id: string): Promise<void> {
    const item = await db.syncQueue.get(id);
    if (!item) return;
    const retryCount = item.retryCount + 1;
    await db.syncQueue.update(id, {
      retryCount,
      updatedAt: nowIso(),
      syncStatus: retryCount >= MAX_RETRY ? "failed" : "pending",
    });
  }

  async markFailed(id: string): Promise<void> {
    await db.syncQueue.update(id, {
      syncStatus: "failed",
      updatedAt: nowIso(),
    });
  }

  async acknowledge(id: string): Promise<void> {
    await db.syncQueue.delete(id);
  }

  async acknowledgeMany(ids: string[]): Promise<void> {
    await db.syncQueue.bulkDelete(ids);
  }

  /**
   * Acknowledge only the mutations a batch actually committed. A row is
   * deleted only when its stored mutationId still equals the one that was
   * sent; if a newer mutation was coalesced into the same row while the
   * request was in flight, its mutationId turned over and the row is left
   * pending for the next flush. This is what keeps a mid-flight create's
   * acknowledgement from silently discarding a subsequent delete.
   */
  async acknowledgeCommitted(
    sent: Array<{ id: string; mutationId: string }>
  ): Promise<void> {
    if (sent.length === 0) return;
    const current = await db.syncQueue.bulkGet(sent.map((s) => s.id));
    const deletable = sent
      .filter((s, i) => current[i]?.mutationId === s.mutationId)
      .map((s) => s.id);
    if (deletable.length > 0) await db.syncQueue.bulkDelete(deletable);
  }

  async clear(): Promise<void> {
    await db.syncQueue.clear();
  }

  async getPendingCount(): Promise<number> {
    return db.syncQueue.filter((item) => item.syncStatus === "pending").count();
  }

  retryDelayMs(retryCount: number): number {
    return Math.min(30_000, 500 * 2 ** retryCount);
  }
}

export const syncQueue = new SyncQueue();
