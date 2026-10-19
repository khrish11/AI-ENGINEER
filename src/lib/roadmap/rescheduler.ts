import { occurrenceById } from "./config";
import { addDays, weekEnd, weekStart } from "./dates";
import { generateRoadmap } from "./scheduler";
import type {
  OccurrenceMetadata,
  PlanItem,
  RescheduleInput,
  RescheduleResult,
  RoadmapPlan,
  RoadmapWeek,
  ScheduledOccurrence,
  TrackId,
} from "./types";

const IMPORTANCE_RANK = { core: 0, important: 1, optional: 2, skip: 3 } as const;

/**
 * Replans everything from today forward while leaving finished weeks untouched.
 * Completed history is never rebuilt, and missed items are surfaced as a
 * prioritised backlog before they are rescheduled.
 */
export function rescheduleRoadmap(input: RescheduleInput): RescheduleResult {
  const { plan, settings, today } = input;
  const completedKeys = new Set(input.completedCanonicalLessonKeys);
  const hoursPerWeek = input.hoursPerWeek ?? settings.availableHoursPerWeek;
  const targetDate = input.targetDate !== undefined ? input.targetDate : settings.targetDate;
  const studyDays = input.studyDays ?? settings.studyDays;
  const dropped = new Set(input.droppedOccurrenceIds ?? settings.manuallyExcluded);

  const resumeIndex = plan.weeks.findIndex((week) => week.endDate >= today);
  const preservedWeeks = resumeIndex === -1 ? [] : plan.weeks.slice(0, resumeIndex);
  const resumeDate = resumeIndex === -1 ? today : plan.weeks[resumeIndex].startDate;

  const backlog = collectBacklog(preservedWeeks, completedKeys, plan.trackId, dropped);

  const generated = generateRoadmap({
    trackId: plan.trackId,
    startDate: resumeDate,
    targetDate,
    availableHoursPerWeek: hoursPerWeek,
    studyDays,
    bufferPreference: input.bufferPreference ?? settings.bufferPreference,
    manualBufferWeeks: [],
    includeOptionalTopics: settings.includeOptionalTopics,
    completedCanonicalLessonKeys: [...completedKeys],
    manuallyIncluded: settings.manuallyIncluded,
    manuallyExcluded: [...new Set([...settings.manuallyExcluded, ...dropped])],
    manualWeekAssignments: settings.manualWeekAssignments,
  });

  const offset = preservedWeeks.length;
  const remainingWeeks = generated.plan.weeks.map((week) => reindexWeek(week, plan.startDate, offset));
  const weeks = [...preservedWeeks, ...remainingWeeks];

  const droppedSkipped = [...dropped]
    .filter((id) => occurrenceById.has(id))
    .map((id) => ({
      occurrenceId: id,
      importance: (occurrenceById.get(id)?.importance[plan.trackId] ?? "optional") as
        | "core"
        | "important"
        | "optional"
        | "skip",
      reason: "You dropped this lesson while rescheduling.",
    }));

  const skipped = [
    ...plan.skipped.filter((entry) => !droppedSkipped.some((d) => d.occurrenceId === entry.occurrenceId)),
    ...droppedSkipped,
    ...generated.plan.skipped.filter(
      (entry) => !plan.skipped.some((existing) => existing.occurrenceId === entry.occurrenceId)
    ),
  ];

  const completedOccurrenceIds = [
    ...new Set([...plan.completedOccurrenceIds, ...generated.plan.completedOccurrenceIds]),
  ].filter((id) => {
    const occurrence = occurrenceById.get(id);
    return occurrence ? completedKeys.has(occurrence.canonicalLessonKey) : false;
  });

  const newPlan: RoadmapPlan = {
    ...generated.plan,
    startDate: plan.startDate,
    hoursPerWeek,
    targetDate: targetDate ?? null,
    studyDays: [...studyDays].sort((a, b) => a - b),
    weeks,
    bufferWeeks: weeks.filter((week) => week.kind === "buffer").map((week) => week.index),
    skipped,
    completedOccurrenceIds,
  };

  const previousEndDate = plan.weeks[plan.weeks.length - 1]?.endDate ?? null;
  const projectedEndDate = newPlan.weeks[newPlan.weeks.length - 1]?.endDate ?? null;
  const movedItems = new Set(
    remainingWeeks.flatMap((week) => week.items.map((item) => item.occurrenceId))
  ).size;

  return {
    plan: newPlan,
    backlog,
    preservedWeeks: preservedWeeks.length,
    movedItems,
    projectedEndDate,
    previousEndDate,
    summary: rescheduleSummary({
      today,
      preservedWeeks: preservedWeeks.length,
      backlog: backlog.length,
      movedItems,
      previousEndDate,
      projectedEndDate,
    }),
  };
}

function reindexWeek(week: RoadmapWeek, planStart: string, offset: number): RoadmapWeek {
  const index = week.index + offset;
  return {
    ...week,
    index,
    weekNumber: index + 1,
    startDate: weekStart(planStart, index),
    endDate: weekEnd(planStart, index),
    items: week.items.map((item) => ({ ...item })),
  };
}

function collectBacklog(
  preservedWeeks: RoadmapWeek[],
  completedKeys: Set<string>,
  trackId: TrackId,
  dropped: Set<string>
): ScheduledOccurrence[] {
  const seen = new Set<string>();
  const missed: OccurrenceMetadata[] = [];
  for (const week of preservedWeeks) {
    for (const item of week.items) {
      if (completedKeys.has(item.canonicalLessonKey)) continue;
      if (dropped.has(item.occurrenceId)) continue;
      if (seen.has(item.canonicalLessonKey)) continue;
      const occurrence = occurrenceById.get(item.occurrenceId);
      if (!occurrence) continue;
      seen.add(item.canonicalLessonKey);
      missed.push(occurrence);
    }
  }
  return orderBacklog(
    missed.map((occurrence) => toScheduled(occurrence, trackId, dropped)),
    dropped
  );
}

function toScheduled(
  occurrence: OccurrenceMetadata,
  trackId: TrackId,
  _dropped: Set<string>
): ScheduledOccurrence {
  const importance = occurrence.importance[trackId] ?? "optional";
  return {
    occurrenceId: occurrence.occurrenceId,
    canonicalLessonKey: occurrence.canonicalLessonKey,
    phaseSlug: occurrence.phaseSlug,
    lessonSlug: occurrence.lessonSlug,
    title: occurrence.title,
    difficulty: occurrence.difficulty,
    importance,
    minutes: occurrence.estimatedMinutes ?? 0,
    prerequisites: occurrence.prerequisites,
    projectRelevant: occurrence.projectRelevant,
    skillTags: occurrence.skillTags,
  };
}

/** Backlog ordering: prerequisite-blocking core work first, then core, important, optional. */
export function orderBacklog(
  items: ScheduledOccurrence[],
  dropped: Set<string> = new Set()
): ScheduledOccurrence[] {
  const blocking = (item: ScheduledOccurrence) =>
    item.prerequisites.some((prerequisite) => {
      const node = occurrenceById.get(prerequisite);
      return node ? !dropped.has(node.occurrenceId) : false;
    });
  return [...items].sort((a, b) => {
    const aBlocking = blocking(a) ? 0 : 1;
    const bBlocking = blocking(b) ? 0 : 1;
    if (aBlocking !== bBlocking) return aBlocking - bBlocking;
    const rank = IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance];
    if (rank !== 0) return rank;
    return a.occurrenceId.localeCompare(b.occurrenceId);
  });
}

/** Moves an item (and its split parts) to a specific week index. */
export function moveItemToWeek(
  weeks: RoadmapWeek[],
  occurrenceId: string,
  targetIndex: number
): RoadmapWeek[] {
  const target = weeks.find((week) => week.index === targetIndex);
  if (!target || target.kind !== "study") return weeks;
  const natural = weeks.find((week) => week.items.some((item) => item.occurrenceId === occurrenceId));
  if (!natural || natural.index > targetIndex) return weeks;

  const moved = natural.items.filter((item) => item.occurrenceId === occurrenceId);
  const total = moved.reduce((sum, item) => sum + item.minutes, 0);
  const base = moved[0];
  if (!base) return weeks;

  return weeks.map((week) => {
    const items = week.items.filter((item) => item.occurrenceId !== occurrenceId);
    if (week.index === targetIndex) {
      const item: PlanItem = {
        ...base,
        allocatedMinutes: total,
        part: 1,
        totalParts: 1,
        dayOfWeek: items[0]?.dayOfWeek ?? base.dayOfWeek,
      };
      items.push(item);
    }
    return {
      ...week,
      items,
      scheduledMinutes: items.reduce((sum, item) => sum + item.allocatedMinutes, 0),
    };
  });
}

export function extendDeadline(weeks: RoadmapWeek[], extraWeeks: number): RoadmapWeek[] {
  if (extraWeeks <= 0) return weeks;
  const last = weeks[weeks.length - 1];
  if (!last) return weeks;
  const added = Array.from({ length: extraWeeks }, (_, offset) => {
    const index = last.index + 1 + offset;
    return {
      index,
      weekNumber: index + 1,
      startDate: addDays(last.endDate, 1 + offset * 7),
      endDate: addDays(last.endDate, 7 + offset * 7),
      kind: "study" as const,
      capacityMinutes: last.capacityMinutes,
      scheduledMinutes: 0,
      items: [],
      bufferReason: null,
      label: "Extended deadline",
    };
  });
  return [...weeks, ...added];
}

function rescheduleSummary(input: {
  today: string;
  preservedWeeks: number;
  backlog: number;
  movedItems: number;
  previousEndDate: string | null;
  projectedEndDate: string | null;
}): string {
  const parts = [
    `Replanned from ${input.today}.`,
    input.preservedWeeks > 0
      ? `${input.preservedWeeks} finished week${input.preservedWeeks === 1 ? "" : "s"} preserved unchanged.`
      : "No finished weeks to preserve.",
    input.backlog > 0
      ? `${input.backlog} missed lesson${input.backlog === 1 ? "" : "s"} moved into the backlog.`
      : "No missed lessons.",
    `${input.movedItems} lesson${input.movedItems === 1 ? "" : "s"} rescheduled.`,
  ];
  if (input.previousEndDate && input.projectedEndDate) {
    parts.push(
      `Projected completion moved from ${input.previousEndDate} to ${input.projectedEndDate}.`
    );
  }
  return parts.join(" ");
}
