import { describe, it, expect } from "vitest";
import { recommendPlacement } from "@/lib/roadmap/placement";
import { generateRoadmap } from "@/lib/roadmap/scheduler";
import type { LearnerProfile, SchedulerInput } from "@/lib/roadmap/types";

const KNOWN_TOPIC_SKILL_IDS = ["transformers", "attention"];
const LATER_PHASE_OCCURRENCE = "07-transformers-deep-dive/01-why-transformers";
const KNOWN_OCCURRENCE_WITH_PREREQUISITE =
  "07-transformers-deep-dive/02-self-attention-from-scratch";
const ADVANCED_UNKNOWN_OCCURRENCE =
  "07-transformers-deep-dive/12-kv-cache-flash-attention";
const ADVANCED_DEPENDENT_OCCURRENCE = "07-transformers-deep-dive/13-scaling-laws";
const TRANSFORMER_CAPSTONE =
  "07-transformers-deep-dive/14-build-a-transformer-capstone";
const UNRELATED_LATER_OCCURRENCE =
  "08-generative-ai/01-generative-models-taxonomy-history";

function beginnerWhoKnowsTransformers(): LearnerProfile {
  return {
    background: "other",
    programming: {
      python: "none",
      javascript: "none",
      git: "none",
      linux: "none",
      sql: "none",
      docker: "none",
    },
    math: {
      "linear-algebra": "weak",
      calculus: "weak",
      probability: "weak",
      statistics: "weak",
    },
    ai: {
      "classical-ml": "none",
      "neural-networks": "none",
      pytorch: "none",
      transformers: "none",
      "llm-applications": "none",
      rag: "none",
      agents: "none",
      deployment: "none",
    },
    knownTopicSkillIds: KNOWN_TOPIC_SKILL_IDS,
    goalTrackId: "general-ai",
    updatedAt: "2026-01-05T00:00:00.000Z",
  };
}

const INPUT: SchedulerInput = {
  trackId: "general-ai",
  startDate: "2026-01-05",
  targetDate: null,
  availableHoursPerWeek: 10,
  studyDays: [1, 3, 5],
  bufferPreference: "none",
  includeOptionalTopics: false,
};

function scheduledIds(input: SchedulerInput): Set<string> {
  const { plan } = generateRoadmap(input);
  return new Set(plan.weeks.flatMap((week) => week.items.map((item) => item.occurrenceId)));
}

describe("declared-known topics beyond the recommended start phase", () => {
  it("excludes covered Phase 7 content for a Phase 0 learner and recalculates duration", () => {
    const profile = beginnerWhoKnowsTransformers();

    const baselineResult = generateRoadmap({ ...INPUT, knownOccurrenceIds: [] });
    const baseline = new Set(
      baselineResult.plan.weeks.flatMap((week) =>
        week.items.map((item) => item.occurrenceId)
      )
    );
    expect(baseline.has(LATER_PHASE_OCCURRENCE)).toBe(true);

    const placement = recommendPlacement(profile);
    expect(placement.recommendedStartPhaseSlug).toBe("00-setup-and-tooling");
    // FIX: Placement now includes later-phase occurrences when explicitly known
    expect(placement.skimOccurrenceIds).toContain(LATER_PHASE_OCCURRENCE);

    const result = generateRoadmap({
      ...INPUT,
      knownOccurrenceIds: placement.skimOccurrenceIds,
    });
    const scheduled = new Set(
      result.plan.weeks.flatMap((week) =>
        week.items.map((item) => item.occurrenceId)
      )
    );
    // FIX: The explicitly known Phase 7 occurrence is now excluded
    expect(scheduled.has(LATER_PHASE_OCCURRENCE)).toBe(false);
    expect(scheduled.has(UNRELATED_LATER_OCCURRENCE)).toBe(true);
    expect(result.plan.skipped).toContainEqual(
      expect.objectContaining({
        occurrenceId: LATER_PHASE_OCCURRENCE,
        reason: "You already know this — kept out of your plan.",
      })
    );
    expect(result.plan.summary.totalMinutes).toBeLessThan(
      baselineResult.plan.summary.totalMinutes
    );
  });

  it("keeps partial and advanced transformer knowledge in the plan", () => {
    const partial = recommendPlacement({
      ...beginnerWhoKnowsTransformers(),
      knownTopicSkillIds: ["transformers"],
    });
    expect(partial.skimOccurrenceIds).not.toContain(LATER_PHASE_OCCURRENCE);

    const placement = recommendPlacement(beginnerWhoKnowsTransformers());
    expect(placement.skimOccurrenceIds).not.toContain(ADVANCED_UNKNOWN_OCCURRENCE);
    expect(placement.skimOccurrenceIds).not.toContain(ADVANCED_DEPENDENT_OCCURRENCE);
    expect(placement.skimOccurrenceIds).not.toContain(TRANSFORMER_CAPSTONE);

    const scheduled = scheduledIds({
      ...INPUT,
      knownOccurrenceIds: placement.skimOccurrenceIds,
    });
    expect(scheduled.has(ADVANCED_UNKNOWN_OCCURRENCE)).toBe(true);
    expect(scheduled.has(ADVANCED_DEPENDENT_OCCURRENCE)).toBe(true);
  });

  it("remains deterministic and allows a manual re-include", () => {
    const profile = beginnerWhoKnowsTransformers();
    const first = recommendPlacement(profile);
    const second = recommendPlacement(profile);
    expect(second.skimOccurrenceIds).toEqual(first.skimOccurrenceIds);

    const excluded = generateRoadmap({
      ...INPUT,
      knownOccurrenceIds: first.skimOccurrenceIds,
    });
    const restored = generateRoadmap({
      ...INPUT,
      knownOccurrenceIds: first.skimOccurrenceIds,
      manuallyIncluded: [LATER_PHASE_OCCURRENCE],
    });
    const manuallyIncluded = new Set(
      restored.plan.weeks.flatMap((week) => week.items.map((item) => item.occurrenceId))
    );
    expect(manuallyIncluded.has(LATER_PHASE_OCCURRENCE)).toBe(true);
    expect([...manuallyIncluded].filter((id) => id === LATER_PHASE_OCCURRENCE)).toHaveLength(1);
    expect(restored.plan.summary.totalMinutes - excluded.plan.summary.totalMinutes).toBe(45);
    expect(restored.plan.skipped).not.toContainEqual(
      expect.objectContaining({ occurrenceId: LATER_PHASE_OCCURRENCE })
    );

    const regenerated = generateRoadmap({
      ...INPUT,
      knownOccurrenceIds: first.skimOccurrenceIds,
      manuallyIncluded: [LATER_PHASE_OCCURRENCE],
    });
    expect(regenerated.plan).toEqual(restored.plan);

    const reversed = scheduledIds({
      ...INPUT,
      knownOccurrenceIds: first.skimOccurrenceIds,
      manuallyIncluded: [],
    });
    expect(reversed.has(LATER_PHASE_OCCURRENCE)).toBe(false);
  });

  it("re-includes one exact occurrence while a known prerequisite remains satisfied", () => {
    const placement = recommendPlacement(beginnerWhoKnowsTransformers());
    const result = generateRoadmap({
      ...INPUT,
      knownOccurrenceIds: placement.skimOccurrenceIds,
      manuallyIncluded: [KNOWN_OCCURRENCE_WITH_PREREQUISITE],
    });
    const scheduled = new Set(
      result.plan.weeks.flatMap((week) => week.items.map((item) => item.occurrenceId))
    );

    expect(scheduled.has(KNOWN_OCCURRENCE_WITH_PREREQUISITE)).toBe(true);
    expect(scheduled.has(LATER_PHASE_OCCURRENCE)).toBe(false);
    expect(
      result.plan.weeks
        .flatMap((week) => week.items)
        .filter((item) => item.occurrenceId === KNOWN_OCCURRENCE_WITH_PREREQUISITE)
        .reduce((sum, item) => sum + item.allocatedMinutes, 0)
    ).toBe(90);
  });

  it("keeps a now-redundant exact override harmless when knowledge selections change", () => {
    const scheduled = scheduledIds({
      ...INPUT,
      knownOccurrenceIds: [],
      manuallyIncluded: [LATER_PHASE_OCCURRENCE],
    });
    expect([...scheduled].filter((id) => id === LATER_PHASE_OCCURRENCE)).toHaveLength(1);
  });

  it("partial knowledge (only transformers, not attention) keeps the occurrence in the plan", () => {
    const partialProfile = {
      ...beginnerWhoKnowsTransformers(),
      knownTopicSkillIds: ["transformers"],
    };
    const placement = recommendPlacement(partialProfile);
    // With only one of the two required skills, the occurrence is not safe to skim
    expect(placement.skimOccurrenceIds).not.toContain(LATER_PHASE_OCCURRENCE);

    const scheduled = scheduledIds({
      ...INPUT,
      knownOccurrenceIds: placement.skimOccurrenceIds,
    });
    expect(scheduled.has(LATER_PHASE_OCCURRENCE)).toBe(true);
  });

  it("advanced topics (beyond explicit knowledge) remain in the plan", () => {
    const placement = recommendPlacement(beginnerWhoKnowsTransformers());
    // Only the explicitly known transformer topics are skimmed
    expect(placement.skimOccurrenceIds).toContain(LATER_PHASE_OCCURRENCE);
    // Advanced transformer topics (not in knownTopicSkillIds) are not skimmed
    expect(placement.skimOccurrenceIds).not.toContain(ADVANCED_UNKNOWN_OCCURRENCE);
    expect(placement.skimOccurrenceIds).not.toContain(ADVANCED_DEPENDENT_OCCURRENCE);
    expect(placement.skimOccurrenceIds).not.toContain(TRANSFORMER_CAPSTONE);

    const scheduled = scheduledIds({
      ...INPUT,
      knownOccurrenceIds: placement.skimOccurrenceIds,
    });
    expect(scheduled.has(ADVANCED_UNKNOWN_OCCURRENCE)).toBe(true);
    expect(scheduled.has(ADVANCED_DEPENDENT_OCCURRENCE)).toBe(true);
    expect(scheduled.has(TRANSFORMER_CAPSTONE)).toBe(true);
  });

  it("regeneration preserves known topic exclusions", () => {
    const profile = beginnerWhoKnowsTransformers();
    const placement = recommendPlacement(profile);
    const firstResult = generateRoadmap({
      ...INPUT,
      knownOccurrenceIds: placement.skimOccurrenceIds,
    });

    // Regenerate with the same known set
    const secondResult = generateRoadmap({
      ...INPUT,
      knownOccurrenceIds: placement.skimOccurrenceIds,
    });

    const firstScheduled = new Set(
      firstResult.plan.weeks.flatMap((week) =>
        week.items.map((item) => item.occurrenceId)
      )
    );
    const secondScheduled = new Set(
      secondResult.plan.weeks.flatMap((week) =>
        week.items.map((item) => item.occurrenceId)
      )
    );

    // Known occurrence is excluded in both generations
    expect(firstScheduled.has(LATER_PHASE_OCCURRENCE)).toBe(false);
    expect(secondScheduled.has(LATER_PHASE_OCCURRENCE)).toBe(false);
    // Unrelated later content remains
    expect(firstScheduled.has(UNRELATED_LATER_OCCURRENCE)).toBe(true);
    expect(secondScheduled.has(UNRELATED_LATER_OCCURRENCE)).toBe(true);
    // Deterministic regeneration
    expect(firstScheduled).toEqual(secondScheduled);
  });

  it("known prerequisites are treated as satisfied and not forced back in", () => {
    const profile = beginnerWhoKnowsTransformers();
    const placement = recommendPlacement(profile);
    const result = generateRoadmap({
      ...INPUT,
      knownOccurrenceIds: placement.skimOccurrenceIds,
    });

    // The known Phase 7 occurrence is excluded
    expect(result.plan.skipped).toContainEqual(
      expect.objectContaining({
        occurrenceId: LATER_PHASE_OCCURRENCE,
        reason: "You already know this — kept out of your plan.",
      })
    );

    // Verify that the known occurrence is not pulled in as a prerequisite
    // by checking that it's not in the scheduled items
    const scheduled = new Set(
      result.plan.weeks.flatMap((week) =>
        week.items.map((item) => item.occurrenceId)
      )
    );
    expect(scheduled.has(LATER_PHASE_OCCURRENCE)).toBe(false);
  });
});
