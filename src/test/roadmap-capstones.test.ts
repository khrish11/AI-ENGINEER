import { describe, expect, it } from "vitest";
import { CAPSTONE_TRACKS, OPTIONAL_CAPSTONE_PRODUCTS, REQUIRED_CAPSTONE_IDS } from "@/lib/roadmap/capstones";
import { generateRoadmap } from "@/lib/roadmap/scheduler";
import { calculateCapstonePreview } from "@/lib/roadmap/capstone-preview";
import { defaultSettings } from "@/lib/roadmap/store";
import { RoadmapSettingsSchema, type CapstoneSelection } from "@/lib/roadmap/types";

const BASE = {
  trackId: "general-ai" as const,
  startDate: "2026-01-05",
  targetDate: null,
  availableHoursPerWeek: 10,
  studyDays: [1, 3, 5],
  bufferPreference: "none" as const,
  includeOptionalTopics: false,
};

const KNOWN = [
  "07-transformers-deep-dive/01-why-transformers",
  "07-transformers-deep-dive/02-self-attention-from-scratch",
  "07-transformers-deep-dive/03-multi-head-attention",
  "07-transformers-deep-dive/04-positional-encoding",
  "07-transformers-deep-dive/05-full-transformer",
  "07-transformers-deep-dive/06-bert-masked-language-modeling",
  "07-transformers-deep-dive/07-gpt-causal-language-modeling",
  "07-transformers-deep-dive/08-t5-bart-encoder-decoder",
  "07-transformers-deep-dive/11-mixture-of-experts",
  "07-transformers-deep-dive/15-attention-variants",
];

function preview(selection: CapstoneSelection, overrides = {}) {
  return calculateCapstonePreview({
    ...defaultSettings(),
    ...BASE,
    knownOccurrenceIds: KNOWN,
    capstoneSelection: selection,
    ...overrides,
  });
}

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

  it("preserves an unknown future selection version without reinterpreting it", () => {
    const parsed = RoadmapSettingsSchema.parse({
      ...defaultSettings(),
      capstoneSelection: { version: 2, futurePolicy: "keep-me" },
    });
    expect(parsed.capstoneSelection).toEqual({ version: 2, futurePolicy: "keep-me" });
    expect(
      capstoneIds(generateRoadmap({ ...BASE, capstoneSelection: parsed.capstoneSelection }))
    ).toHaveLength(85);
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

  it("calculates the accepted core, standalone, and bundle preview scenarios", () => {
    const core = preview({ version: 1, selectedProductIds: [], selectedTrackIds: [] });
    expect(core).toMatchObject({
      totalRoadmapOccurrences: 350,
      totalRoadmapMinutes: 32_595,
      estimatedWeeks: 55,
      directSelectedCapstones: 4,
      requiredCoreSelected: 4,
      optionalSelected: 0,
      availableOptionalCapstones: 81,
      scheduledCapstones: 4,
      additionalPrerequisites: 0,
      additionalPrerequisiteMinutes: 0,
    });

    const standalone = preview({
      version: 1,
      selectedProductIds: ["19-capstone-projects/03-realtime-voice-assistant"],
      selectedTrackIds: [],
    });
    expect(standalone).toMatchObject({
      totalRoadmapOccurrences: 351,
      totalRoadmapMinutes: 34_395,
      estimatedWeeks: 58,
      optionalSelected: 1,
      scheduledCapstones: 5,
      additionalPrerequisites: 0,
    });

    const advancedRag = preview({
      version: 1,
      selectedProductIds: [],
      selectedTrackIds: ["advanced-rag"],
    });
    expect(advancedRag).toMatchObject({
      totalRoadmapOccurrences: 366,
      totalRoadmapMinutes: 34_035,
      estimatedWeeks: 57,
      optionalSelected: 6,
      scheduledCapstones: 20,
      additionalPrerequisites: 10,
      additionalPrerequisiteMinutes: 900,
    });

    const shared = preview({
      version: 1,
      selectedProductIds: [],
      selectedTrackIds: ["advanced-rag", "safety"],
    });
    expect(shared).toMatchObject({
      totalRoadmapOccurrences: 372,
      totalRoadmapMinutes: 34_575,
      estimatedWeeks: 58,
      optionalSelected: 12,
      scheduledCapstones: 26,
      additionalPrerequisites: 10,
      additionalPrerequisiteMinutes: 900,
    });
  });

  it("calculates the exact production core-only plan after the manual Add back", () => {
    const restored = preview(
      { version: 1, selectedProductIds: [], selectedTrackIds: [] },
      { manuallyIncluded: [KNOWN[0]] }
    );

    expect(restored).toMatchObject({
      totalRoadmapOccurrences: 351,
      totalRoadmapMinutes: 32_640,
      estimatedWeeks: 55,
      requiredCoreSelected: 4,
      optionalSelected: 0,
      scheduledCapstones: 4,
      additionalPrerequisites: 0,
      additionalPrerequisiteMinutes: 0,
    });
  });

  it("deduplicates repeated selections and shared prerequisite closure", () => {
    const result = preview({
      version: 1,
      selectedProductIds: [
        "19-capstone-projects/03-realtime-voice-assistant",
        "19-capstone-projects/03-realtime-voice-assistant",
        "invalid-product",
      ],
      selectedTrackIds: ["advanced-rag", "advanced-rag", "safety", "invalid-track"],
    });
    expect(result.selectedStandaloneProducts).toBe(1);
    expect(result.selectedDeepBuildTracks).toBe(2);
    expect(result.optionalSelected).toBe(13);
    expect(result.additionalPrerequisites).toBe(10);
    expect(result.additionalPrerequisiteMinutes).toBe(900);
  });

  it("reports known capstone exclusion and exact manual restoration", () => {
    const knownCapstone = "19-capstone-projects/64-chunking-strategies-advanced";
    const selection = { version: 1 as const, selectedProductIds: [], selectedTrackIds: ["advanced-rag"] };
    const excluded = preview(selection, { knownOccurrenceIds: [...KNOWN, knownCapstone] });
    expect(excluded.knownCapstonesExcluded).toBe(1);
    expect(excluded.optionalSelected).toBe(5);

    const restored = preview(selection, {
      knownOccurrenceIds: [...KNOWN, knownCapstone],
      manuallyIncluded: [knownCapstone],
    });
    expect(restored.knownCapstonesExcluded).toBe(0);
    expect(restored.manuallyRestoredCapstones).toBe(1);
    expect(restored.optionalSelected).toBe(6);
  });

  it("keeps every bundle inside its documented closure", () => {
    const allowedNumbers: Record<string, number[]> = {
      "agent-harness": range(20, 29),
      "nlp-llm": range(30, 41),
      training: [...range(30, 37), ...range(42, 49)],
      research: [...range(20, 29), ...range(50, 57)],
      multimodal: [...range(30, 37), ...range(58, 63)],
      "advanced-rag": [...range(20, 29), ...range(64, 69)],
      evaluation: [...range(30, 41), ...range(70, 75)],
      distributed: [...range(30, 37), ...range(42, 49), ...range(76, 81)],
      safety: [...range(20, 29), ...range(82, 87)],
    };

    for (const track of CAPSTONE_TRACKS) {
      const ids = capstoneIds(
        generateRoadmap({
          ...BASE,
          capstoneSelection: { version: 1, selectedProductIds: [], selectedTrackIds: [track.id] },
        })
      ).filter((id) => !REQUIRED_CAPSTONE_IDS.includes(id as (typeof REQUIRED_CAPSTONE_IDS)[number]));
      const numbers = ids.map((id) => Number(id.split("/")[1].slice(0, 2))).sort((a, b) => a - b);
      expect(numbers, track.id).toEqual(allowedNumbers[track.id]);
    }
  });
});

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}
