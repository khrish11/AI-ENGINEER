import { db, type ProjectSelfAssessment } from "../db";
import { bumpRevision, createBase, nowIso } from "../records";
import { syncQueue } from "../sync-queue";
import { rubricTotal } from "@/lib/projects/completion";
import type { Rubric } from "@/lib/projects/schema";

export interface SaveSelfAssessmentInput {
  projectId: string;
  scores: Record<string, number>;
  rubric: Rubric;
}

export class ProjectSelfAssessmentRepository {
  async getByProject(projectId: string): Promise<ProjectSelfAssessment | null> {
    const rows = await db.projectSelfAssessments
      .where("projectId")
      .equals(projectId)
      .toArray();
    return rows[0] ?? null;
  }

  /** §13 — scores are clamped into 0..weight per category before persisting. */
  async save(input: SaveSelfAssessmentInput): Promise<ProjectSelfAssessment> {
    const clamped: Record<string, number> = {};
    for (const category of input.rubric.categories) {
      const raw = input.scores[category.id];
      const numeric = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
      clamped[category.id] = Math.max(0, Math.min(category.weight, Math.round(numeric)));
    }
    const total = rubricTotal(input.rubric, clamped);
    const existing = await this.getByProject(input.projectId);
    const now = nowIso();
    const record: ProjectSelfAssessment = {
      ...(existing ?? createBase()),
      projectId: input.projectId,
      scores: clamped,
      totalEarned: total ? total.total : null,
      totalMax: total ? total.max : null,
      updatedAt: now,
      ...(existing ? bumpRevision(existing.localRevision) : {}),
      syncStatus: "pending",
    } as ProjectSelfAssessment;
    await db.projectSelfAssessments.put(record);
    await syncQueue.enqueue({
      entityType: "project_self_assessment",
      entityId: record.id,
      operation: existing ? "update" : "create",
      payload: {
        id: record.id,
        projectId: record.projectId,
        scores: record.scores,
        totalEarned: record.totalEarned,
        totalMax: record.totalMax,
        updatedAt: record.updatedAt,
      },
      baseRevision: record.localRevision,
    });
    return record;
  }

  async getAll(): Promise<ProjectSelfAssessment[]> {
    return db.projectSelfAssessments.toArray();
  }
}

export const projectSelfAssessmentRepo = new ProjectSelfAssessmentRepository();
