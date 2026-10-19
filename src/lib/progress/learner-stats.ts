import { lessonProgressRepo } from "./repositories/lesson-progress";
import { resourceProgressRepo } from "./repositories/resource-progress";
import { studySessionsRepo } from "./repositories/study-sessions";
import { quizAttemptsRepo } from "./repositories/quiz-attempts";
import { projectProgressRepo } from "./repositories/project-progress";

export interface LearnerStats {
  lessonsStarted: number;
  lessonsCompleted: number;
  lessonsMastered: number;
  resourcesCompleted: number;
  videosWatched: number;
  quizAttempts: number;
  studySessionCount: number;
  totalStudySeconds: number;
  currentStreak: number;
  activeProjects: number;
  reviewQueue: number;
}

export function computeStreak(isoDates: string[], today = new Date()): number {
  const days = new Set(isoDates.filter(Boolean).map((iso) => iso.slice(0, 10)));
  let streak = 0;
  const cursor = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export async function getLearnerStats(): Promise<LearnerStats> {
  const [lessons, resources, sessions, quizzes, projects] = await Promise.all([
    lessonProgressRepo.getAll(),
    resourceProgressRepo.getAll(),
    studySessionsRepo.getAll(),
    quizAttemptsRepo.getAll(),
    projectProgressRepo.getAll(),
  ]);

  const startedLessons = lessons.filter((lesson) => lesson.status !== "not_started");

  return {
    lessonsStarted: startedLessons.length,
    lessonsCompleted: lessons.filter(
      (lesson) => lesson.status === "completed" || lesson.status === "mastered"
    ).length,
    lessonsMastered: lessons.filter((lesson) => lesson.status === "mastered").length,
    resourcesCompleted: resources.filter((resource) => resource.completed).length,
    videosWatched: resources.filter(
      (resource) =>
        resource.completed &&
        (resource.resourceType === "youtube_video" ||
          resource.resourceType === "youtube_playlist")
    ).length,
    quizAttempts: quizzes.length,
    studySessionCount: sessions.length,
    totalStudySeconds: await studySessionsRepo.getTotalDuration(),
    currentStreak: computeStreak([
      ...sessions.map((session) => session.startedAt),
      ...startedLessons.map((lesson) => lesson.updatedAt),
    ]),
    activeProjects: new Set(
      projects.filter((project) => !project.completed).map((project) => project.projectId)
    ).size,
    reviewQueue: lessons.filter((lesson) => lesson.needsReview).length,
  };
}

export function emptyLearnerStats(): LearnerStats {
  return {
    lessonsStarted: 0,
    lessonsCompleted: 0,
    lessonsMastered: 0,
    resourcesCompleted: 0,
    videosWatched: 0,
    quizAttempts: 0,
    studySessionCount: 0,
    totalStudySeconds: 0,
    currentStreak: 0,
    activeProjects: 0,
    reviewQueue: 0,
  };
}
