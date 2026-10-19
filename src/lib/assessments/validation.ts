import { occurrences, skillsById } from "@/lib/roadmap/config";
import type { Assessment } from "./schema";

export interface AssessmentValidationIssue {
  field: string;
  message: string;
}

export interface AssessmentValidationResult {
  ok: boolean;
  issues: AssessmentValidationIssue[];
}

const occurrenceIdsValid = new Set(occurrences.map((item) => item.occurrenceId));

export function validateAssessment(assessment: Assessment): AssessmentValidationResult {
  const issues: AssessmentValidationIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });

  if (!occurrenceIdsValid.has(`${assessment.phaseSlug}/01`)) {
    // Phase slug must at least prefix a real occurrence family.
    const hasFamily = [...occurrenceIdsValid].some((id) => id.startsWith(`${assessment.phaseSlug}/`));
    if (!hasFamily) add("phaseSlug", `Unknown phase slug: ${assessment.phaseSlug}`);
  }

  assessment.questions.forEach((question, index) => {
    for (const ref of question.lessonRefs) {
      if (!occurrenceIdsValid.has(ref)) {
        add(`questions[${index}].lessonRefs`, `Unknown curriculum occurrence: ${ref}`);
      }
    }
    for (const skillId of question.skills) {
      if (!skillsById.has(skillId)) {
        add(`questions[${index}].skills`, `Unknown skill id: ${skillId}`);
      }
    }
    if (question.skills.length === 0) {
      add(`questions[${index}].skills`, "Question must map to at least one skill.");
    }
    if (question.type === "single_choice" && question.options) {
      if ((question.correctOptionIndex ?? -1) >= question.options.length) {
        add(`questions[${index}]`, "correctOptionIndex out of range.");
      }
    }
    if (question.type === "multiple_choice" && question.options) {
      for (const idx of question.correctOptionIndices ?? []) {
        if (idx >= question.options.length) {
          add(`questions[${index}]`, "correctOptionIndices out of range.");
        }
      }
    }
    if (question.type === "ordering" && question.options) {
      const order = question.correctOrder ?? [];
      const sorted = [...order].sort((a, b) => a - b);
      if (order.length > 0 && sorted.some((v, i) => v !== i)) {
        add(`questions[${index}]`, "correctOrder must be a permutation of option indices.");
      }
    }
  });

  // Every checkpoint should reference its phase's curriculum somewhere.
  if (assessment.kind === "phase_checkpoint") {
    const phaseReferenced = assessment.questions.some((question) =>
      question.lessonRefs.some((ref) => ref.startsWith(`${assessment.phaseSlug}/`))
    );
    if (!phaseReferenced) {
      add("questions", "Checkpoint should reference lessons from its own phase.");
    }
  }

  return { ok: issues.length === 0, issues };
}
