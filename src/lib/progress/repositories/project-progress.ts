import { db, type ProjectProgress } from "../db";
import { bumpRevision, createBase, nowIso } from "../records";
import { syncQueue } from "../sync-queue";

export interface UpsertProjectProgressInput {
  projectId: string;
  milestoneId: string | null;
  completed?: boolean;
  evidenceUrl?: string | null;
  notes?: string | null;
}

export class ProjectProgressRepository {
  async getByProject(projectId: string): Promise<ProjectProgress[]> {
    return db.projectProgress.where("projectId").equals(projectId).toArray();
  }

  async getMilestone(projectId: string, milestoneId: string): Promise<ProjectProgress | null> {
    const rows = await this.getByProject(projectId);
    return rows.find((row) => row.milestoneId === milestoneId) ?? null;
  }

  async upsert(input: UpsertProjectProgressInput): Promise<ProjectProgress> {
    const existing = input.milestoneId
      ? await this.getMilestone(input.projectId, input.milestoneId)
      : (await this.getByProject(input.projectId))[0] ?? null;
    const now = nowIso();
    const completed = Boolean(input.completed ?? existing?.completed);
    const record: ProjectProgress = {
      ...(existing ?? {
        ...createBase(),
        projectId: input.projectId,
        milestoneId: input.milestoneId,
        completed: false,
        completedAt: null,
        evidenceUrl: null,
        notes: null,
      }),
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      completed,
      completedAt: completed ? existing?.completedAt ?? now : null,
      evidenceUrl: input.evidenceUrl === undefined ? existing?.evidenceUrl ?? null : input.evidenceUrl,
      notes: input.notes === undefined ? existing?.notes ?? null : input.notes,
      ...(existing ? bumpRevision(existing.localRevision) : {}),
    };
    await db.projectProgress.put(record);
    await syncQueue.enqueue({
      entityType: "project_progress",
      entityId: record.id,
      operation: existing ? "update" : "create",
      payload: record,
      baseRevision: existing?.localRevision ?? 0,
    });
    return record;
  }

  async markMilestoneComplete(
    projectId: string,
    milestoneId: string,
    evidenceUrl?: string | null
  ) {
    return this.upsert({
      projectId,
      milestoneId,
      completed: true,
      evidenceUrl,
    });
  }

  async getAll(): Promise<ProjectProgress[]> {
    return db.projectProgress.toArray();
  }
}

export const projectProgressRepo = new ProjectProgressRepository();
