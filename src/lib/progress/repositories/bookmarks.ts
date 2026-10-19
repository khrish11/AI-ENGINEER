import { db, type Bookmark } from "../db";
import { bumpRevision, createBase, nowIso } from "../records";
import { syncQueue } from "../sync-queue";
import { bookmarkVisible } from "../tombstones";

export interface UpsertBookmarkInput {
  lessonId: string | null;
  resourceId: string | null;
  projectId: string | null;
  targetType?: Bookmark["targetType"];
  title?: string | null;
  href?: string | null;
  note?: string | null;
}

export class BookmarksRepository {
  private async findExisting(input: UpsertBookmarkInput): Promise<Bookmark | undefined> {
    const all = await db.bookmarks.toArray();
    return all.find((b) => {
      if (b.deletedAt) return false;
      if (input.lessonId) return b.lessonId === input.lessonId;
      if (input.resourceId) return b.resourceId === input.resourceId;
      if (input.projectId) return b.projectId === input.projectId;
      return false;
    });
  }

  async getByLesson(lessonId: string): Promise<Bookmark | null> {
    const result = await db.bookmarks.where("lessonId").equals(lessonId).first();
    if (!result || !bookmarkVisible(result)) return null;
    return result;
  }

  async getByResource(resourceId: string): Promise<Bookmark | null> {
    const result = await db.bookmarks.where("resourceId").equals(resourceId).first();
    if (!result || !bookmarkVisible(result)) return null;
    return result;
  }

  async getByProject(projectId: string): Promise<Bookmark | null> {
    const result = await db.bookmarks.where("projectId").equals(projectId).first();
    if (!result || !bookmarkVisible(result)) return null;
    return result;
  }

  async upsert(input: UpsertBookmarkInput): Promise<Bookmark> {
    const existing = await this.findExisting(input);
    const targetType =
      input.targetType ??
      (input.lessonId ? "lesson" : input.projectId ? "projects" : "docs");
    const record: Bookmark = {
      ...(existing ?? {
        ...createBase(),
        deletedAt: null,
      }),
      lessonId: input.lessonId,
      resourceId: input.resourceId,
      projectId: input.projectId,
      targetType,
      title: input.title ?? existing?.title ?? null,
      href: input.href ?? existing?.href ?? null,
      note: input.note ?? existing?.note ?? null,
      deletedAt: null,
      ...(existing ? bumpRevision(existing.localRevision) : {}),
    };
    await db.bookmarks.put(record);
    await syncQueue.enqueue({
      entityType: "bookmark",
      entityId: record.id,
      operation: existing ? "update" : "create",
      payload: record,
      baseRevision: existing?.localRevision ?? 0,
    });
    return record;
  }

  async toggleBookmark(input: UpsertBookmarkInput): Promise<Bookmark | null> {
    const existing = await this.findExisting(input);
    if (existing && bookmarkVisible(existing)) {
      await this.remove(existing.id);
      return null;
    }
    return this.upsert(input);
  }

  async remove(bookmarkId: string): Promise<void> {
    const existing = await db.bookmarks.get(bookmarkId);
    if (!existing) return;
    const deletedAt = nowIso();
    await db.bookmarks.update(bookmarkId, {
      deletedAt,
      ...bumpRevision(existing.localRevision),
    });
    await db.tombstones.put({
      ...createBase(),
      entityId: bookmarkId,
      entityType: "bookmark",
      deletedAt,
      revision: existing.localRevision + 1,
    });
    await syncQueue.enqueue({
      entityType: "bookmark",
      entityId: bookmarkId,
      operation: "delete",
      payload: { ...existing, deletedAt },
      baseRevision: existing.localRevision,
    });
  }

  async getAll(): Promise<Bookmark[]> {
    const all = await db.bookmarks.toArray();
    return all.filter(bookmarkVisible);
  }

  async getAllIncludingDeleted(): Promise<Bookmark[]> {
    return db.bookmarks.toArray();
  }
}

export const bookmarksRepo = new BookmarksRepository();
