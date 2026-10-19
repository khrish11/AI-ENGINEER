/** §26 — mastery evidence combines multiple sources with a documented formula. */

export interface LessonEvidence {
  /** Canonical lesson keys completed for this skill's lessons. */
  completedLessons: number;
  totalLessons: number;
}

export interface AssessmentEvidence {
  /** Valid, submitted attempts touching this skill. */
  validAttempts: number;
  /** Average percentage across the last 3 attempts (or null). */
  recentAverage: number | null;
}

export interface ProjectEvidence {
  /** Projects tagged with this skill that are completed/mastered. */
  completedProjects: number;
  totalProjects: number;
}

export interface MasteryEvidence {
  skillId: string;
  lessonEvidence: LessonEvidence;
  assessmentEvidence: AssessmentEvidence;
  projectEvidence: ProjectEvidence;
  /**
   * Documented formula (avoid opaque percentages):
   *   lessonPoints   = (completedLessons / max(totalLessons, 1)) * 0.4   — capped at 1
   *   assessmentPts  = recentAverage == null ? 0 : (recentAverage/100) * 0.4
   *   projectPoints  = projectEvidence.totalProjects === 0
   *                   ? 0 : (completedProjects / totalProjects) * 0.2
   *   score          = round(100 * (lessonPoints + assessmentPts + projectPoints))
   * Bands: <50 developing · 50–74 proficient · >=75 strong.
   * No single input can create mastery by itself (each source is capped).
   */
  score: number;
  band: "developing" | "proficient" | "strong";
  labels: string[];
}

const LESSON_WEIGHT = 0.4;
const ASSESSMENT_WEIGHT = 0.4;
const PROJECT_WEIGHT = 0.2;

export function computeMasteryEvidence(
  skillId: string,
  lessonEvidence: LessonEvidence,
  assessmentEvidence: AssessmentEvidence,
  projectEvidence: ProjectEvidence
): MasteryEvidence {
  const lessonPoints =
    Math.min(1, lessonEvidence.completedLessons / Math.max(lessonEvidence.totalLessons, 1)) *
    LESSON_WEIGHT;
  const assessmentPoints =
    assessmentEvidence.recentAverage === null
      ? 0
      : (assessmentEvidence.recentAverage / 100) * ASSESSMENT_WEIGHT;
  const projectPoints =
    projectEvidence.totalProjects === 0
      ? 0
      : (projectEvidence.completedProjects / projectEvidence.totalProjects) * PROJECT_WEIGHT;
  const score = Math.round((lessonPoints + assessmentPoints + projectPoints) * 100);
  const band =
    score >= 75 ? "strong" : score >= 50 ? "proficient" : "developing";
  const labels: string[] = [];
  if (lessonEvidence.completedLessons > 0) {
    labels.push(`Lessons: ${lessonEvidence.completedLessons}/${lessonEvidence.totalLessons} complete`);
  }
  if (assessmentEvidence.validAttempts > 0 && assessmentEvidence.recentAverage !== null) {
    labels.push(`Assessments: ${assessmentEvidence.validAttempts} attempt(s), recent avg ${assessmentEvidence.recentAverage}%`);
  }
  if (projectEvidence.totalProjects > 0) {
    labels.push(`Projects: ${projectEvidence.completedProjects}/${projectEvidence.totalProjects} complete`);
  }
  return {
    skillId,
    lessonEvidence,
    assessmentEvidence,
    projectEvidence,
    score,
    band,
    labels,
  };
}
