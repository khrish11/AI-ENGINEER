import { db, type EvidenceKind, type ProjectEvidence } from "../db";
import { bumpRevision, createBase, nowIso } from "../records";
import { syncQueue } from "../sync-queue";
import { isAllowedEvidenceUrl } from "@/lib/projects/evidence";

export interface EvidenceDetails {
  branch?: string | null;
  commitSha?: string | null;
  prUrl?: string | null;
  directory?: string | null;
}

export interface AttachEvidenceInput {
  projectId: string;
  kind: EvidenceKind;
  value: string;
  title?: string | null;
  details?: EvidenceDetails | null;
}

export class ProjectEvidenceRepository {
  async getByProject(projectId: string): Promise<ProjectEvidence[]> {
    const rows = await db.projectEvidence
      .where("projectId")
      .equals(projectId)
      .toArray();
    return rows.filter((row) => !row.deletedAt);
  }

  async attach(input: AttachEvidenceInput): Promise<ProjectEvidence> {
    if (!isAllowedEvidenceUrl(input.value)) {
      throw new Error(
        "Evidence links must be https URLs (or only for screenshots/reflections, a plain note)."
      );
    }
    const now = nowIso();
    const record: ProjectEvidence = {
      ...createBase(),
      projectId: input.projectId,
      kind: input.kind,
      value: input.value,
      title: input.title ?? null,
      details: input.details ?? null,
      selfReported: true,
      deletedAt: null,
    };
    await db.projectEvidence.put(record);
    await syncQueue.enqueue({
      entityType: "project_evidence",
      entityId: record.id,
      operation: "create",
      payload: record,
      baseRevision: record.localRevision,
    });
    return record;
  }

  /** Soft delete + tombstone-style sync mutation, mirroring bookmarks. */
  async remove(recordId: string): Promise<void> {
    const record = await db.projectEvidence.get(recordId);
    if (!record) return;
    const revision = bumpRevision(record.localRevision);
    const updated: ProjectEvidence = {
      ...record,
      ...revision,
      deletedAt: revision.updatedAt,
    };
    await db.projectEvidence.put(updated);
    await syncQueue.enqueue({
      entityType: "project_evidence",
      entityId: updated.id,
      operation: "update",
      payload: updated,
      baseRevision: updated.localRevision,
    });
  }

  async getAll(): Promise<ProjectEvidence[]> {
    return db.projectEvidence.toArray();
  }
}

export const projectEvidenceRepo = new ProjectEvidenceRepository();
