import { describe, expect, it } from "vitest";
import { CAPSTONE_TRACKS, OPTIONAL_CAPSTONE_PRODUCTS, REQUIRED_CAPSTONE_IDS } from "@/lib/roadmap/capstones";
import { generateRoadmap } from "@/lib/roadmap/scheduler";
import { RoadmapSettingsSchema } from "@/lib/roadmap/types";

const BASE = {
  trackId: "general-ai" as const,
  startDate: "2026-01-05",
  targetDate: null,
  availableHoursPerWeek: 10,
  studyDays: [1, 3, 5],
  bufferPreference: "none" as const,
  includeOptionalTopics: false,
};

function capstoneIds(result: ReturnType<typeof generateRoadmap>): string[] {
  return result.selection.allSelected
    .filter((item) => item.phaseSlug === "19-capstone-projects")
    .map((item) => item.occurrenceId);
}

describe("versioned capstone planning", () => {
  it("keeps legacy settings on the V1 all-important capstone behavior", () => {
    expect(capstoneIds(generateRoadmap(BASE))).toHaveLength(85);
    expect(
      RoadmapSettingsSchema.parse({
        ...BASE,
        bufferWeeks: [],
        manuallyIncluded: [],
        manuallyExcluded: [],
        manualWeekAssignments: {},
        knownOccurrenceIds: [],
      }).capstoneSelection
    ).toBeUndefined();
  });

  it("uses the four required products for a new core-only plan", () => {
    const result = generateRoadmap({
      ...BASE,
      capstoneSelection: { version: 1, selectedProductIds: [], selectedTrackIds: [] },
    });
    expect(capstoneIds(result).sort()).toEqual([...REQUIRED_CAPSTONE_IDS].sort());
  });

  it("adds an optional product without adding unrelated products", () => {
    const product = OPTIONAL_CAPSTONE_PRODUCTS[0];
    const ids = capstoneIds(
      generateRoadmap({
        ...BASE,
        capstoneSelection: {
          version: 1,
          selectedProductIds: [product.occurrenceId],
          selectedTrackIds: [],
        },
      })
    );
    expect(ids).toContain(product.occurrenceId);
    expect(ids).toHaveLength(5);
  });

  it("adds a complete deep-build track and its documented prerequisite closure", () => {
    const track = CAPSTONE_TRACKS.find((item) => item.id === "advanced-rag")!;
    const ids = new Set(
      capstoneIds(
        generateRoadmap({
          ...BASE,
          capstoneSelection: {
            version: 1,
            selectedProductIds: [],
            selectedTrackIds: [track.id],
          },
        })
      )
    );
    track.occurrenceIds.forEach((id) => expect(ids.has(id)).toBe(true));
    expect(ids.has("19-capstone-projects/29-end-to-end-coding-task-demo")).toBe(true);
    expect(ids.has("19-capstone-projects/70-task-spec-format")).toBe(false);
  });

  it("preserves manual inclusion and exclusion overrides", () => {
    const optional = OPTIONAL_CAPSTONE_PRODUCTS[0].occurrenceId;
    const result = generateRoadmap({
      ...BASE,
      capstoneSelection: { version: 1, selectedProductIds: [], selectedTrackIds: [] },
      manuallyIncluded: [optional],
      manuallyExcluded: [REQUIRED_CAPSTONE_IDS[0]],
    });
    const ids = capstoneIds(result);
    expect(ids).toContain(optional);
    expect(ids).not.toContain(REQUIRED_CAPSTONE_IDS[0]);
  });
});
