import { db, type ReviewHistory } from "../db";
import { bumpRevision, createBase, nowIso } from "../records";
import { syncQueue } from "../sync-queue";

/** §14 — deterministic spaced-review state (centralized config in analytics/types). */
export class ReviewHistoryRepository {
  async getAll(): Promise<ReviewHistory[]> {
    return db.reviewHistory.toArray();
  }

  async getBySkill(skillId: string): Promise<ReviewHistory | null> {
    const rows = await db.reviewHistory.where("skillId").equals(skillId).toArray();
    return rows[0] ?? null;
  }

  /** Record a successful review (advances the spaced interval ladder). */
  async markReviewed(skillId: string, at: string = nowIso()): Promise<ReviewHistory> {
    const existing = await this.getBySkill(skillId);
    const revision = existing ? bumpRevision(existing.localRevision) : {};
    const record: ReviewHistory = {
      ...(existing ?? createBase()),
      ...revision,
      syncStatus: "pending",
      skillId,
      successfulReviews: (existing?.successfulReviews ?? 0) + 1,
      lastReviewedAt: at,
    } as ReviewHistory;
    await db.reviewHistory.put(record);
    await syncQueue.enqueue({
      entityType: "review_history",
      entityId: record.id,
      operation: existing ? "update" : "create",
      payload: {
        skillId: record.skillId,
        successfulReviews: record.successfulReviews,
        lastReviewedAt: record.lastReviewedAt,
        snoozedUntil: record.snoozedUntil,
      },
      baseRevision: record.localRevision,
    });
    return record;
  }

  async snooze(skillId: string, untilIso: string): Promise<ReviewHistory | null> {
    const existing = await this.getBySkill(skillId);
    if (!existing) return null;
    const revision = bumpRevision(existing.localRevision);
    const record: ReviewHistory = {
      ...existing,
      ...revision,
      syncStatus: "pending",
      snoozedUntil: untilIso,
    };
    await db.reviewHistory.put(record);
    await syncQueue.enqueue({
      entityType: "review_history",
      entityId: record.id,
      operation: "update",
      payload: {
        skillId: record.skillId,
        successfulReviews: record.successfulReviews,
        lastReviewedAt: record.lastReviewedAt,
        snoozedUntil: record.snoozedUntil,
      },
      baseRevision: record.localRevision,
    });
    return record;
  }

  /** skillId → record map for analytics. */
  async getMap(): Promise<Map<string, ReviewHistory>> {
    const rows = await this.getAll();
    return new Map(rows.map((row) => [row.skillId, row]));
  }
}

export const reviewHistoryRepo = new ReviewHistoryRepository();
