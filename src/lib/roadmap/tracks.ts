import { occurrences, trackById, tracks } from "./config";
import type { Importance, OccurrenceMetadata, TrackComparison, TrackId } from "./types";

const IMPORTANCE_RANK: Record<Importance, number> = {
  core: 0,
  important: 1,
  optional: 2,
  skip: 3,
};

/**
 * Deduplicates occurrences by canonical lesson so a duplicated curriculum
 * location does not double-count workload. The most important occurrence wins.
 */
export function canonicalTrackOccurrences(
  trackId: TrackId,
  includeOptional = true
): OccurrenceMetadata[] {
  const best = new Map<string, OccurrenceMetadata>();
  for (const occurrence of occurrences) {
    const existing = best.get(occurrence.canonicalLessonKey);
    if (!existing) {
      best.set(occurrence.canonicalLessonKey, occurrence);
      continue;
    }
    const rank = IMPORTANCE_RANK[occurrence.importance[trackId] ?? "skip"];
    const existingRank = IMPORTANCE_RANK[existing.importance[trackId] ?? "skip"];
    if (rank < existingRank) best.set(occurrence.canonicalLessonKey, occurrence);
  }
  return [...best.values()].filter((occurrence) => {
    const importance = occurrence.importance[trackId] ?? "skip";
    if (importance === "skip") return false;
    if (importance === "optional" && !includeOptional) return false;
    return true;
  });
}

export interface TrackStats {
  trackId: TrackId;
  name: string;
  slug: string;
  core: number;
  important: number;
  optional: number;
  skip: number;
  coreHours: number;
  requiredHours: number;
  allHours: number;
  phases: string[];
  majorProjects: string[];
  coverage: number;
}

export function trackStats(trackId: TrackId): TrackStats {
  const track = trackById[trackId];
  const allCanonical = new Map<string, OccurrenceMetadata>();
  for (const occurrence of occurrences) {
    if (!allCanonical.has(occurrence.canonicalLessonKey)) {
      allCanonical.set(occurrence.canonicalLessonKey, occurrence);
    }
  }

  const counts = { core: 0, important: 0, optional: 0, skip: 0 };
  let coreMinutes = 0;
  let requiredMinutes = 0;
  let allMinutes = 0;
  let classifiedCount = 0;
  const phases = new Set<string>();

  for (const occurrence of allCanonical.values()) {
    const importance = occurrence.importance[trackId] ?? "skip";
    counts[importance] += 1;
    if (occurrence.importance[trackId] !== undefined) classifiedCount += 1;
    const minutes = occurrence.estimatedMinutes ?? 0;
    allMinutes += minutes;
    if (importance === "core") coreMinutes += minutes;
    if (importance === "core" || importance === "important") requiredMinutes += minutes;
    if (importance !== "skip") phases.add(occurrence.phaseSlug);
  }

  return {
    trackId,
    name: track.name,
    slug: track.slug,
    core: counts.core,
    important: counts.important,
    optional: counts.optional,
    skip: counts.skip,
    coreHours: Math.round(coreMinutes / 60),
    requiredHours: Math.round(requiredMinutes / 60),
    allHours: Math.round(allMinutes / 60),
    phases: [...phases],
    majorProjects: track.majorProjects,
    // Classification coverage: how much of the curriculum has an explicit
    // track classification at all (independent of whether it is scheduled).
    coverage: Math.round((classifiedCount / Math.max(1, allCanonical.size)) * 100),
  };
}

export function allTrackStats(): TrackStats[] {
  return tracks.map((track) => trackStats(track.id));
}

export function compareTracks(trackA: TrackId, trackB: TrackId): TrackComparison {
  const coreA = new Set(
    canonicalTrackOccurrences(trackA, false)
      .filter((occurrence) => occurrence.importance[trackA] === "core")
      .map((occurrence) => occurrence.canonicalLessonKey)
  );
  const coreB = new Set(
    canonicalTrackOccurrences(trackB, false)
      .filter((occurrence) => occurrence.importance[trackB] === "core")
      .map((occurrence) => occurrence.canonicalLessonKey)
  );

  const shared = [...coreA].filter((key) => coreB.has(key));
  const uniqueA = [...coreA].filter((key) => !coreB.has(key));
  const uniqueB = [...coreB].filter((key) => !coreA.has(key));

  const minutesOf = (keys: string[]) =>
    keys.reduce((sum, key) => {
      const occurrence = occurrences.find((item) => item.canonicalLessonKey === key);
      return sum + (occurrence?.estimatedMinutes ?? 0);
    }, 0);

  const projectsA = new Set(trackById[trackA].majorProjects);
  const projectsB = new Set(trackById[trackB].majorProjects);

  return {
    trackA,
    trackB,
    sharedCoreOccurrenceIds: shared.sort(),
    uniqueCoreA: uniqueA.sort(),
    uniqueCoreB: uniqueB.sort(),
    additionalHoursB: Math.round((minutesOf(uniqueB) - minutesOf(uniqueA)) / 60),
    sharedHours: Math.round(minutesOf(shared) / 60),
    projectDifference: [
      ...[...projectsB].filter((project) => !projectsA.has(project)).map((p) => `Only in B: ${p}`),
      ...[...projectsA].filter((project) => !projectsB.has(project)).map((p) => `Only in A: ${p}`),
    ],
  };
}

export function requiredLessonCount(trackId: TrackId): number {
  return canonicalTrackOccurrences(trackId, false).length;
}
