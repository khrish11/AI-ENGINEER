import { describe, it, expect } from "vitest";
import { generateRoadmap, packWeeks, currentWeek, nextActionableItem } from "@/lib/roadmap/scheduler";
import { analyzeCapacity, bufferWeekIndexes } from "@/lib/roadmap/capacity";
import { occurrenceById, occurrences } from "@/lib/roadmap/config";
import type { OccurrenceMetadata, SchedulerInput, TrackId, Importance } from "@/lib/roadmap/types";

const BASE_INPUT: SchedulerInput = {
  trackId: "rag",
  startDate: "2026-01-05",
  targetDate: null,
  availableHoursPerWeek: 10,
  studyDays: [1, 3, 5],
  bufferPreference: "none",
  includeOptionalTopics: false,
};

const IMPORTANCE: Record<TrackId, Importance> = {
  "general-ai": "core",
  "llm-app": "core",
  rag: "core",
  agent: "core",
  ml: "core",
  mlops: "core",
  research: "core",
};

function item(id: string, minutes: number): OccurrenceMetadata {
  const [phaseSlug = "00-setup-and-tooling", lessonSlug = id] = id.split("/");
  return {
    occurrenceId: id,
    canonicalLessonKey: id,
    phaseSlug,
    lessonSlug,
    title: lessonSlug,
    difficulty: "beginner",
    estimatedMinutes: minutes,
    estimateSource: "upstream",
    skillTags: [],
    projectRelevant: false,
    importance: { ...IMPORTANCE },
    prerequisites: [],
    recommendedBefore: [],
    isAlias: false,
  };
}

describe("capacity analysis", () => {
  it("classifies feasibility against a deadline", () => {
    const base = {
      hoursPerWeek: 10,
      startDate: "2026-01-05",
      bufferPreference: "none" as const,
    };
    const comfortable = analyzeCapacity({ ...base, requiredMinutes: 1000, targetDate: "2027-01-05" });
    expect(comfortable.feasibility).toBe("comfortable");

    const exact = analyzeCapacity({ ...base, requiredMinutes: 600 * 10, targetDate: "2026-03-16" });
    expect(exact.feasibility).toBe("achievable");

    const short = analyzeCapacity({ ...base, requiredMinutes: 600 * 40, targetDate: "2026-03-16" });
    expect(short.feasibility).toBe("unrealistic");
    expect(short.shortfallMinutes).toBeGreaterThan(0);
    expect(short.options.length).toBeGreaterThan(0);
  });

  it("absorbs buffer weeks when no deadline is set", () => {
    const analysis = analyzeCapacity({
      requiredMinutes: 600 * 8,
      hoursPerWeek: 10,
      startDate: "2026-01-05",
      targetDate: null,
      bufferPreference: "monthly",
    });
    expect(analysis.feasibility === "achievable" || analysis.feasibility === "comfortable").toBe(true);
    expect(analysis.availableMinutes).toBeGreaterThanOrEqual(analysis.requiredMinutes);
  });

  it("places monthly buffer weeks every fourth week", () => {
    expect(bufferWeekIndexes(12, "monthly")).toEqual([3, 7, 11]);
    expect(bufferWeekIndexes(12, "none")).toEqual([]);
    expect(bufferWeekIndexes(6, "none", [1])).toEqual([1]);
  });
});

describe("week packing", () => {
  it("never overfills a week beyond its capacity", () => {
    const items = [
      item("a/one", 200),
      item("a/two", 200),
      item("a/three", 200),
      item("a/four", 200),
      item("a/five", 200),
    ];
    const edges = new Map(items.map((entry) => [entry.occurrenceId, [] as string[]]));
    const weeks = packWeeks(items, edges, BASE_INPUT, 600);
    for (const week of weeks) {
      expect(week.scheduledMinutes).toBeLessThanOrEqual(600);
    }
    expect(weeks.reduce((sum, week) => sum + week.scheduledMinutes, 0)).toBe(1000);
  });

  it("splits a lesson larger than weekly capacity across consecutive weeks", () => {
    const items = [item("a/huge", 1500)];
    const edges = new Map([[items[0].occurrenceId, [] as string[]]]);
    const weeks = packWeeks(items, edges, BASE_INPUT, 600);
    expect(weeks).toHaveLength(3);
    expect(weeks[0].items[0].totalParts).toBe(3);
    expect(weeks[0].items[0].part).toBe(1);
    expect(weeks[2].items[0].part).toBe(3);
    expect(weeks.reduce((sum, week) => sum + week.scheduledMinutes, 0)).toBe(1500);
  });

  it("keeps prerequisite work in the same or an earlier week and day", () => {
    const items = [item("a/one", 120), item("a/two", 120), item("a/three", 120)];
    const edges = new Map<string, string[]>([
      ["a/two", ["a/one"]],
      ["a/three", ["a/two"]],
    ]);
    const weeks = packWeeks(items, edges, { ...BASE_INPUT, studyDays: [1, 3, 5] }, 600);
    const locate = (id: string) => {
      for (const week of weeks) {
        const found = week.items.find((entry) => entry.occurrenceId === id);
        if (found) return { weekIndex: week.index, day: found.dayOfWeek };
      }
      return null;
    };
    const one = locate("a/one");
    const two = locate("a/two");
    const three = locate("a/three");
    expect(one && two && three).toBeTruthy();
    const position = (value: { weekIndex: number; day: number }) =>
      value.weekIndex * 7 + value.day;
    expect(position(one!)).toBeLessThanOrEqual(position(two!));
    expect(position(two!)).toBeLessThanOrEqual(position(three!));
    // Within a day, items keep their topological order.
    const flat = weeks.flatMap((week) => week.items.map((entry) => entry.occurrenceId));
    expect(flat.indexOf("a/one")).toBeLessThan(flat.indexOf("a/two"));
    expect(flat.indexOf("a/two")).toBeLessThan(flat.indexOf("a/three"));
  });

  it("keeps buffer weeks free of mandatory content", () => {
    const items = [item("a/one", 600), item("a/two", 600), item("a/three", 600), item("a/four", 600)];
    const edges = new Map(items.map((entry) => [entry.occurrenceId, [] as string[]]));
    const weeks = packWeeks(items, edges, { ...BASE_INPUT, bufferPreference: "monthly" }, 600);
    const bufferWeeks = weeks.filter((week) => week.kind === "buffer");
    expect(bufferWeeks.length).toBeGreaterThan(0);
    for (const week of bufferWeeks) {
      expect(week.items).toHaveLength(0);
      expect(week.scheduledMinutes).toBe(0);
    }
    // Content flows around buffer weeks rather than into them.
    const studyWeeks = weeks.filter((week) => week.kind === "study");
    expect(studyWeeks.every((week) => week.scheduledMinutes > 0)).toBe(true);
  });
});

describe("roadmap generation", () => {
  it("is deterministic for identical inputs", () => {
    const first = generateRoadmap(BASE_INPUT);
    const second = generateRoadmap(BASE_INPUT);
    expect(JSON.stringify(first.plan)).toBe(JSON.stringify(second.plan));
    expect(first.analysis.feasibility).toBe(second.analysis.feasibility);
  });

  it("generates the full curriculum plan in under 500ms", () => {
    const started = performance.now();
    const result = generateRoadmap({ ...BASE_INPUT, includeOptionalTopics: true });
    const elapsed = performance.now() - started;
    expect(result.plan.weeks.length).toBeGreaterThan(10);
    expect(elapsed).toBeLessThan(500);
  });

  it("excludes optional content unless requested", () => {
    const withoutOptional = generateRoadmap(BASE_INPUT);
    const withOptional = generateRoadmap({ ...BASE_INPUT, includeOptionalTopics: true });
    expect(withOptional.plan.summary.totalOccurrences).toBeGreaterThan(
      withoutOptional.plan.summary.totalOccurrences
    );
    expect(withoutOptional.plan.summary.optionalMinutesExcluded).toBeGreaterThan(0);
  });

  it("excludes completed lessons from the schedule but reports them", () => {
    const all = generateRoadmap(BASE_INPUT);
    const completedKey = all.plan.weeks[0].items[0].canonicalLessonKey;
    const withCompleted = generateRoadmap({
      ...BASE_INPUT,
      completedCanonicalLessonKeys: [completedKey],
    });
    expect(withCompleted.plan.completedOccurrenceIds.length).toBeGreaterThan(0);
    const scheduledKeys = withCompleted.plan.weeks.flatMap((week) =>
      week.items.map((entry) => entry.canonicalLessonKey)
    );
    expect(scheduledKeys).not.toContain(completedKey);
    expect(withCompleted.plan.summary.totalMinutes).toBeLessThan(all.plan.summary.totalMinutes);
  });

  it("orders every scheduled lesson after its selected prerequisites", () => {
    const result = generateRoadmap(BASE_INPUT);
    const position = new Map<string, number>();
    for (const week of result.plan.weeks) {
      for (const item of week.items) {
        if (!position.has(item.occurrenceId)) position.set(item.occurrenceId, week.index);
      }
    }
    for (const occurrenceId of position.keys()) {
      const occurrence = occurrenceById.get(occurrenceId);
      if (!occurrence) continue;
      for (const prerequisite of occurrence.prerequisites) {
        if (!position.has(prerequisite)) continue;
        expect(position.get(prerequisite)!).toBeLessThanOrEqual(position.get(occurrenceId)!);
      }
    }
  });

  it("does not schedule one canonical occurrence through multiple nodes", () => {
    const result = generateRoadmap({ ...BASE_INPUT, includeOptionalTopics: true });
    const items = result.plan.weeks.flatMap((week) => week.items);
    const occurrenceIdByCanonical = new Map<string, string>();
    for (const entry of items) {
      const known = occurrenceIdByCanonical.get(entry.canonicalLessonKey);
      if (known) {
        expect(known).toBe(entry.occurrenceId);
      } else {
        occurrenceIdByCanonical.set(entry.canonicalLessonKey, entry.occurrenceId);
      }
    }
    expect(occurrenceIdByCanonical.size).toBeGreaterThan(100);
    expect(
      items.some((entry) => entry.occurrenceId === "04-computer-vision/14-vision-transformers")
    ).toBe(true);
  });

  it("respects manual inclusions and exclusions", () => {
    const excludedId = "00-setup-and-tooling/02-git-and-collaboration";
    const withExclusion = generateRoadmap({ ...BASE_INPUT, manuallyExcluded: [excludedId] });
    const scheduled = withExclusion.plan.weeks.flatMap((week) =>
      week.items.map((entry) => entry.occurrenceId)
    );
    expect(scheduled).not.toContain(excludedId);
    expect(
      withExclusion.plan.skipped.some((entry) => entry.occurrenceId === excludedId)
    ).toBe(true);

    const includedId = "06-speech-and-audio/01-audio-fundamentals"; // skipped for rag
    const withInclusion = generateRoadmap({ ...BASE_INPUT, manuallyIncluded: [includedId] });
    const scheduledWithInclusion = withInclusion.plan.weeks.flatMap((week) =>
      week.items.map((entry) => entry.occurrenceId)
    );
    expect(scheduledWithInclusion).toContain(includedId);
  });

  it("creates a current week and a next action for the learner", () => {
    const result = generateRoadmap(BASE_INPUT);
    const week = currentWeek(result.plan, "2026-01-10");
    expect(week).not.toBeNull();
    const next = nextActionableItem(result.plan, new Set());
    expect(next).not.toBeNull();
    expect(next?.minutes).toBeGreaterThan(0);
  });

  it("fills weeks up to the configured study-day capacity", () => {
    const result = generateRoadmap({
      ...BASE_INPUT,
      availableHoursPerWeek: 6,
      studyDays: [1, 3],
      bufferPreference: "none",
    });
    for (const week of result.plan.weeks) {
      expect(week.scheduledMinutes).toBeLessThanOrEqual(week.capacityMinutes);
    }
    expect(result.plan.hoursPerWeek).toBe(6);
    expect(result.plan.studyDays).toEqual([1, 3]);
    const daysUsed = new Set(
      result.plan.weeks.flatMap((week) => week.items.map((entry) => entry.dayOfWeek))
    );
    expect([...daysUsed].sort()).toEqual([1, 3]);
  });

  it("counts canonical occurrences rather than duplicate locations", () => {
    const result = generateRoadmap({ ...BASE_INPUT, includeOptionalTopics: true });
    const items = result.plan.weeks.flatMap((week) => week.items);
    const occurrenceIdByCanonical = new Map<string, string>();
    for (const entry of items) {
      const known = occurrenceIdByCanonical.get(entry.canonicalLessonKey);
      if (known) expect(known).toBe(entry.occurrenceId);
      else occurrenceIdByCanonical.set(entry.canonicalLessonKey, entry.occurrenceId);
    }
    // Lessons may repeat across weeks as split parts, but never as a second
    // curriculum occurrence of the same canonical identity.
    expect(occurrenceIdByCanonical.size).toBeGreaterThanOrEqual(400);
    expect(occurrences.filter((entry) => entry.isAlias)).toHaveLength(0);
  });
});
