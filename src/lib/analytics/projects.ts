import { projectCatalog } from "@/lib/projects/catalog";
import {
  computeProjectStatus,
  type EvidenceEntry,
  type MilestoneState,
  type RubricSelfAssessment,
  type ProjectStatus,
} from "@/lib/projects/completion";
import type { ProjectEvidence, ProjectSelfAssessment, ProjectProgress } from "@/lib/progress/db";

export type WarehouseEvidenceEntry = EvidenceEntry;

/**
 * §18 — project analytics computed with the exact completion state machine
 * (§14 Phase 6). Self-assessed rubric scores always retain their "Self-assessed"
 * labelling; they are never presented as verified grades.
 */
export interface ProjectAnalyticsRow {
  projectId: string;
  slug: string;
  title: string;
  level: string;
  status: ProjectStatus;
  milestonesRequired: number;
  milestonesCompleted: number;
  evidenceCount: number;
  estimatedHours: number;
  selfAssessmentHistory: Array<{
    scores: Record<string, number>;
    totalEarned: number | null;
    totalMax: number | null;
    updatedAt: string;
  }>;
}

export interface ProjectAnalytics {
  rows: ProjectAnalyticsRow[];
  started: number;
  inProgress: number;
  submitted: number;
  completed: number;
  mastered: number;
  milestonesCompleted: number;
  evidenceProvided: number;
  totalEstimatedHours: number;
}

export function projectAnalytics(
  projectProgress: ProjectProgress[],
  projectEvidence: ProjectEvidence[],
  projectSelfAssessments: ProjectSelfAssessment[],
  timeZone: string,
  options: { periodStart?: string } = {}
): ProjectAnalytics {
  void timeZone;
  void options;

  const evidenceByProject = new Map<string, EvidenceEntry[]>();
  for (const entry of projectEvidence) {
    if (entry.deletedAt) continue;
    const list = evidenceByProject.get(entry.projectId) ?? [];
    list.push({
      id: entry.id,
      projectId: entry.projectId,
      kind: entry.kind,
      value: entry.value,
      title: entry.title,
      createdAt: entry.createdAt,
      selfReported: entry.selfReported,
    });
    evidenceByProject.set(entry.projectId, list);
  }

  const milestonesByProject = new Map<string, MilestoneState[]>();
  for (const row of projectProgress) {
    if (!row.milestoneId) continue;
    const list = milestonesByProject.get(row.projectId) ?? [];
    list.push({ milestoneId: row.milestoneId, completed: row.completed, evidenceUrl: row.evidenceUrl });
    milestonesByProject.set(row.projectId, list);
  }

  const rows: ProjectAnalyticsRow[] = projectCatalog.map((project) => {
    const states = milestonesByProject.get(project.id) ?? [];
    const evidence = evidenceByProject.get(project.id) ?? [];
    const selfAssessment = projectSelfAssessments.find(
      (assessment) => assessment.projectId === project.id
    );
    const { status, rubricScore } = computeProjectStatus(project, {
      milestoneStates: states,
      evidence,
      selfAssessment: selfAssessment
        ? { scores: selfAssessment.scores, updatedAt: selfAssessment.updatedAt }
        : null,
    });
    void rubricScore;
    return {
      projectId: project.id,
      slug: project.slug,
      title: project.title,
      level: project.level,
      status,
      milestonesRequired: project.milestones.filter((milestone) => milestone.required).length,
      milestonesCompleted: states.filter((state) => state.completed).length,
      evidenceCount: evidence.length,
      estimatedHours: project.estimatedHours,
      selfAssessmentHistory: selfAssessment
        ? [
            {
              scores: selfAssessment.scores,
              totalEarned: selfAssessment.totalEarned,
              totalMax: selfAssessment.totalMax,
              updatedAt: selfAssessment.updatedAt,
            },
          ]
        : [],
    };
  });

  const count = (status: ProjectStatus) => rows.filter((row) => row.status === status).length;

  return {
    rows,
    started: rows.filter((row) => row.status !== "not_started").length,
    inProgress: count("in_progress"),
    submitted: count("submitted"),
    completed: count("completed"),
    mastered: count("mastered"),
    milestonesCompleted: projectProgress.filter((row) => row.completed).length,
    evidenceProvided: projectEvidence.filter((entry) => !entry.deletedAt).length,
    totalEstimatedHours: Math.round(
      rows
        .filter((row) => row.status !== "not_started")
        .reduce((sum, row) => sum + row.estimatedHours, 0) * 10
    ) / 10,
  };
}

export type { RubricSelfAssessment };
