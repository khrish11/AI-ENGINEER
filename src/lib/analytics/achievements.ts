import type { LessonProgress, QuizAttempt, StudySession, ProjectProgress, ProjectEvidence } from "@/lib/progress/db";
import { occurrences } from "@/lib/roadmap/config";
import { projectCatalog } from "@/lib/projects/catalog";
import { validSessions } from "./study-time";

/**
 * §19/§20 — achievements are real events derived from source records with the
 * earliest matching timestamp as `earnedAt`. Nothing is manually creatable, no
 * page visits count, and the list is fully reconstructable. No excessive
 * gamification: a small, meaningful set.
 */
export interface Achievement {
  id: string;
  title: string;
  description: string;
  earnedAt: string | null;
  sourceEvidence: string;
}

export function deriveAchievements(inputs: {
  lessons: LessonProgress[];
  studySessions: StudySession[];
  quizAttempts: QuizAttempt[];
  projectProgress: ProjectProgress[];
  projectEvidence: ProjectEvidence[];
}): Achievement[] {
  const achievements: Achievement[] = [];

  const completionTimestamps = (predicate: (row: LessonProgress) => boolean): string[] =>
    inputs.lessons
      .filter((row) => predicate(row) && (row.completedAt ?? row.updatedAt))
      .map((row) => row.completedAt ?? row.updatedAt as string)
      .sort((a, b) => a.localeCompare(b));

  const firstLesson = completionTimestamps(
    (row) => row.status === "completed" || row.status === "mastered"
  )[0];
  achievements.push({
    id: "first-lesson",
    title: "First lesson completed",
    description: "Completed your first canonical lesson.",
    earnedAt: firstLesson ?? null,
    sourceEvidence: "lesson_progress.completed_at",
  });

  const firstPhase = phaseCompletionTimestamp(inputs.lessons);
  achievements.push({
    id: "first-phase",
    title: "First phase completed",
    description: "Completed every required lesson of one curriculum phase.",
    earnedAt: firstPhase,
    sourceEvidence: "lesson_progress by phase coverage",
  });

  const sessions = validSessions(inputs.studySessions);
  const firstTenHours = tenHourTimestamp(sessions);
  achievements.push({
    id: "first-10-hours",
    title: "First 10 study hours",
    description: "Accumulated 10 hours of recorded study time.",
    earnedAt: firstTenHours,
    sourceEvidence: "study_sessions.duration_seconds",
  });

  const firstMilestone = inputs.projectProgress
    .filter((row) => row.completed && row.completedAt)
    .map((row) => row.completedAt as string)
    .sort((a, b) => a.localeCompare(b))[0];
  achievements.push({
    id: "first-project-milestone",
    title: "First project milestone",
    description: "Completed your first project milestone with evidence.",
    earnedAt: firstMilestone ?? null,
    sourceEvidence: "project_progress.completed_at",
  });

  const passingAttempts = inputs.quizAttempts
    .filter((attempt) => (attempt.percentage ?? 0) >= 70 && attempt.submittedAt)
    .sort((a, b) => (a.submittedAt as string).localeCompare(b.submittedAt as string));
  achievements.push({
    id: "first-assessment-improvement",
    title: "First assessment improvement",
    description: "Scored a second valid attempt better than your first.",
    earnedAt: firstImprovementTimestamp(inputs.quizAttempts),
    sourceEvidence: "quiz_attempts.percentage",
  });
  void passingAttempts;

  const firstProjectCompleted = projectCompletedTimestamp(inputs);
  achievements.push({
    id: "first-project-completed",
    title: "First project completed",
    description: "Met the completion criteria of your first project.",
    earnedAt: firstProjectCompleted,
    sourceEvidence: "project_progress + project_evidence",
  });

  const firstCapstoneSubmitted = capstoneSubmittedTimestamp(inputs);
  achievements.push({
    id: "first-capstone",
    title: "First capstone submitted",
    description: "Met the completion criteria of a capstone project.",
    earnedAt: firstCapstoneSubmitted,
    sourceEvidence: "project_progress + project_evidence",
  });

  return achievements;
}

/** A phase counts as completed when every occurrence mapped to it is done. */
function phaseCompletionTimestamp(lessons: LessonProgress[]): string | null {
  const canonicalDone = new Map<string, string>();
  for (const row of lessons) {
    if (row.status !== "completed" && row.status !== "mastered") continue;
    const at = row.completedAt ?? row.updatedAt;
    if (at) canonicalDone.set(row.lessonId, at);
  }
  const phaseKeys = new Map<string, Set<string>>();
  for (const occurrence of occurrences) {
    const set = phaseKeys.get(occurrence.phaseSlug) ?? new Set<string>();
    set.add(occurrence.canonicalLessonKey);
    phaseKeys.set(occurrence.phaseSlug, set);
  }
  const completions: Array<{ phaseSlug: string; at: string }> = [];
  for (const [phaseSlug, keys] of phaseKeys) {
    if (keys.size === 0) continue;
    const stamps = [...keys].map((key) => canonicalDone.get(key)).filter(Boolean) as string[];
    if (stamps.length < keys.size) continue;
    // Phase done when its last lesson finished.
    completions.push({ phaseSlug, at: stamps.sort((a, b) => a.localeCompare(b))[stamps.length - 1] });
  }
  completions.sort((a, b) => a.at.localeCompare(b.at));
  return completions[0]?.at ?? null;
}

function tenHourTimestamp(sessions: Array<{ startedAt: string; durationSeconds: number }>): string | null {
  if (sessions.length === 0) return null;
  // Accumulate duration; "earnedAt" is the session during which the total crossed 10h.
  const sorted = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  let total = 0;
  for (const session of sorted) {
    if (total >= 10 * 60 * 60) break;
    total += session.durationSeconds;
    if (total >= 10 * 60 * 60) return session.startedAt;
  }
  return null;
}

function firstImprovementTimestamp(attempts: QuizAttempt[]): string | null {
  const byAssessment = new Map<string, QuizAttempt[]>();
  for (const attempt of attempts) {
    if (attempt.percentage === null || !attempt.submittedAt) continue;
    const list = byAssessment.get(attempt.quizId) ?? [];
    list.push(attempt);
    byAssessment.set(attempt.quizId, list);
  }
  const stamps: string[] = [];
  for (const list of byAssessment.values()) {
    list.sort((a, b) => (a.submittedAt as string).localeCompare(b.submittedAt as string));
    const first = list[0]?.percentage ?? 0;
    const better = list.find((attempt) => (attempt.percentage as number) > first);
    if (better?.submittedAt) stamps.push(better.submittedAt);
  }
  stamps.sort((a, b) => a.localeCompare(b));
  return stamps[0] ?? null;
}

function projectCompletedTimestamp(inputs: {
  projectProgress: ProjectProgress[];
  projectEvidence: ProjectEvidence[];
}): string | null {
  const evidenceKinds = new Set(inputs.projectEvidence.filter((entry) => !entry.deletedAt).map((entry) => entry.kind));
  for (const project of projectCatalog) {
    const rows = inputs.projectProgress.filter((row) => row.projectId === project.id && row.completed);
    const requiredCount = project.milestones.filter((milestone) => milestone.required).length;
    if (rows.length < requiredCount) continue;
    // Completed requires at least one evidence kind attached.
    const stamp = rows
      .map((row) => row.completedAt ?? "")
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))[0];
    if (stamp && evidenceKinds.size > 0) return stamp;
  }
  return null;
}

function capstoneSubmittedTimestamp(inputs: {
  projectProgress: ProjectProgress[];
}): string | null {
  for (const project of projectCatalog) {
    if (!project.phaseSlugs.includes("19-capstone-projects")) continue;
    const rows = inputs.projectProgress.filter((row) => row.projectId === project.id && row.completed);
    const stamp = rows.map((row) => row.completedAt ?? "").filter(Boolean).sort()[0];
    if (stamp) return stamp;
  }
  return null;
}
