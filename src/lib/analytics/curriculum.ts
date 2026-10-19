import { occurrences } from "@/lib/roadmap/config";
import type { LessonProgress } from "@/lib/progress/db";

/**
 * §6 — curriculum progress uses CANONICAL identities for learner totals and
 * curriculum OCCURRENCES for per-phase display.
 *
 * The curriculum has 542 occurrences but 541 canonical identities: the two
 * Vision-Transformer lessons share one canonical identity and must never be
 * double-counted in completion totals. canonicalOccurrences (Phase 5 config)
 * maps every occurrenceId to its canonical lesson key; most are 1:1.
 */
export interface CurriculumProgress {
  /** Canonical identities with at least one occurrence completed/mastered (deduped). */
  canonicalCompleted: number;
  canonicalMastered: number;
  canonicalTotal: number;
  occurrencesCompleted: number;
  phasesInProgress: number;
  byPhase: Array<{
    phaseSlug: string;
    occurrences: number;
    completed: number;
    mastered: number;
  }>;
}

export function curriculumProgress(lessons: LessonProgress[], inPeriodFn: (lesson: LessonProgress) => boolean = () => true): CurriculumProgress {
  const byCanonical = new Map<string, LessonProgress>();
  const rows = lessons.filter(inPeriodFn);
  for (const row of rows) {
    // A lessonId (canonical progress key) may be reached through multiple
    // occurrences; keep the strongest status per canonical identity.
    const existing = byCanonical.get(row.lessonId);
    if (!existing || rank(row.status) > rank(existing.status)) {
      byCanonical.set(row.lessonId, row);
    }
  }

  const occurrenceStatus = new Map<string, LessonProgress["status"]>();
  for (const occurrence of occurrences) {
    const row = byCanonical.get(occurrence.canonicalLessonKey);
    if (row) occurrenceStatus.set(occurrence.occurrenceId, row.status);
  }

  const byPhase = new Map<string, { phaseSlug: string; occurrences: number; completed: number; mastered: number }>();
  for (const occurrence of occurrences) {
    const phase = byPhase.get(occurrence.phaseSlug) ?? {
      phaseSlug: occurrence.phaseSlug,
      occurrences: 0,
      completed: 0,
      mastered: 0,
    };
    phase.occurrences += 1;
    const status = occurrenceStatus.get(occurrence.occurrenceId);
    if (status === "completed" || status === "mastered") phase.completed += 1;
    if (status === "mastered") phase.mastered += 1;
    byPhase.set(occurrence.phaseSlug, phase);
  }

  const completed = [...byCanonical.values()].filter(
    (row) => row.status === "completed" || row.status === "mastered"
  );

  return {
    canonicalCompleted: completed.length,
    canonicalMastered: [...byCanonical.values()].filter((row) => row.status === "mastered").length,
    canonicalTotal: new Set(occurrences.map((occurrence) => occurrence.canonicalLessonKey)).size,
    occurrencesCompleted: [...occurrenceStatus.values()].filter(
      (status) => status === "completed" || status === "mastered"
    ).length,
    phasesInProgress: [...byPhase.values()].filter(
      (phase) => phase.completed > 0 && phase.completed < phase.occurrences
    ).length,
    byPhase: [...byPhase.values()].sort((a, b) => a.phaseSlug.localeCompare(b.phaseSlug)),
  };
}

function rank(status: LessonProgress["status"]): number {
  return { not_started: 0, in_progress: 1, completed: 2, mastered: 3 }[status];
}
