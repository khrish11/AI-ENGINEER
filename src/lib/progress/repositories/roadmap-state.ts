import { db, type RoadmapState } from "../db";
import { bumpRevision, createBase } from "../records";
import { syncQueue } from "../sync-queue";

export class RoadmapStateRepository {
  async get(): Promise<RoadmapState | null> {
    const rows = await db.roadmapState.toArray();
    return rows[0] ?? null;
  }

  async set(state: unknown): Promise<RoadmapState> {
    const existing = await this.get();
    const record: RoadmapState = existing
      ? { ...existing, state, ...bumpRevision(existing.localRevision) }
      : { ...createBase(), state };

    await db.roadmapState.put(record);
    await syncQueue.enqueue({
      entityType: "roadmap_state",
      entityId: record.id,
      operation: existing ? "update" : "create",
      payload: record,
      baseRevision: existing?.localRevision ?? 0,
    });
    return record;
  }
}

export const roadmapStateRepo = new RoadmapStateRepository();
