import { db, type StudySession } from "../db";
import { createBase } from "../records";
import { syncQueue } from "../sync-queue";
import { dedupeStudySessions } from "../sync/engine";

export interface CreateStudySessionInput {
  clientSessionId: string;
  deviceId: string;
  lessonId: string | null;
  resourceId: string | null;
  projectId: string | null;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
}

export class StudySessionsRepository {
  async getByClientSession(clientSessionId: string): Promise<StudySession | null> {
    return (await db.studySessions.where("clientSessionId").equals(clientSessionId).first()) ?? null;
  }

  async create(input: CreateStudySessionInput): Promise<StudySession> {
    const existing = await this.getByClientSession(input.clientSessionId);
    if (existing) return existing;

    const record: StudySession = {
      ...createBase(),
      clientSessionId: input.clientSessionId,
      deviceId: input.deviceId,
      lessonId: input.lessonId,
      resourceId: input.resourceId,
      projectId: input.projectId,
      startedAt: input.startedAt,
      endedAt: input.endedAt ?? null,
      durationSeconds: input.durationSeconds,
    };
    await db.studySessions.add(record);
    await syncQueue.enqueue({
      entityType: "study_session",
      entityId: record.id,
      operation: "create",
      payload: record,
      baseRevision: 0,
    });
    return record;
  }

  async getAll(): Promise<StudySession[]> {
    return db.studySessions.toArray();
  }

  async getTotalDuration(): Promise<number> {
    const sessions = await this.getAll();
    return dedupeStudySessions(
      sessions.map((s) => ({
        clientSessionId: s.clientSessionId,
        durationSeconds: s.durationSeconds || 0,
      }))
    ).totalSeconds;
  }
}

export const studySessionsRepo = new StudySessionsRepository();
