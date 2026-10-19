import { describe, it, expect } from "vitest";
import { generateRoadmap } from "@/lib/roadmap/scheduler";
import { orderBacklog, rescheduleRoadmap } from "@/lib/roadmap/rescheduler";
import type { RoadmapSettings } from "@/lib/roadmap/types";

const settings: RoadmapSettings = {
  trackId: "rag",
  availableHoursPerWeek: 10,
  startDate: "2026-01-05",
  targetDate: "2027-06-30",
  studyDays: [1, 3, 5],
  bufferPreference: "none",
  includeOptionalTopics: false,
  bufferWeeks: [],
  manuallyIncluded: [],
  manuallyExcluded: [],
  manualWeekAssignments: {},
};

function build() {
  const result = generateRoadmap({
    trackId: settings.trackId,
    startDate: settings.startDate,
    targetDate: settings.targetDate,
    availableHoursPerWeek: settings.availableHoursPerWeek,
    studyDays: settings.studyDays,
    bufferPreference: settings.bufferPreference,
    completedCanonicalLessonKeys: [],
  });
  return result.plan;
}

describe("rescheduling", () => {
  it("preserves finished weeks exactly and replans only from today forward", () => {
    const plan = build();
    const today = plan.weeks[4].startDate;
    const completedKeys = new Set(
      plan.weeks
        .slice(0, 2)
        .flatMap((week) => week.items.map((item) => item.canonicalLessonKey))
    );

    const result = rescheduleRoadmap({
      plan,
      settings,
      today,
      completedCanonicalLessonKeys: [...completedKeys],
    });

    expect(result.preservedWeeks).toBe(4);
    for (let index = 0; index < 4; index += 1) {
      expect(result.plan.weeks[index]).toEqual(plan.weeks[index]);
    }
    expect(result.plan.weeks.length).toBeGreaterThan(result.preservedWeeks);
    expect(result.summary).toContain("preserved");
  });

  it("moves missed lessons into a prioritised backlog", () => {
    const plan = build();
    const today = plan.weeks[4].startDate;
    const completedKeys = new Set(
      plan.weeks
        .slice(0, 2)
        .flatMap((week) => week.items.map((item) => item.canonicalLessonKey))
    );

    const result = rescheduleRoadmap({
      plan,
      settings,
      today,
      completedCanonicalLessonKeys: [...completedKeys],
    });

    expect(result.backlog.length).toBeGreaterThan(0);
    // Weeks 2 and 3 were not completed, so their items are backlogged.
    const backloggedIds = new Set(result.backlog.map((item) => item.occurrenceId));
    const missed = plan.weeks[2].items.map((item) => item.occurrenceId);
    expect(missed.some((id) => backloggedIds.has(id))).toBe(true);

    const ranks = { core: 0, important: 1, optional: 2, skip: 3 };
    for (let index = 1; index < result.backlog.length; index += 1) {
      expect(ranks[result.backlog[index].importance]).toBeGreaterThanOrEqual(
        ranks[result.backlog[index - 1].importance]
      );
    }
  });

  it("shortens the plan when weekly capacity increases", () => {
    const plan = build();
    const result = rescheduleRoadmap({
      plan,
      settings,
      today: plan.weeks[4].startDate,
      completedCanonicalLessonKeys: [],
      hoursPerWeek: 30,
    });
    expect(result.plan.hoursPerWeek).toBe(30);
    expect(result.plan.weeks.length).toBeLessThan(plan.weeks.length);
    expect(result.movedItems).toBeGreaterThan(0);
  });

  it("extends the projected completion when the deadline moves", () => {
    const plan = build();
    const result = rescheduleRoadmap({
      plan,
      settings,
      today: plan.weeks[4].startDate,
      completedCanonicalLessonKeys: [],
      targetDate: "2028-12-31",
    });
    expect(result.plan.targetDate).toBe("2028-12-31");
    expect(result.previousEndDate).not.toBe(result.projectedEndDate);
  });

  it("drops lessons the learner removed while rescheduling", () => {
    const plan = build();
    const today = plan.weeks[4].startDate;
    const target = plan.weeks[5].items[0]?.occurrenceId;
    expect(target).toBeTruthy();

    const result = rescheduleRoadmap({
      plan,
      settings,
      today,
      completedCanonicalLessonKeys: [],
      droppedOccurrenceIds: [target!],
    });

    const scheduled = result.plan.weeks.flatMap((week) =>
      week.items.map((item) => item.occurrenceId)
    );
    expect(scheduled).not.toContain(target);
    expect(
      result.plan.skipped.some((entry) => entry.occurrenceId === target)
    ).toBe(true);
  });

  it("never rewrites history when nothing changed", () => {
    const plan = build();
    const today = plan.weeks[1].startDate;
    const first = rescheduleRoadmap({
      plan,
      settings,
      today,
      completedCanonicalLessonKeys: [],
    });
    expect(first.preservedWeeks).toBe(1);
    expect(first.plan.weeks[0]).toEqual(plan.weeks[0]);
  });
});

describe("backlog ordering", () => {
  it("ranks prerequisite-blocking work first, then core, important, optional", () => {
    const items = [
      {
        occurrenceId: "a/optional",
        canonicalLessonKey: "a/optional",
        phaseSlug: "a",
        lessonSlug: "optional",
        title: "Optional",
        difficulty: "beginner" as const,
        importance: "optional" as const,
        minutes: 60,
        prerequisites: [],
        projectRelevant: false,
        skillTags: [],
      },
      {
        occurrenceId: "a/core",
        canonicalLessonKey: "a/core",
        phaseSlug: "a",
        lessonSlug: "core",
        title: "Core",
        difficulty: "beginner" as const,
        importance: "core" as const,
        minutes: 60,
        prerequisites: ["a/prereq"],
        projectRelevant: false,
        skillTags: [],
      },
      {
        occurrenceId: "a/important",
        canonicalLessonKey: "a/important",
        phaseSlug: "a",
        lessonSlug: "important",
        title: "Important",
        difficulty: "beginner" as const,
        importance: "important" as const,
        minutes: 60,
        prerequisites: [],
        projectRelevant: false,
        skillTags: [],
      },
    ];
    const ordered = orderBacklog(items);
    expect(ordered[0].occurrenceId).toBe("a/core");
    expect(ordered[1].occurrenceId).toBe("a/important");
    expect(ordered[2].occurrenceId).toBe("a/optional");
  });
});
