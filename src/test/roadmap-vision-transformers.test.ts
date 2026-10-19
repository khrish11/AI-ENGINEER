import { describe, it, expect } from "vitest";
import {
  canonicalOccurrences,
  getOccurrence,
  lessonHrefFor,
  occurrenceById,
  occurrences,
} from "@/lib/roadmap/config";
import { buildGraph, validateGraph } from "@/lib/roadmap/graph";
import { generateRoadmap } from "@/lib/roadmap/scheduler";
import { explainItem } from "@/lib/roadmap/explain";
import { completionSets } from "@/lib/roadmap/progress";

/**
 * The curriculum contains two distinct Vision Transformer lessons. Both must
 * exist independently in the roadmap graph and maintain separate progress
 * identities.
 */
const ALIAS = "04-computer-vision/14-vision-transformers";
const CANONICAL = "07-transformers-deep-dive/09-vision-transformers";

describe("Vision Transformer occurrence identity", () => {
  it("keeps both curriculum occurrences as independent graph nodes", () => {
    const graph = buildGraph();
    expect(graph.nodes.has(ALIAS)).toBe(true);
    expect(graph.nodes.has(CANONICAL)).toBe(true);
    expect(graph.nodes.size).toBe(542);
    expect(validateGraph().ok).toBe(true);
  });

  it("keeps distinct canonical identities with distinct positions", () => {
    const alias = getOccurrence(ALIAS);
    const canonical = getOccurrence(CANONICAL);

    expect(alias.canonicalLessonKey).not.toBe(canonical.canonicalLessonKey);
    expect(alias.occurrenceId).not.toBe(canonical.occurrenceId);
    expect(alias.phaseSlug).toBe("04-computer-vision");
    expect(canonical.phaseSlug).toBe("07-transformers-deep-dive");

    // Ordering is positional: each occurrence depends on its own phase neighbor.
    expect(alias.prerequisites).toEqual(["04-computer-vision/13-3d-vision-nerf"]);
    expect(canonical.prerequisites).not.toEqual(alias.prerequisites);
    expect(canonical.prerequisites).toHaveLength(1);

    expect(occurrenceById.get(ALIAS)).toBe(alias);
    expect(occurrenceById.get(CANONICAL)).toBe(canonical);
    expect(canonicalOccurrences.get(CANONICAL)).toHaveLength(1);
    expect(canonicalOccurrences.get(ALIAS)).toHaveLength(1);
    expect(occurrences.filter((entry) => entry.isAlias)).toHaveLength(0);
  });

  it("schedules both distinct lessons independently", () => {
    const plan = generateRoadmap({
      trackId: "rag",
      startDate: "2026-01-05",
      targetDate: null,
      availableHoursPerWeek: 10,
      studyDays: [1, 3, 5],
      bufferPreference: "none",
      includeOptionalTopics: true,
    }).plan;

    const scheduledItems = plan.weeks.flatMap((week) => week.items);
    const scheduledOccurrences = new Set(
      scheduledItems.map((item) => item.occurrenceId)
    );

    const scheduledPair = [ALIAS, CANONICAL].filter((id) => scheduledOccurrences.has(id));
    expect(scheduledPair).toHaveLength(2);

    // Long lessons legitimately split into parts across weeks, but every part
    // must reference the same occurrence.
    const occurrencesByKey = new Map<string, Set<string>>();
    for (const item of scheduledItems) {
      const ids = occurrencesByKey.get(item.canonicalLessonKey) ?? new Set<string>();
      ids.add(item.occurrenceId);
      occurrencesByKey.set(item.canonicalLessonKey, ids);
    }
    for (const ids of occurrencesByKey.values()) {
      expect(ids.size).toBe(1);
    }

    // Every scheduled part carries a canonical progress identity and a part
    // number consistent with the splitting rules.
    expect(scheduledItems.every((item) => typeof item.canonicalLessonKey === "string")).toBe(
      true
    );
    expect(
      scheduledItems.every((item) => item.part <= item.totalParts && item.part >= 1)
    ).toBe(true);
  });

  it("keeps completion progress separate", () => {
    const viaAlias = completionSets([
      { lessonId: "p1", lessonHref: `/curriculum/${ALIAS}`, status: "completed" },
    ]);
    const viaCanonical = completionSets([
      { lessonId: "p2", lessonHref: `/curriculum/${CANONICAL}`, status: "completed" },
    ]);
    expect([...viaAlias.completed]).toEqual([ALIAS]);
    expect([...viaCanonical.completed]).toEqual([CANONICAL]);

    const plan = generateRoadmap({
      trackId: "rag",
      startDate: "2026-01-05",
      targetDate: null,
      availableHoursPerWeek: 10,
      studyDays: [1, 3, 5],
      bufferPreference: "none",
      includeOptionalTopics: true,
      completedCanonicalLessonKeys: [...viaAlias.completed],
    }).plan;

    const scheduledKeys = new Set(
      plan.weeks.flatMap((week) => week.items.map((item) => item.canonicalLessonKey))
    );
    expect(scheduledKeys.has(ALIAS)).toBe(false);
    expect(plan.completedOccurrenceIds).toContain(ALIAS);
  });

  it("explains both occurrences independently", () => {
    const aliasExplanation = explainItem(ALIAS, "general-ai");
    const canonicalExplanation = explainItem(CANONICAL, "general-ai");
    expect(aliasExplanation.reasons.length).toBeGreaterThan(0);
    expect(canonicalExplanation.reasons.length).toBeGreaterThan(0);
    expect(lessonHrefFor(getOccurrence(ALIAS))).toBe(`/curriculum/${ALIAS}`);
    expect(lessonHrefFor(getOccurrence(CANONICAL))).toBe(`/curriculum/${CANONICAL}`);
  });
});
