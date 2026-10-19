/**
 * §45 — deterministic validation for impossible metrics. Pure functions used
 * by the analytics page before rendering; a violated invariant is reported,
 * never silently displayed as a plausible number.
 */
export interface ValidationIssue {
  metric: string;
  message: string;
}

export function validateCounts(input: {
  completed: number;
  total: number;
  mastered?: number;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (input.completed < 0 || input.total < 0) {
    issues.push({ metric: "counts", message: "Counts cannot be negative." });
  }
  if (input.total > 0 && input.completed > input.total) {
    issues.push({
      metric: "counts",
      message: `Completed (${input.completed}) cannot exceed total (${input.total}).`,
    });
  }
  if (typeof input.mastered === "number" && input.mastered > input.completed) {
    issues.push({
      metric: "mastery",
      message: `Mastered (${input.mastered}) cannot exceed completed (${input.completed}).`,
    });
  }
  return issues;
}

export function validateTimestamps(input: { startedAt: string | null; endedAt: string | null }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (input.startedAt && Number.isNaN(Date.parse(input.startedAt))) {
    issues.push({ metric: "startedAt", message: "Invalid timestamp." });
  }
  if (input.endedAt && Number.isNaN(Date.parse(input.endedAt))) {
    issues.push({ metric: "endedAt", message: "Invalid timestamp." });
  }
  if (
    input.startedAt &&
    input.endedAt &&
    Date.parse(input.endedAt) < Date.parse(input.startedAt)
  ) {
    issues.push({ metric: "duration", message: "Session cannot end before it starts." });
  }
  return issues;
}

export function validateSessionDuration(seconds: number | null): ValidationIssue[] {
  if (seconds === null) return [];
  if (seconds < 0) {
    return [{ metric: "duration", message: "Study duration cannot be negative." }];
  }
  return [];
}

export function validateMilestoneCount(input: { completed: number; projectMilestoneCount: number }): ValidationIssue[] {
  if (input.completed > input.projectMilestoneCount) {
    return [
      {
        metric: "milestones",
        message: `Completed milestones (${input.completed}) cannot exceed the project's milestone count (${input.projectMilestoneCount}).`,
      },
    ];
  }
  return [];
}

export function validateRubricScore(input: { score: number; weight: number }): ValidationIssue[] {
  if (input.score < 0 || input.score > input.weight) {
    return [
      {
        metric: "rubric",
        message: `Rubric score ${input.score} is outside the configured 0..${input.weight} range.`,
      },
    ];
  }
  return [];
}
