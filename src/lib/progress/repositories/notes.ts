import { db, type Note } from "../db";
import { bumpRevision, createBase } from "../records";
import { syncQueue } from "../sync-queue";

export interface UpsertNoteInput {
  id?: string;
  lessonId: string | null;
  resourceId: string | null;
  projectId: string | null;
  content: string;
  conflictState?: Note["conflictState"];
  conflictBackup?: string | null;
}

export class NotesRepository {
  async getByLesson(lessonId: string): Promise<Note | null> {
    return (await db.notes.where("lessonId").equals(lessonId).first()) ?? null;
  }

  async getByResource(resourceId: string): Promise<Note | null> {
    return (await db.notes.where("resourceId").equals(resourceId).first()) ?? null;
  }

  async getByProject(projectId: string): Promise<Note | null> {
    return (await db.notes.where("projectId").equals(projectId).first()) ?? null;
  }

  async upsert(input: UpsertNoteInput): Promise<Note> {
    const existing =
      input.id
        ? ((await db.notes.get(input.id)) ?? null)
        : input.lessonId
          ? await this.getByLesson(input.lessonId)
          : input.resourceId
            ? await this.getByResource(input.resourceId)
            : input.projectId
              ? await this.getByProject(input.projectId)
              : null;

    const record: Note = {
      ...(existing ?? {
        ...createBase(),
        lessonId: input.lessonId,
        resourceId: input.resourceId,
        projectId: input.projectId,
        content: "",
        contentRevision: 0,
        conflictState: "none",
        conflictBackup: null,
      }),
      lessonId: input.lessonId,
      resourceId: input.resourceId,
      projectId: input.projectId,
      content: input.content,
      contentRevision: (existing?.contentRevision ?? 0) + 1,
      conflictState: input.conflictState ?? existing?.conflictState ?? "none",
      conflictBackup: input.conflictBackup ?? existing?.conflictBackup ?? null,
      ...(existing ? bumpRevision(existing.localRevision) : {}),
    };

    await db.notes.put(record);
    await syncQueue.enqueue({
      entityType: "note",
      entityId: record.id,
      operation: existing ? "update" : "create",
      payload: record,
      baseRevision: existing?.localRevision ?? 0,
    });
    return record;
  }

  async setConflictState(noteId: string, state: Note["conflictState"], backup?: string) {
    const note = await db.notes.get(noteId);
    if (!note) return;
    await db.notes.update(noteId, {
      conflictState: state,
      conflictBackup: backup ?? note.conflictBackup,
      ...bumpRevision(note.localRevision),
    });
  }

  async getAll(): Promise<Note[]> {
    return db.notes.toArray();
  }

  async delete(noteId: string): Promise<void> {
    const note = await db.notes.get(noteId);
    if (!note) return;
    await db.tombstones.put({
      ...createBase(),
      entityId: noteId,
      entityType: "note",
      deletedAt: new Date().toISOString(),
      revision: note.localRevision + 1,
    });
    await db.notes.delete(noteId);
    await syncQueue.enqueue({
      entityType: "tombstone",
      entityId: noteId,
      operation: "delete",
      payload: { entityType: "note", entityId: noteId, deletedAt: new Date().toISOString(), revision: note.localRevision + 1 },
      baseRevision: note.localRevision,
    });
  }
}

export const notesRepo = new NotesRepository();
