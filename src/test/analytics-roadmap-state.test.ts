import { describe, it, expect } from "vitest";
import { parseStoredRoadmapPlan } from "@/lib/analytics/sources";
import { paceAnalytics } from "@/lib/analytics/pacing";
import type { RoadmapPlan } from "@/lib/roadmap/types";

/**
 * Regression: /analytics crashed with
 * "Cannot read properties of undefined (reading 'length')" because
 * roadmap_state.state stores a RoadmapStore ({ plan, profile, overrides… })
 * while analytics cast it directly to RoadmapPlan — plan.weeks was undefined.
 */

const week = (index: number) => ({
  index,
  weekNumber: index + 1,
  kind: "study" as const,
  startDate: "2026-09-01",
  endDate: "2026-09-08",
  capacityMinutes: 600,
  scheduledMinutes: 300,
  items: [
    {
      occurrenceId: `occ-${index}`,
      canonicalLessonKey: "00-setup-and-tooling/01-dev-environment",
      phaseSlug: "00-setup-and-tooling",
      lessonSlug: "01-dev-environment",
      title: "Dev environment",
      difficulty: "beginner" as const,
      importance: "core" as const,
      minutes: 30,
      allocatedMinutes: 30,
      part: 1,
      totalParts: 1,
      dayOfWeek: 1,
      prerequisites: [],
      projectRelevant: false,
      skillTags: [],
    },
  ],
});

const plan = (): RoadmapPlan =>
  ({
    version: 1,
    trackId: "rag",
    startDate: "2026-09-01",
    targetDate: "2027-01-01",
    hoursPerWeek: 10,
    studyDays: [1, 3, 5],
    bufferWeeks: [],
    weeks: [week(0)],
    completedOccurrenceIds: [],
    skipped: [],
    summary: {
      totalMinutes: 600,
      scheduledMinutes: 300,
      remainingMinutes: 300,
      totalOccurrences: 1,
      scheduledOccurrences: 1,
      completedOccurrences: 0,
      coreTotal: 1,
      coreCompleted: 0,
      optionalMinutesExcluded: 0,
      skippedOccurrences: 0,
    },
  }) as unknown as RoadmapPlan;

describe("parseStoredRoadmapPlan", () => {
  it("unwraps .plan from a RoadmapStore-shaped state", () => {
    const store = {
      version: 1,
      profile: null,
      settings: null,
      plan: plan(),
      overrides: { included: [], excluded: [], manualWeeks: {}, deferred: [], dropped: [] },
      placement: null,
      history: [],
    };
    const parsed = parseStoredRoadmapPlan(store);
    expect(parsed).not.toBeNull();
    expect(parsed?.weeks).toHaveLength(1);
    expect(() => paceAnalytics(parsed, [], new Date("2026-09-05T00:00:00Z"))).not.toThrow();
  });

  it("accepts a bare RoadmapPlan for backward compatibility", () => {
    const parsed = parseStoredRoadmapPlan(plan());
    expect(parsed?.weeks).toHaveLength(1);
  });

  it("returns null for malformed state instead of crashing", () => {
    expect(parseStoredRoadmapPlan({ version: 1 })).toBeNull();
    expect(parseStoredRoadmapPlan({})).toBeNull();
    expect(parseStoredRoadmapPlan({ plan: null, profile: null })).toBeNull();
    expect(parseStoredRoadmapPlan(null)).toBeNull();
    expect(parseStoredRoadmapPlan("not-an-object")).toBeNull();
    expect(parseStoredRoadmapPlan(undefined)).toBeNull();
  });

  it("paceAnalytics degrades to no_plan instead of throwing", () => {
    const pace = paceAnalytics(parseStoredRoadmapPlan({ version: 1 }), [], new Date());
    expect(pace.status).toBe("no_plan");
  });
});
