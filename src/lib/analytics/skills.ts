import { occurrences } from "@/lib/roadmap/config";
import type { LessonProgress } from "@/lib/progress/db";
import { projectCatalog } from "@/lib/projects/catalog";
import { assessmentCatalog } from "@/lib/assessments/catalog";
import { buildSkillEvidence, weakSkillIds, type AttemptLike } from "@/lib/assessments/weak-skills";
import { computeMasteryEvidence, type MasteryEvidence } from "@/lib/assessments/mastery";

/**
 * §9–§12 — skill evidence comes from real stored mappings only:
 *  - lesson evidence: canonical lesson completion (lessonProgress.lessonId ===
 *    occurrence.canonicalLessonKey), deduped for shared canonical identities;
 *  - assessment evidence: valid attempts touching the skill (Phase 6 scorer);
 *  - project evidence: completed/mastered projects tagged with the skill;
 *  - review evidence: persisted review history (skillId → last reviewed ISO).
 *
 * The mastery model is exactly the documented Phase 6 formula (0.4 / 0.4 / 0.2);
 * `evidenceCoverage` describes how many evidence sources exist and is never
 * called statistical confidence (§11).
 */
export interface SkillEvidenceSummary {
  skillId: string;
  completedLessons: number;
  totalLessons: number;
  validAttempts: number;
  recentAverage: number | null;
  completedProjects: Array<{ projectId: string; projectTitle: string; status: string }>;
  totalProjects: number;
  reviewCount: number;
  lastReviewedAt: string | null;
  mastery: MasteryEvidence;
  evidenceCoverage: "none" | "low" | "medium" | "high";
  weak: boolean;
}

export interface SkillAnalyticsInputs {
  lessonProgress: LessonProgress[];
  attempts: AttemptLike[];
  projectProgress: Array<{ projectId: string; completed: boolean }>;
  reviewHistory?: Map<string, string>;
}

export function skillAnalytics(inputs: SkillAnalyticsInputs): {
  skills: SkillEvidenceSummary[];
  weakSkills: string[];
} {
  const { lessonProgress, attempts, projectProgress, reviewHistory } = inputs;
  const assessmentsById = new Map(
    assessmentCatalog.map((assessment) => [assessment.id, assessment])
  );
  const attemptEvidence = buildSkillEvidence(assessmentsById, attempts);

  // Canonical-deduped strongest lesson status per canonical lesson key.
  const lessonByKey = new Map<string, LessonProgress>();
  for (const row of lessonProgress) {
    const existing = lessonByKey.get(row.lessonId);
    if (!existing || rank(row.status) > rank(existing.status)) {
      lessonByKey.set(row.lessonId, row);
    }
  }

  // Occurrence → skills mapping (real metadata), canonical keys deduped per skill.
  const lessonTotalsBySkill = new Map<string, { completed: number; total: number }>();
  const seenCanonicalBySkill = new Map<string, Set<string>>();
  for (const occurrence of occurrences) {
    for (const skillId of occurrence.skillTags) {
      const seen = seenCanonicalBySkill.get(skillId) ?? new Set<string>();
      if (seen.has(occurrence.canonicalLessonKey)) continue;
      seen.add(occurrence.canonicalLessonKey);
      seenCanonicalBySkill.set(skillId, seen);
      const totals = lessonTotalsBySkill.get(skillId) ?? { completed: 0, total: 0 };
      totals.total += 1;
      const status = lessonByKey.get(occurrence.canonicalLessonKey)?.status;
      if (status === "completed" || status === "mastered") totals.completed += 1;
      lessonTotalsBySkill.set(skillId, totals);
    }
  }
  // Skills that only exist in assessments/projects still get totals.
  for (const skillId of new Set([...attemptEvidence.keys(), ...projectSkillMap.keys()])) {
    if (!lessonTotalsBySkill.has(skillId)) lessonTotalsBySkill.set(skillId, { completed: 0, total: 0 });
  }
  void projectSkillMap;

  // Project evidence per skill (platform catalog × completed project rows).
  const completedByProject = new Map<string, boolean>();
  for (const project of projectCatalog) {
    const rows = projectProgress.filter((row) => row.projectId === project.id);
    const doneRequired = rows.filter((row) => row.completed).length;
    completedByProject.set(
      project.id,
      doneRequired > 0 && doneRequired >= project.milestones.filter((milestone) => milestone.required).length
    );
  }
  const projectEvidenceBySkill = new Map<string, Array<{ projectId: string; projectTitle: string; status: string }>>();
  const projectTotalsBySkill = new Map<string, number>();
  for (const project of projectCatalog) {
    for (const skillId of project.skills) {
      projectTotalsBySkill.set(skillId, (projectTotalsBySkill.get(skillId) ?? 0) + 1);
      if (completedByProject.get(project.id)) {
        const list = projectEvidenceBySkill.get(skillId) ?? [];
        list.push({ projectId: project.id, projectTitle: project.title, status: "completed" });
        projectEvidenceBySkill.set(skillId, list);
      }
    }
  }

  const weak = new Set(weakSkillIds(assessmentsById, attempts));
  const allSkills = new Set<string>([
    ...lessonTotalsBySkill.keys(),
    ...attemptEvidence.keys(),
    ...projectTotalsBySkill.keys(),
  ]);

  const skills: SkillEvidenceSummary[] = [];
  for (const skillId of allSkills) {
    const lessons = lessonTotalsBySkill.get(skillId) ?? { completed: 0, total: 0 };
    const attemptsStats = attemptEvidence.get(skillId);
    const projectList = projectEvidenceBySkill.get(skillId) ?? [];
    const projectTotal = projectTotalsBySkill.get(skillId) ?? 0;
    const recentAverage = attemptsStats?.averagePercentage ?? null;
    const mastery = computeMasteryEvidence(
      skillId,
      { completedLessons: lessons.completed, totalLessons: lessons.total },
      { validAttempts: attemptsStats?.validAttempts ?? 0, recentAverage },
      { completedProjects: projectList.length, totalProjects: projectTotal === 0 ? projectList.length : projectTotal }
    );
    const sources =
      (lessons.completed > 0 ? 1 : 0) +
      ((attemptsStats?.validAttempts ?? 0) > 0 ? 1 : 0) +
      (projectList.length > 0 ? 1 : 0);
    skills.push({
      skillId,
      completedLessons: lessons.completed,
      totalLessons: lessons.total,
      validAttempts: attemptsStats?.validAttempts ?? 0,
      recentAverage,
      completedProjects: projectList,
      totalProjects: projectTotal,
      reviewCount: reviewHistory?.has(skillId) ? 1 : 0,
      lastReviewedAt: reviewHistory?.get(skillId) ?? null,
      mastery,
      evidenceCoverage:
        sources >= 3
          ? "high"
          : sources === 2
            ? "medium"
            : sources === 1
              ? "low"
              : "none",
      weak: weak.has(skillId),
    });
  }

  skills.sort((a, b) => a.skillId.localeCompare(b.skillId));
  return { skills, weakSkills: [...weak].sort() };
}

function rank(status: LessonProgress["status"]): number {
  return { not_started: 0, in_progress: 1, completed: 2, mastered: 3 }[status];
}

/** Kept for typing clarity: project→skill associations come from the catalog. */
const projectSkillMap = new Map<string, string[]>(
  projectCatalog.map((project) => [project.id, project.skills])
);
