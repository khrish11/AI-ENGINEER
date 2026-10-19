import {
  computeProjectStatus,
  type EvidenceEntry,
  type MilestoneState,
  type ProjectStatus,
  type RubricSelfAssessment,
} from "./completion";
import type { ProjectDefinition } from "./schema";

/**
 * §11 — evaluation boundary.
 *
 * A ProjectEvaluator decides whether a submission demonstrates a project's
 * requirements. CRITICAL: evaluators receive structured evidence only. They
 * never execute learner code, never clone or build repositories, and never run
 * uploaded files. Future isolated execution (external CI runners) must arrive
 * through a new evaluator kind (`isolated`) that communicates out-of-band, not
 * through this interface gaining code execution.
 */
export type EvaluatorKind = "manual" | "metadata" | "isolated";

export interface Submission {
  projectId: string;
  milestoneStates: MilestoneState[];
  evidence: EvidenceEntry[];
  selfAssessment: RubricSelfAssessment | null;
}

export interface EvaluationCheck {
  id: string;
  label: string;
  passed: boolean;
  /** Pure functions never make claims from stars/forks/existence alone. */
  detail?: string;
}

export interface EvaluationResult {
  evaluator: EvaluatorKind;
  checkedAt: string;
  /** The same completion state machine the UI uses — evaluators never override it. */
  status: ProjectStatus;
  checks: EvaluationCheck[];
  passed: boolean;
  notes: string[];
}

export interface ProjectEvaluator {
  readonly kind: EvaluatorKind;
  evaluate(submission: Submission, project: ProjectDefinition): Promise<EvaluationResult>;
}

/**
 * Safe Phase 6 evaluator: metadata only. Re-runs the deterministic completion
 * rules over the structured submission and re-validates evidence URLs. This
 * never touches a repository, a runner, or a network fetch — "metadata"
 * means: what the learner submitted, deterministically checked.
 */
export class MetadataProjectEvaluator implements ProjectEvaluator {
  readonly kind: EvaluatorKind = "metadata";

  async evaluate(submission: Submission, project: ProjectDefinition): Promise<EvaluationResult> {
    const notes: string[] = [];
    const checks: EvaluationCheck[] = [];

    const status = computeProjectStatus(project, submission);

    checks.push({
      id: "milestones",
      label: "All required milestones complete",
      passed: status.requiredMilestonesComplete,
    });
    checks.push({
      id: "evidence",
      label: "All required project evidence attached",
      passed: status.requiredEvidenceProvided,
    });
    if (project.rubric) {
      checks.push({
        id: "self-assessment",
        label: "Every rubric category self-assessed",
        passed: status.minimumSelfAssessmentCompleted,
      });
      if (status.rubricScore) {
        checks.push({
          id: "rubric-threshold",
          label: "Rubric total within project thresholds",
          passed: status.status === "completed" || status.status === "mastered",
          detail: `${status.rubricScore.total}/${status.rubricScore.max} self-assessed`,
        });
      }
    }

    // Evidence hygiene: kinds must exist in the shared allowlist (value
    // validation already happened at attach time; kinds are checked here so an
    // imported payload cannot smuggle an unknown kind past the gate).
    const unknownKinds = submission.evidence
      .map((entry) => entry.kind)
      .filter((kind) => !project.requiredEvidence.some((requirement) => requirement.kind === kind));
    checks.push({
      id: "evidence-kinds-unknown",
      label: "No unrecognised evidence kinds in project scope",
      passed: unknownKinds.length === 0,
      detail: unknownKinds.length ? unknownKinds.join(", ") : undefined,
    });

    notes.push(
      "Manual/metadata evaluation only: no learner code was executed, and repository popularity or existence is never treated as quality."
    );
    notes.push(
      "Self-assessment scores are learner-reported; they are labelled Self-assessed and never presented as certification."
    );

    const passed = status.status === "completed" || status.status === "mastered";

    return {
      evaluator: this.kind,
      checkedAt: new Date().toISOString(),
      status: status.status,
      checks,
      passed,
      notes,
    };
  }
}

/** Future slot: an isolated external CI evaluator would implement this too. */
export const metadataProjectEvaluator: ProjectEvaluator = new MetadataProjectEvaluator();
