export type LessonStatus = "not_started" | "in_progress" | "completed" | "mastered";

export interface LessonActivityAvailability {
  hasVideo: boolean;
  hasQuiz: boolean;
  hasProject: boolean;
  hasResources: boolean;
}

export interface LessonRequirements {
  readingComplete: boolean;
  requiredResourcesComplete: boolean;
  practiceComplete: boolean;
  projectComplete: boolean;
}

export interface CompletionEvaluation {
  status: LessonStatus;
  needsReview: boolean;
  canMarkComplete: boolean;
  canMarkMastered: boolean;
  blockingFields: string[];
  progressPercent: number;
}

const STATUS_RANK: Record<LessonStatus, number> = {
  not_started: 0,
  in_progress: 1,
  completed: 2,
  mastered: 3,
};

export const MASTERY_THRESHOLD = 80;

export function statusRank(status: LessonStatus): number {
  return STATUS_RANK[status] ?? 0;
}

export function isHigherStatus(a: LessonStatus, b: LessonStatus): boolean {
  return statusRank(a) > statusRank(b);
}

export function monotonicMergeStatus(
  current: LessonStatus,
  candidate: LessonStatus
): LessonStatus {
  return statusRank(candidate) > statusRank(current) ? candidate : current;
}

export function hasStartedActivity(requirements: LessonRequirements): boolean {
  return (
    requirements.readingComplete ||
    requirements.requiredResourcesComplete ||
    requirements.practiceComplete ||
    requirements.projectComplete
  );
}

export function requiredFields(
  availability: LessonActivityAvailability
): Array<keyof LessonRequirements> {
  const fields: Array<keyof LessonRequirements> = ["readingComplete"];
  if (availability.hasResources) fields.push("requiredResourcesComplete");
  if (availability.hasQuiz) fields.push("practiceComplete");
  if (availability.hasProject) fields.push("projectComplete");
  return fields;
}

export function evaluateCompletion(
  currentStatus: LessonStatus,
  availability: LessonActivityAvailability,
  requirements: LessonRequirements,
  masteryScore: number | null,
  needsReview: boolean
): CompletionEvaluation {
  const blockingFields: string[] = [];

  if (!requirements.readingComplete) blockingFields.push("reading");
  if (availability.hasResources && !requirements.requiredResourcesComplete) {
    blockingFields.push("resources");
  }
  if (availability.hasQuiz && !requirements.practiceComplete) {
    blockingFields.push("practice");
  }
  if (availability.hasProject && !requirements.projectComplete) {
    blockingFields.push("project");
  }

  const allRequiredComplete = blockingFields.length === 0;
  const started = hasStartedActivity(requirements);
  const canMarkComplete = allRequiredComplete && started;
  const canMarkMastered =
    canMarkComplete && masteryScore !== null && masteryScore >= MASTERY_THRESHOLD;

  let status: LessonStatus = currentStatus;
  if (currentStatus === "mastered") {
    status = "mastered";
  } else if (canMarkComplete && canMarkMastered && currentStatus === "completed") {
    status = "mastered";
  } else if (canMarkComplete) {
    status = "completed";
  } else if (started) {
    status = "in_progress";
  } else {
    status = "not_started";
  }

  const totalRequirements = requiredFields(availability).length;
  const completedRequirements = requiredFields(availability).filter(
    (field) => requirements[field]
  ).length;
  const progressPercent =
    totalRequirements === 0
      ? 0
      : Math.round((completedRequirements / totalRequirements) * 100);

  return {
    status,
    needsReview,
    canMarkComplete,
    canMarkMastered,
    blockingFields,
    progressPercent,
  };
}

export function lessonStatusLabel(status: LessonStatus): string {
  const labels: Record<LessonStatus, string> = {
    not_started: "Not Started",
    in_progress: "In Progress",
    completed: "Completed",
    mastered: "Mastered",
  };
  return labels[status];
}

export function mergeCompletionFlags(
  a: LessonRequirements,
  b: LessonRequirements
): LessonRequirements {
  return {
    readingComplete: a.readingComplete || b.readingComplete,
    requiredResourcesComplete:
      a.requiredResourcesComplete || b.requiredResourcesComplete,
    practiceComplete: a.practiceComplete || b.practiceComplete,
    projectComplete: a.projectComplete || b.projectComplete,
  };
}

export function earliestTimestamp(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}
