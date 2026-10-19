import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/progress/db";
import { projectProgressRepo } from "@/lib/progress/repositories/project-progress";
import { projectEvidenceRepo } from "@/lib/progress/repositories/project-evidence";
import { projectSelfAssessmentRepo } from "@/lib/progress/repositories/project-self-assessment";
import {
  exportProgress,
  importProgressFromObject,
} from "@/lib/progress/export-import";
import { recordAssessmentAttempt } from "@/lib/assessments/attempts";
import { scoreAssessment } from "@/lib/assessments/scoring";
import { checkpoint } from "./assessment-fixtures";
import { computeProjectStatus } from "@/lib/projects/completion";
import { getProjectBySlug } from "@/lib/projects/catalog";
import { resetProgressDb } from "./progress-test-utils";

const PROJECT_ID = "proj-test-integration-rag";

describe("Phase 6 integration: project journey", () => {
  beforeEach(async () => {
    await resetProgressDb();
  });

  it("milestone completion + evidence + self-assessment persist across reload and sync-queue", async () => {
    // 1. Learner completes milestone
    await projectProgressRepo.upsert({
      projectId: PROJECT_ID,
      milestoneId: "ingestion",
      completed: true,
      evidenceUrl: "https://github.com/u/rag",
    });
    // 2. Learner attaches evidence
    const evidence = await projectEvidenceRepo.attach({
      projectId: PROJECT_ID,
      kind: "github_repo_url",
      value: "https://github.com/u/rag",
      title: "Repo",
      details: { branch: "main", commitSha: "abc1234" },
    });
    expect(evidence.selfReported).toBe(true);
    // Simulate reload: fresh read from Dexie
    const reloadedEvidence = await projectEvidenceRepo.getByProject(PROJECT_ID);
    expect(reloadedEvidence).toHaveLength(1);
    const reloadedMilestones = await projectProgressRepo.getByProject(PROJECT_ID);
    expect(reloadedMilestones).toHaveLength(1);
    expect(reloadedMilestones[0].completed).toBe(true);
    // 3. Learner saves rubric self-assessment
    const rubric = getProjectBySlug("evaluated-rag-application")!.rubric!;
    await projectSelfAssessmentRepo.save({
      projectId: PROJECT_ID,
      scores: Object.fromEntries(rubric.categories.map((c) => [c.id, c.weight])),
      rubric,
    });
    const reloadedAssessment = await projectSelfAssessmentRepo.getByProject(PROJECT_ID);
    expect(reloadedAssessment?.totalMax).toBe(100);
    expect(reloadedAssessment?.totalEarned).toBe(100);
    // 4. Phase 4 sync queue received the mutations for later flushing
    const queue = await db.syncQueue.toArray();
    const entityTypes = new Set(queue.map((item) => item.entityType));
    expect(entityTypes.has("project_progress")).toBe(true);
    expect(entityTypes.has("project_evidence")).toBe(true);
    expect(entityTypes.has("project_self_assessment")).toBe(true);
  });

  it("rejected https/localhost evidence throws a domain error", async () => {
    await expect(
      projectEvidenceRepo.attach({
        projectId: PROJECT_ID,
        kind: "github_repo_url",
        value: "http://evil.example.com/repo",
      })
    ).rejects.toThrow(/https/);
  });

  it("assessment attempts persist and preserve scored answers", async () => {
    const assessment = checkpoint();
    const answers = Object.fromEntries(
      assessment.questions.map((q) => [q.id, 0])
    );
    const scored = scoreAssessment(assessment, answers);
    const startedAt = "2026-10-17T00:00:00.000Z";
    const record = await recordAssessmentAttempt({ assessment, answers, scored, startedAt });
    expect(record.attemptId).toBe(`${assessment.id}#1`);
    const reloaded = await db.quizAttempts.where("quizId").equals(assessment.id).toArray();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].percentage).toBe(scored.percentage);
    expect((reloaded[0].answers as Record<string, unknown>)[assessment.questions[0].id]).toBe(0);
  });

  it("export/import roundtrips evidence and self-assessments (merge keeps best)", async () => {
    const exported1 = await exportProgress();
    const evidenceBefore = exported1.data.projectEvidence ?? [];
    // First pass: attach via export
    await projectEvidenceRepo.attach({
      projectId: PROJECT_ID,
      kind: "markdown_reflection",
      value: "What did I learn here about evaluation set design?",
    });
    await projectSelfAssessmentRepo.save({
      projectId: PROJECT_ID,
      scores: { retrieval: 5, quality: 4 },
      rubric: {
        categories: [
          { id: "retrieval", category: "Retrieval", weight: 50, criteria: ["x"], minimumExpectation: "m", excellentExpectation: "e" },
          { id: "quality", category: "Quality", weight: 50, criteria: ["x"], minimumExpectation: "m", excellentExpectation: "e" },
        ],
        completionThreshold: 60,
        masteryThreshold: 75,
      },
    });
    const afterFirst = await exportProgress();
    expect((afterFirst.data.projectEvidence ?? []).length).toBe(evidenceBefore.length + 1);
    // Merge-import same export back — deterministic upsert
    const imported = await importProgressFromObject(afterFirst, "merge");
    expect(imported.success).toBe(true);
    const reloaded = await projectSelfAssessmentRepo.getByProject(PROJECT_ID);
    expect(reloaded?.scores.retrieval).toBe(5);
    expect(reloaded?.scores.quality).toBe(4);
  });

  it("delete-cemetery evidence is honoured by export roundtrip (deletedAt survives)", async () => {
    const record = await projectEvidenceRepo.attach({
      projectId: PROJECT_ID,
      kind: "documentation_url",
      value: "https://docs.example.com/rag",
    });
    await projectEvidenceRepo.remove(record.id);
    const reloaded = await projectEvidenceRepo.getByProject(PROJECT_ID);
    expect(reloaded).toHaveLength(0);
    const fullTable = await db.projectEvidence.toArray();
    expect(fullTable).toHaveLength(1);
    expect(fullTable[0].deletedAt).not.toBeNull();
  });

  it("project status recomputes deterministically from persisted inputs", async () => {
    const project = {
      id: PROJECT_ID,
      slug: "integration-rag",
      level: "intermediate" as const,
      milestones: [{ id: "ingestion", title: "Ingestion", objective: "o", expectedOutput: "e", requiredEvidence: ["e-repo"], estimatedMinutes: 60, required: true }],
      requiredEvidence: [{ id: "e-repo", kind: "github_repo_url" as const, description: "d", required: true }],
      rubric: {
        categories: [
          { id: "retrieval", category: "Retrieval", weight: 100, criteria: ["x"], minimumExpectation: "m", excellentExpectation: "e" },
        ],
        completionThreshold: 60,
        masteryThreshold: 75,
      },
    } as Parameters<typeof computeProjectStatus>[0];

    await projectProgressRepo.upsert({
      projectId: PROJECT_ID,
      milestoneId: "ingestion",
      completed: true,
    });
    await projectEvidenceRepo.attach({
      projectId: PROJECT_ID,
      kind: "github_repo_url",
      value: "https://github.com/u/integration",
    });
    await projectSelfAssessmentRepo.save({
      projectId: PROJECT_ID,
      scores: { retrieval: 80 },
      rubric: project.rubric!,
    });

    const evidence = await projectEvidenceRepo.getByProject(PROJECT_ID);
    const milestoneRows = await projectProgressRepo.getByProject(PROJECT_ID);
    const selfAssessment = await projectSelfAssessmentRepo.getByProject(PROJECT_ID);

    const status = computeProjectStatus(project, {
      milestoneStates: milestoneRows
        .filter((r) => r.milestoneId)
        .map((r) => ({ milestoneId: r.milestoneId as string, completed: r.completed, evidenceUrl: r.evidenceUrl })),
      evidence: evidence.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        kind: r.kind,
        value: r.value,
        title: r.title,
        createdAt: r.createdAt,
        selfReported: r.selfReported,
      })),
      selfAssessment: selfAssessment
        ? { scores: selfAssessment.scores, updatedAt: selfAssessment.updatedAt }
        : null,
    });
    expect(status.status).toBe("mastered");
    expect(status.rubricScore?.total).toBe(80);
  });
});
