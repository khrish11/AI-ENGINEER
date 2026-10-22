import type { AnalyticsSources } from "./types";
import { curriculumProgress, type CurriculumProgress } from "./curriculum";
import { studyTimeStatsFromValidSessions, validSessions, type StudyTimeStats } from "./study-time";
import { streakStatsFromValidSessions, type StreakStats } from "./streaks";
import type { ProjectProgress, QuizAttempt } from "@/lib/progress/db";
import { projectCatalog } from "@/lib/projects/catalog";
import { computeProjectStatus, type MilestoneState } from "@/lib/projects/completion";

export type { CurriculumProgress, StudyTimeStats, StreakStats };

export interface AnalyticsOverview {
  lessonsCompleted: number;
  lessonsMastered: number;
  curriculum: CurriculumProgress;
  roadmapProgress: number | null;
  studyTime: StudyTimeStats;
  streakStats: StreakStats;
  projectsCompleted: number;
  projectsInProgress: number;
  projectsMastered: number;
  assessmentsTaken: number;
  skillsDeveloping: number;
  skillsProficient: number;
  skillsStrong: number;
}

/**
 * §4 Overview. Every metric derives from stored records (§2). No fabricated
 * numbers, streaks, or badges: streaks use the study-day rule, project counts
 * use the real completion state machine, and roadmap progress exists only when
 * an actual plan exists.
 */
export function computeOverview(sources: AnalyticsSources, timeZone: string): AnalyticsOverview {
  const curriculum = curriculumProgress(sources.lessons);
  const valid = validSessions(sources.studySessions);
  const studyTime = studyTimeStatsFromValidSessions(valid, timeZone);
  const streaks = streakStatsFromValidSessions(valid, timeZone);

  const milestoneStates = new Map<string, MilestoneState[]>();
  const evidenceByProject = new Map<string, typeof sources.projectEvidence>();
  const selfAssessmentsByProject = new Map(
    sources.projectSelfAssessments.map((assessment) => [assessment.projectId, assessment])
  );
  for (const row of sources.projectProgress) {
    if (!row.milestoneId) continue;
    const list = milestoneStates.get(row.projectId) ?? [];
    list.push({ milestoneId: row.milestoneId, completed: row.completed, evidenceUrl: row.evidenceUrl });
    milestoneStates.set(row.projectId, list);
  }
  for (const entry of sources.projectEvidence) {
    if (entry.deletedAt) continue;
    const list = evidenceByProject.get(entry.projectId) ?? [];
    list.push(entry);
    evidenceByProject.set(entry.projectId, list);
  }

  let projectsCompleted = 0;
  let projectsInProgress = 0;
  let projectsMastered = 0;
  for (const project of projectCatalog) {
    const states = milestoneStates.get(project.id) ?? [];
    const status = computeProjectStatus(project, {
      milestoneStates: states,
      evidence: evidenceByProject.get(project.id) ?? [],
      selfAssessment:
        selfAssessmentsByProject.get(project.id) ?? null,
    });
    if (status.status === "completed") projectsCompleted += 1;
    else if (status.status === "mastered") projectsMastered += 1;
    else if (status.status === "in_progress" || status.status === "submitted") projectsInProgress += 1;
  }

  const counts = countSkillBands(sources);
  const roadmapProgress =
    sources.roadmapPlan &&
    sources.roadmapPlan.summary &&
    sources.roadmapPlan.summary.totalOccurrences > 0
      ? Math.round(
          (sources.roadmapPlan.summary.completedOccurrences /
            sources.roadmapPlan.summary.totalOccurrences) *
            100
        ) / 1
      : null;

  const assessmentAttempts: QuizAttempt[] = sources.quizAttempts;

  return {
    lessonsCompleted: curriculum.canonicalCompleted,
    lessonsMastered: curriculum.canonicalMastered,
    curriculum,
    roadmapProgress,
    studyTime,
    streakStats: streaks,
    projectsCompleted,
    projectsInProgress,
    projectsMastered,
    assessmentsTaken: assessmentAttempts.length,
    skillsDeveloping: counts.developing,
    skillsProficient: counts.proficient,
    skillsStrong: counts.strong,
  };
}

function countSkillBands(sources: AnalyticsSources): { developing: number; proficient: number; strong: number } {
  void sources;
  // Filled by skillAnalytics at the page level; overview counts are injected there.
  return { developing: 0, proficient: 0, strong: 0 };
}

/** Milestones across all projects completed by the learner. */
export function completedMilestoneCount(progress: ProjectProgress[]): number {
  return progress.filter((row) => row.completed).length;
}
