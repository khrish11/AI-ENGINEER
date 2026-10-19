import { canonicalOccurrences, occurrences, occurrenceById, resolveOccurrencesForHref } from "./config";

export interface ProgressLike {
  lessonId: string;
  lessonHref?: string | null;
  status: "not_started" | "in_progress" | "completed" | "mastered";
  needsReview?: boolean;
}

export interface CompletionSets {
  started: Set<string>;
  completed: Set<string>;
  mastered: Set<string>;
  needsReview: Set<string>;
  unresolved: number;
}

/**
 * Roadmap completion is resolved through the canonical lesson key, so the two
 * Vision Transformer curriculum occurrences share one progress identity while
 * remaining distinct graph nodes.
 */
export function canonicalKeyForProgress(record: ProgressLike): string | null {
  const fromHref = resolveOccurrencesForHref(record.lessonHref);
  if (fromHref.length > 0) {
    return occurrenceById.get(fromHref[0])?.canonicalLessonKey ?? fromHref[0];
  }
  // Older records may store the occurrence as the lessonId when it is a slug.
  const direct = occurrenceById.get(record.lessonId);
  if (direct) return direct.canonicalLessonKey;
  // As a last resort, accept a canonical slug stored directly.
  if (canonicalOccurrences.has(record.lessonId)) return record.lessonId;
  return null;
}

export function completionSets(records: ProgressLike[]): CompletionSets {
  const started = new Set<string>();
  const completed = new Set<string>();
  const mastered = new Set<string>();
  const needsReview = new Set<string>();
  let unresolved = 0;

  for (const record of records) {
    const key = canonicalKeyForProgress(record);
    if (!key) {
      unresolved += 1;
      continue;
    }
    if (record.status !== "not_started") started.add(key);
    if (record.status === "completed" || record.status === "mastered") completed.add(key);
    if (record.status === "mastered") mastered.add(key);
    if (record.needsReview) needsReview.add(key);
  }

  return { started, completed, mastered, needsReview, unresolved };
}

export function occurrencesForCanonical(key: string): string[] {
  return (canonicalOccurrences.get(key) ?? []).map((occurrence) => occurrence.occurrenceId);
}

export function completedOccurrenceIds(completedKeys: Iterable<string>): string[] {
  const result: string[] = [];
  for (const key of completedKeys) {
    for (const occurrence of occurrencesForCanonical(key)) result.push(occurrence);
  }
  return [...new Set(result)];
}

export function progressPercent(completedKeys: Set<string>, totalCanonicalKeys: Set<string>): number {
  if (totalCanonicalKeys.size === 0) return 0;
  let done = 0;
  for (const key of totalCanonicalKeys) if (completedKeys.has(key)) done += 1;
  return Math.round((done / totalCanonicalKeys.size) * 100);
}

export function occurrenceTitles(occurrenceIds: string[]): string[] {
  return occurrenceIds
    .map((id) => occurrenceById.get(id)?.title ?? occurrences.find((o) => o.occurrenceId === id)?.title)
    .filter((title): title is string => Boolean(title));
}
