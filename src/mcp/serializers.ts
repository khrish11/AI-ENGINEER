export function publicLessonSummary(lesson: {
  id: string;
  phaseNumber: number;
  phaseSlug: string;
  lessonSlug: string;
  title: string;
  estimatedMinutes: number;
  lessonType: string;
  hasCode: boolean;
  hasQuiz: boolean;
}) {
  return {
    canonicalLessonId: lesson.id,
    phase: lesson.phaseNumber,
    phaseSlug: lesson.phaseSlug,
    lessonSlug: lesson.lessonSlug,
    title: lesson.title,
    estimatedMinutes: lesson.estimatedMinutes,
    lessonType: lesson.lessonType,
    hasCode: lesson.hasCode,
    hasQuiz: lesson.hasQuiz,
  };
}

export function publicProject(project: {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  phaseSlugs: string[];
  skills: string[];
}) {
  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    description: project.description,
    level: project.level,
    phaseSlugs: project.phaseSlugs,
    skills: project.skills,
  };
}

export function safeProgressSummary(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  const blocked = new Set([
    "email",
    "providerId",
    "userId",
    "deviceId",
    "notes",
    "answers",
    "conflicts",
    "evidence",
    "privateSettings",
  ]);
  return Object.fromEntries(Object.entries(input).filter(([key]) => !blocked.has(key)));
}
