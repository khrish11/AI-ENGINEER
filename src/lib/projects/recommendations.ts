import type { ProjectDefinition } from "./schema";
import { PROJECT_LEVELS_ORDER } from "./catalog";
import { getProjectsForTrack } from "./catalog";

/** §19 — recommended projects for a track, deterministic ordering. */
export function recommendProjectsForTrack(
  trackId: string,
  limit = 6
): ProjectDefinition[] {
  return getProjectsForTrack(trackId).slice(0, limit);
}

/**
 * §18 — integrate scheduled project work into a Phase 5 week plan.
 * Pure function: consumes the existing scheduler output (weeks with allocated
 * minutes) and spreads each project's remaining milestone effort across weeks
 * without exceeding remaining capacity (does not duplicate scheduler logic).
 */
export interface PlanWeekLike {
  weekNumber: number;
  capacityMinutes: number;
  allocatedMinutes: number;
}

export interface ProjectWorkLike {
  projectId: string;
  projectSlug: string;
  projectTitle: string;
  remainingMinutes: number;
}

export interface ProjectWeekAssignment {
  projectId: string;
  weekNumber: number;
  minutes: number;
}

export const PROJECT_SHARE_OF_CAPACITY = 0.25;

export function integrateProjectWork(
  weeks: PlanWeekLike[],
  projects: ProjectWorkLike[]
): ProjectWeekAssignment[] {
  const assignments: ProjectWeekAssignment[] = [];
  if (weeks.length === 0) return assignments;
  let weekIndex = 0;
  for (const project of projects) {
    let remaining = Math.max(0, Math.round(project.remainingMinutes));
    let guard = 0;
    while (remaining > 0 && weekIndex < weeks.length && guard < weeks.length * 4) {
      guard += 1;
      const week = weeks[weekIndex % weeks.length];
      const used = week.allocatedMinutes +
        assignments
          .filter((a) => a.weekNumber === week.weekNumber)
          .reduce((sum, a) => sum + a.minutes, 0);
      const budget = Math.floor(week.capacityMinutes * PROJECT_SHARE_OF_CAPACITY);
      const slot = Math.max(0, Math.min(budget - used, Math.min(remaining, 240), week.capacityMinutes - used));
      if (slot > 0) {
        assignments.push({
          projectId: project.projectId,
          weekNumber: week.weekNumber,
          minutes: slot,
        });
        remaining -= slot;
      }
      // Advance: if this week is saturated for project share, move on; else stay if budget remains.
      const nextUsed = used - (slot > 0 ? 0 : 0);
      const remainingBudget = Math.floor(week.capacityMinutes * PROJECT_SHARE_OF_CAPACITY) - nextUsed;
      if (remainingBudget <= 0) weekIndex += 1;
    }
  }
  return assignments;
}

/** Ordering helper shared by catalog + studio: level asc, then effort asc. */
export function projectSortKey(project: ProjectDefinition): [number, number] {
  return [PROJECT_LEVELS_ORDER.indexOf(project.level), project.estimatedHours];
}
