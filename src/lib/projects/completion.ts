import type { ProjectDefinition, Rubric } from "./schema";

/** Core status inputs derived from persisted learner records (Phase 4 stores). */
export interface MilestoneState {
  milestoneId: string;
  completed: boolean;
  /** Attached when the learner completed the milestone (evidence URL or note). */
  evidenceUrl?: string | null;
}

export interface EvidenceEntry {
  id: string;
  projectId: string;
  kind: string;
  /** https URL, note text, or in-repo path depending on evidence kind. */
  value: string;
  title?: string | null;
  createdAt: string;
  /** Always true for learner-attached evidence in Phase 6 (privacy §53). */
  selfReported: boolean;
}

export interface RubricSelfAssessment {
  /** rubricCategoryId -> score (0..weight). Absent category = not assessed. */
  scores: Record<string, number>;
  updatedAt: string | null;
}

/** Empty inputs mean "never touched this project" — not "completed". */
export interface ProjectStatusInputs {
  milestoneStates: MilestoneState[];
  evidence: EvidenceEntry[];
  selfAssessment: RubricSelfAssessment | null;
}

export const PROJECT_STATUSES = [
  "not_started",
  "in_progress",
  "submitted",
  "completed",
  "mastered",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export function rubricTotal(
  rubric: Rubric | undefined,
  scores: Record<string, number> | undefined
): { total: number; max: number; assessed: boolean } | null {
  if (!rubric) return null;
  const max = rubric.categories.reduce((sum, category) => sum + category.weight, 0);
  let total = 0;
  let assessedCount = 0;
  for (const category of rubric.categories) {
    const score = scores?.[category.id];
    if (typeof score === "number" && score >= 0 && score <= category.weight) {
      total += score;
      assessedCount += 1;
    }
  }
  return { total, max, assessed: assessedCount === rubric.categories.length && assessedCount > 0 };
}

/**
 * §14 — completion requires ALL of:
 *  - every required milestone complete (with its required evidence kinds covered),
 *  - every required project-level evidence requirement provided (matching kind),
 *  - for projects with a rubric: every rubric category self-assessed at least once.
 */
export function computeProjectStatus(
  project: ProjectDefinition,
  inputs: ProjectStatusInputs
): {
  status: ProjectStatus;
  requiredMilestonesComplete: boolean;
  requiredEvidenceProvided: boolean;
  minimumSelfAssessmentCompleted: boolean;
  rubricScore: { total: number; max: number; assessed: boolean } | null;
} {
  const statesByMilestone = new Map(inputs.milestoneStates.map((s) => [s.milestoneId, s]));
  const requiredMilestones = project.milestones.filter((m) => m.required);
  const requiredMilestonesComplete =
    requiredMilestones.length > 0 &&
    requiredMilestones.every((m) => {
      const state = statesByMilestone.get(m.id);
      if (!state?.completed) return false;
      // Each required evidence id requested by the milestone must have an entry.
      return m.requiredEvidence.every((evidenceId) => {
        const requirement = project.requiredEvidence.find((r) => r.id === evidenceId);
        if (!requirement) return false;
        return inputs.evidence.some((entry) => entry.kind === requirement.kind);
      });
    });

  const requiredEvidenceProvided = project.requiredEvidence
    .filter((requirement) => requirement.required)
    .every((requirement) => inputs.evidence.some((entry) => entry.kind === requirement.kind));

  const rubricScore = rubricTotal(project.rubric, inputs.selfAssessment?.scores);
  const minimumSelfAssessmentCompleted = project.rubric ? Boolean(rubricScore?.assessed) : true;

  const anyMilestoneComplete = inputs.milestoneStates.some(
    (s) => s.completed && project.milestones.some((m) => m.id === s.milestoneId)
  );
  const anyEvidence = inputs.evidence.length > 0;
  const started = anyMilestoneComplete || anyEvidence || Boolean(inputs.selfAssessment);

  let status: ProjectStatus = "not_started";
  if (started) status = "in_progress";
  if (requiredMilestonesComplete && requiredEvidenceProvided && minimumSelfAssessmentCompleted) {
    status = "submitted";
  }
  // Submitted → completed: rubric total must clear the completion threshold when a
  // rubric exists; otherwise milestones + evidence are sufficient (beginner projects).
  if (status === "submitted") {
    if (!project.rubric || (rubricScore && rubricScore.assessed && rubricScore.total >= project.rubric.completionThreshold)) {
      status = "completed";
    }
  }
  // §15 — mastery: completed + rubric mastery threshold + a reflection-quality evidence
  // (markdown_reflection) when the project requires deep evidence (advanced/capstone).
  if (status === "completed" && project.rubric) {
    const reflectionOk =
      project.level === "beginner" ||
      project.level === "intermediate" ||
      inputs.evidence.some((entry) => entry.kind === "markdown_reflection");
    if (
      rubricScore &&
      rubricScore.assessed &&
      rubricScore.total >= project.rubric.masteryThreshold &&
      reflectionOk
    ) {
      status = "mastered";
    }
  }

  return {
    status,
    requiredMilestonesComplete,
    requiredEvidenceProvided,
    minimumSelfAssessmentCompleted,
    rubricScore,
  };
}

/** Milestones that still block completion (used by the UI next-action hints). */
export function blockingMilestones(project: ProjectDefinition, inputs: ProjectStatusInputs): string[] {
  const states = new Map(inputs.milestoneStates.map((s) => [s.milestoneId, s]));
  return project.milestones
    .filter((m) => m.required && !states.get(m.id)?.completed)
    .map((m) => m.title);
}

/** §35 — deterministic prerequisite audit for starting a project (esp. capstones). */
export function auditPrerequisites(
  project: ProjectDefinition,
  completedProjectIds: Set<string>
): { completed: string[]; missing: string[] } {
  const completed = project.prerequisites.filter((id) => completedProjectIds.has(id));
  const missing = project.prerequisites.filter((id) => !completedProjectIds.has(id));
  return { completed, missing };
}
