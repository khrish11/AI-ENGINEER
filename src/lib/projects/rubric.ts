import type { Rubric } from "./schema";

export interface RubricCategoryScore {
  id: string;
  category: string;
  weight: number;
  score: number;
  /** Clamp feedback: score must fall within 0..weight. */
  valid: boolean;
}

export interface RubricScoreResult {
  categories: RubricCategoryScore[];
  total: number;
  max: number;
  percentage: number | null;
  complete: boolean;
}

/**
 * §13 — normalize raw rubric scores. Invalid entries are clamped out (not
 * silently trusted); `complete` requires every category scored.
 */
export function scoreRubric(
  rubric: Rubric,
  scores: Record<string, number>
): RubricScoreResult {
  const categories: RubricCategoryScore[] = rubric.categories.map((category) => {
    const raw = scores[category.id];
    const numeric = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    const valid = numeric !== null && numeric >= 0 && numeric <= category.weight;
    return {
      id: category.id,
      category: category.category,
      weight: category.weight,
      score: valid ? numeric : 0,
      valid,
    };
  });
  const total = categories.reduce((sum, category) => sum + (category.valid ? category.score : 0), 0);
  const max = categories.reduce((sum, category) => sum + category.weight, 0);
  const complete = categories.every((category) => category.valid);
  return {
    categories,
    total,
    max,
    percentage: complete && max > 0 ? Math.round((total / max) * 100) : null,
    complete,
  };
}

/** Display tier for a self-assessed score — never presented as certification (§13). */
export function rubricVerdict(result: RubricScoreResult, thresholds: { completion: number; mastery: number }): "below_completion" | "completed" | "mastered" {
  if (result.percentage === null) return "below_completion";
  if (result.percentage >= thresholds.mastery) return "mastered";
  if (result.percentage >= thresholds.completion) return "completed";
  return "below_completion";
}

export const SELF_ASSESSED_LABEL = "Self-assessed" as const;
