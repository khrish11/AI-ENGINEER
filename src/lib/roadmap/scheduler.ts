import {
  formatMinutes,
  occurrenceIndex,
  occurrences,
  phaseOrder,
  trackById,
} from "./config";
import { analyzeCapacity } from "./capacity";
import { weekEnd, weekStart } from "./dates";
import { buildGraph, priorityComparator, topologicalSort, type RoadmapGraph } from "./graph";
import type {
  CapacityAnalysis,
  Importance,
  OccurrenceMetadata,
  PlanItem,
  PlanSummary,
  RoadmapPlan,
  RoadmapWeek,
  SchedulerInput,
  TrackId,
} from "./types";

function im(node: { importance: Partial<Record<TrackId, Importance>> }, trackId: TrackId): Importance {
  return node.importance[trackId] ?? "skip";
}

const IMPORTANCE_RANK: Record<Importance, number> = {
  core: 0,
  important: 1,
  optional: 2,
  skip: 3,
};

export interface SkippedOccurrence {
  occurrenceId: string;
  importance: Importance;
  reason: string;
}

export interface RoadmapSelection {
  items: OccurrenceMetadata[];
  allSelected: OccurrenceMetadata[];
  skipped: SkippedOccurrence[];
  edges: Map<string, string[]>;
  completedCanonicalKeys: Set<string>;
  analysis: CapacityAnalysis;
}

export interface GenerationResult {
  plan: RoadmapPlan;
  analysis: CapacityAnalysis;
  selection: RoadmapSelection;
}

export function generateRoadmap(input: SchedulerInput): GenerationResult {
  const selection = selectOccurrences(input);
  const weeklyMinutes = Math.max(1, Math.round(input.availableHoursPerWeek * 60));
  const weeks = packWeeks(selection.items, selection.edges, input, weeklyMinutes);
  const movedWeeks = applyManualWeekAssignments(
    weeks,
    input.manualWeekAssignments ?? {},
    weeklyMinutes
  );
  const summary = summarizePlan(
    selection.items,
    movedWeeks,
    selection.completedCanonicalKeys,
    input.trackId,
    selection.skipped
  );

  const plan: RoadmapPlan = {
    version: 1,
    trackId: input.trackId,
    startDate: input.startDate,
    targetDate: input.targetDate ?? null,
    hoursPerWeek: input.availableHoursPerWeek,
    studyDays: [...input.studyDays].sort((a, b) => a - b),
    bufferWeeks: movedWeeks
      .filter((week) => week.kind === "buffer")
      .map((week) => week.index),
    weeks: movedWeeks,
    completedOccurrenceIds: selection.allSelected
      .filter((item) => selection.completedCanonicalKeys.has(item.canonicalLessonKey))
      .map((item) => item.occurrenceId),
    skipped: selection.skipped,
    summary,
  };

  return { plan, analysis: selection.analysis, selection };
}

/**
 * Chooses which curriculum occurrences belong in a track plan. Importance is
 * per track; a selected lesson pulls in its unmet prerequisites; duplicate
 * curriculum occurrences collapse to a single scheduled node while both stay in
 * the graph and share progress through their canonical key.
 */
export function selectOccurrences(input: SchedulerInput): RoadmapSelection {
  const track = trackById[input.trackId];
  if (!track) throw new Error(`Unknown track "${input.trackId}"`);

  const completedCanonicalKeys = new Set(input.completedCanonicalLessonKeys ?? []);
  const manuallyIncluded = new Set(input.manuallyIncluded ?? []);
  const manuallyExcluded = new Set(input.manuallyExcluded ?? []);
  const includeOptional = input.includeOptionalTopics ?? false;

  const selected = new Set<string>();
  const skipped: SkippedOccurrence[] = [];

  for (const occurrence of occurrences) {
    if (manuallyExcluded.has(occurrence.occurrenceId)) {
      skipped.push({
        occurrenceId: occurrence.occurrenceId,
        importance: im(occurrence, input.trackId),
        reason: "You excluded this lesson from your plan.",
      });
      continue;
    }
    const importance = im(occurrence, input.trackId);
    const includedByDefault =
      importance === "core" || importance === "important" || (importance === "optional" && includeOptional);
    if (includedByDefault || manuallyIncluded.has(occurrence.occurrenceId)) {
      selected.add(occurrence.occurrenceId);
    }
  }

  // Prerequisite closure: everything a selected lesson needs is included.
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...selected]) {
      const node = occurrences[occurrenceIndex.get(id) ?? -1];
      if (!node) continue;
      for (const prerequisite of node.prerequisites) {
        if (!selected.has(prerequisite) && !manuallyExcluded.has(prerequisite)) {
          selected.add(prerequisite);
          changed = true;
        }
      }
    }
  }

  // Collapse duplicate occurrences of the same canonical lesson.
  const groups = new Map<string, OccurrenceMetadata[]>();
  for (const id of selected) {
    const node = occurrences[occurrenceIndex.get(id) ?? -1];
    if (!node) continue;
    const group = groups.get(node.canonicalLessonKey) ?? [];
    group.push(node);
    groups.set(node.canonicalLessonKey, group);
  }

  const representativeOf = new Map<string, string>();
  const deduped: OccurrenceMetadata[] = [];
  for (const [canonicalKey, group] of groups) {
    const sorted = [...group].sort((a, b) => {
      const rank =
        IMPORTANCE_RANK[im(a, input.trackId)] - IMPORTANCE_RANK[im(b, input.trackId)];
      if (rank !== 0) return rank;
      if (a.isAlias !== b.isAlias) return a.isAlias ? 1 : -1;
      return (occurrenceIndex.get(a.occurrenceId) ?? 0) - (occurrenceIndex.get(b.occurrenceId) ?? 0);
    });
    const chosen = sorted[0];
    deduped.push(chosen);
    for (const duplicate of sorted.slice(1)) {
      representativeOf.set(duplicate.occurrenceId, chosen.occurrenceId);
      skipped.push({
        occurrenceId: duplicate.occurrenceId,
        importance: im(duplicate, input.trackId),
        reason: `Duplicate curriculum location of ${canonicalKey}. Completing either occurrence records the same progress.`,
      });
    }
  }

  const resolve = (id: string): string => representativeOf.get(id) ?? id;

  const itemIds = new Set(deduped.map((item) => item.occurrenceId));
  const edges = new Map<string, string[]>();
  const items: OccurrenceMetadata[] = [];
  for (const item of deduped) {
    const completed = completedCanonicalKeys.has(item.canonicalLessonKey);
    const prerequisites = item.prerequisites
      .map(resolve)
      .filter((id) => id !== item.occurrenceId && itemIds.has(id))
      .filter((id) => {
        const node = occurrences[occurrenceIndex.get(id) ?? -1];
        return node ? !completedCanonicalKeys.has(node.canonicalLessonKey) : false;
      });
    edges.set(item.occurrenceId, [...new Set(prerequisites)]);
    if (!completed) items.push(item);
  }

  const requiredMinutes = items.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);
  const analysis = analyzeCapacity({
    requiredMinutes,
    hoursPerWeek: input.availableHoursPerWeek,
    startDate: input.startDate,
    targetDate: input.targetDate ?? null,
    bufferPreference: input.bufferPreference,
    manualBufferWeeks: input.manualBufferWeeks ?? [],
  });

  return { items, allSelected: deduped, skipped, edges, completedCanonicalKeys, analysis };
}

function subgraph(items: OccurrenceMetadata[], edges: Map<string, string[]>): RoadmapGraph {
  const graph = buildGraph(items);
  for (const [id, prerequisites] of edges) graph.prerequisites.set(id, prerequisites);
  for (const list of graph.dependents.values()) list.length = 0;
  for (const [id, prerequisites] of edges) {
    for (const prerequisite of prerequisites) {
      graph.dependents.get(prerequisite)?.push(id);
    }
  }
  for (const list of graph.dependents.values()) list.sort();
  return graph;
}

export function orderedItems(
  items: OccurrenceMetadata[],
  edges: Map<string, string[]>,
  trackId: TrackId
): OccurrenceMetadata[] {
  const graph = subgraph(items, edges);
  const importanceOf = (id: string) => {
    const node = graph.nodes.get(id);
    return node ? im(node, trackId) : "skip";
  };
  const indexOf = (id: string) => occurrenceIndex.get(id) ?? 0;
  const order = topologicalSort(graph, priorityComparator(graph, importanceOf, indexOf));
  return order.map((id) => graph.nodes.get(id)!).filter(Boolean);
}

interface WeekBuilder extends RoadmapWeek {
  dayRemaining: Map<number, number>;
  dayCursor: number;
}

export function packWeeks(
  items: OccurrenceMetadata[],
  edges: Map<string, string[]>,
  input: SchedulerInput,
  weeklyMinutes: number
): RoadmapWeek[] {
  const ordered = orderedItems(items, edges, input.trackId);
  const studyDays = [...input.studyDays].sort((a, b) => a - b);
  const manualBufferWeeks = new Set(input.manualBufferWeeks ?? []);
  const isBufferWeek = (index: number) =>
    manualBufferWeeks.has(index) ||
    (input.bufferPreference === "monthly" && (index + 1) % 4 === 0);

  const weeks: WeekBuilder[] = [];
  let weekIndex = 0;
  let current: WeekBuilder | null = null;

  const newWeek = (): WeekBuilder => {
    const dayRemaining = new Map<number, number>();
    const base = Math.floor(weeklyMinutes / Math.max(1, studyDays.length));
    let remainder = weeklyMinutes - base * studyDays.length;
    for (const day of studyDays) {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      dayRemaining.set(day, base + extra);
    }
    return {
      index: weekIndex,
      weekNumber: weekIndex + 1,
      startDate: weekStart(input.startDate, weekIndex),
      endDate: weekEnd(input.startDate, weekIndex),
      kind: "study",
      capacityMinutes: weeklyMinutes,
      scheduledMinutes: 0,
      items: [],
      bufferReason: null,
      label: null,
      dayRemaining,
      dayCursor: 0,
    };
  };

  const closeWeek = () => {
    if (current) {
      weeks.push(current);
      current = null;
    }
    weekIndex += 1;
  };

  const ensureWeek = (): WeekBuilder | null => {
    if (current) return current;
    if (isBufferWeek(weekIndex)) {
      weeks.push({
        index: weekIndex,
        weekNumber: weekIndex + 1,
        startDate: weekStart(input.startDate, weekIndex),
        endDate: weekEnd(input.startDate, weekIndex),
        kind: "buffer",
        capacityMinutes: 0,
        scheduledMinutes: 0,
        items: [],
        bufferReason: manualBufferWeeks.has(weekIndex) ? "manual" : "automatic",
        label: "Buffer week",
        dayRemaining: new Map(),
        dayCursor: 0,
      });
      weekIndex += 1;
      return ensureWeek();
    }
    current = newWeek();
    return current;
  };

  for (const item of ordered) {
    const minutes = item.estimatedMinutes ?? 0;
    if (minutes <= 0) continue;
    let remaining = minutes;
    let part = 1;
    // Parts are counted as they are emitted: a lesson that starts in a
    // partially-filled week can be split into more parts than the initial
    // ceil() estimate, so bookkeeping is reconciled after packing.
    const partsForItem: PlanItem[] = [];
    let totalParts = Math.max(1, Math.ceil(minutes / weeklyMinutes));

    while (remaining > 0) {
      const week = ensureWeek();
      if (!week) break;

      if (week.scheduledMinutes >= weeklyMinutes) {
        closeWeek();
        continue;
      }

      const allowance = weeklyMinutes - week.scheduledMinutes;
      const chunk = Math.min(remaining, allowance);

      // Advance to the next study day that still has room, preserving order.
      let day: number | null = null;
      while (week.dayCursor < studyDays.length) {
        const candidate = studyDays[week.dayCursor];
        if ((week.dayRemaining.get(candidate) ?? 0) > 0) {
          day = candidate;
          break;
        }
        week.dayCursor += 1;
      }
      if (day === null) {
        closeWeek();
        continue;
      }

    const planItem: PlanItem = {
      occurrenceId: item.occurrenceId,
      canonicalLessonKey: item.canonicalLessonKey,
      phaseSlug: item.phaseSlug,
      lessonSlug: item.lessonSlug,
      title: item.title,
      difficulty: item.difficulty,
      importance: im(item, input.trackId),
      minutes,
      allocatedMinutes: chunk,
      part,
      totalParts,
      dayOfWeek: day,
      prerequisites: edges.get(item.occurrenceId) ?? [],
      projectRelevant: item.projectRelevant,
      skillTags: item.skillTags,
    };

    week.items.push(planItem);
    partsForItem.push(planItem);
      week.scheduledMinutes += chunk;
      week.dayRemaining.set(day, (week.dayRemaining.get(day) ?? 0) - chunk);
      remaining -= chunk;
      part += 1;

      if ((week.dayRemaining.get(day) ?? 0) <= 0) week.dayCursor += 1;
      if (week.scheduledMinutes >= weeklyMinutes) closeWeek();
    }

    totalParts = partsForItem.length;
    partsForItem.forEach((emitted, index) => {
      emitted.part = index + 1;
      emitted.totalParts = totalParts;
    });
  }

  if (current) weeks.push(current);

  // Always present at least the current week, even for an empty plan.
  if (weeks.length === 0) {
    const week = newWeek();
    weeks.push(week);
  }

  return weeks.map(({ dayRemaining: _dayRemaining, dayCursor: _dayCursor, ...week }) => week);
}

/**
 * Moves a lesson to a later week. Manual moves may not schedule work before its
 * natural position, and may not place mandatory content inside a buffer week.
 */
export function applyManualWeekAssignments(
  weeks: RoadmapWeek[],
  assignments: Record<string, number>,
  weeklyMinutes: number
): RoadmapWeek[] {
  const result = weeks.map((week) => ({ ...week, items: [...week.items] }));
  for (const [occurrenceId, targetIndex] of Object.entries(assignments)) {
    const target = result.find((week) => week.index === targetIndex);
    if (!target || target.kind !== "study") continue;
    const natural = result.find((week) =>
      week.items.some((item) => item.occurrenceId === occurrenceId)
    );
    if (!natural || natural.index > targetIndex) continue;

    const moved = natural.items.filter((item) => item.occurrenceId === occurrenceId);
    if (moved.length === 0) continue;
    const totalMinutes = moved[0].minutes;

    for (const week of result) {
      week.items = week.items.filter((item) => item.occurrenceId !== occurrenceId);
    }
    for (const week of result) {
      week.scheduledMinutes = week.items.reduce((sum, item) => sum + item.allocatedMinutes, 0);
    }

    const day = target.items[0]?.dayOfWeek ?? 0;
    target.items.push({
      ...moved[0],
      allocatedMinutes: totalMinutes,
      part: 1,
      totalParts: 1,
      dayOfWeek: day,
    });
    target.scheduledMinutes = target.items.reduce((sum, item) => sum + item.allocatedMinutes, 0);
  }

  return result;
}

export function summarizePlan(
  items: OccurrenceMetadata[],
  weeks: RoadmapWeek[],
  completedCanonicalKeys: Set<string>,
  trackId: TrackId,
  skipped: SkippedOccurrence[]
): PlanSummary {
  const scheduledMinutes = weeks.reduce((sum, week) => sum + week.scheduledMinutes, 0);
  const completed = items.filter((item) => completedCanonicalKeys.has(item.canonicalLessonKey));
  const completedMinutes = completed.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);
  const totalMinutes = items.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);
  const coreItems = items.filter((item) => im(item, trackId) === "core");
  const coreCompleted = coreItems.filter((item) =>
    completedCanonicalKeys.has(item.canonicalLessonKey)
  );

  const optionalMinutesExcluded = occurrences
    .filter((occurrence) => im(occurrence, trackId) === "optional")
    .filter((occurrence) => !items.some((item) => item.canonicalLessonKey === occurrence.canonicalLessonKey))
    .reduce((sum, occurrence) => sum + (occurrence.estimatedMinutes ?? 0), 0);

  const skippedOccurrences = occurrences.filter(
    (occurrence) => im(occurrence, trackId) === "skip"
  ).length;

  return {
    totalMinutes,
    scheduledMinutes,
    remainingMinutes: Math.max(0, totalMinutes - completedMinutes),
    totalOccurrences: items.length,
    scheduledOccurrences: items.length,
    completedOccurrences: completed.length,
    coreTotal: coreItems.length,
    coreCompleted: coreCompleted.length,
    optionalMinutesExcluded,
    skippedOccurrences,
  };
}

export function planWeekForDate(plan: RoadmapPlan, isoDate: string): RoadmapWeek | null {
  const time = Date.parse(`${isoDate}T00:00:00.000Z`);
  if (!Number.isFinite(time)) return null;
  return (
    plan.weeks.find(
      (week) =>
        Date.parse(`${week.startDate}T00:00:00.000Z`) <= time &&
        time <= Date.parse(`${week.endDate}T00:00:00.000Z`)
    ) ?? null
  );
}

export function currentWeek(plan: RoadmapPlan, today: string): RoadmapWeek | null {
  const byDate = planWeekForDate(plan, today);
  if (byDate) return byDate;
  const upcoming = plan.weeks.find(
    (week) => Date.parse(`${week.startDate}T00:00:00.000Z`) > Date.parse(`${today}T00:00:00.000Z`)
  );
  return upcoming ?? plan.weeks[plan.weeks.length - 1] ?? null;
}

export function nextActionableItem(
  plan: RoadmapPlan,
  completedCanonicalKeys: Set<string>
): PlanItem | null {
  for (const week of plan.weeks) {
    for (const item of week.items) {
      if (!completedCanonicalKeys.has(item.canonicalLessonKey)) return item;
    }
  }
  return null;
}

export function planDurationLabel(minutes: number): string {
  return formatMinutes(minutes);
}

export function phaseLabel(phaseSlug: string): string {
  const index = phaseOrder.indexOf(phaseSlug);
  return index === -1 ? phaseSlug : `Phase ${String(index).padStart(2, "0")}`;
}

export function emptyPlan(trackId: TrackId, startDate: string): RoadmapPlan {
  return {
    version: 1,
    trackId,
    startDate,
    targetDate: null,
    hoursPerWeek: 10,
    studyDays: [1, 3, 5],
    bufferWeeks: [],
    weeks: [],
    completedOccurrenceIds: [],
    skipped: [],
    summary: {
      totalMinutes: 0,
      scheduledMinutes: 0,
      remainingMinutes: 0,
      totalOccurrences: 0,
      scheduledOccurrences: 0,
      completedOccurrences: 0,
      coreTotal: 0,
      coreCompleted: 0,
      optionalMinutesExcluded: 0,
      skippedOccurrences: 0,
    },
  };
}

