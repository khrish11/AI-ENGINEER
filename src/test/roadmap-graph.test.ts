import { describe, it, expect } from "vitest";
import {
  buildGraph,
  cyclicNodes,
  findCycle,
  isPrerequisiteOf,
  missingPrerequisites,
  reachableFrom,
  topologicalSort,
  validateGraph,
} from "@/lib/roadmap/graph";
import {
  occurrences,
  occurrenceById,
  canonicalOccurrences,
} from "@/lib/roadmap/config";
import type { OccurrenceMetadata, TrackId, Importance } from "@/lib/roadmap/types";

const IMPORTANCE: Record<TrackId, Importance> = {
  "general-ai": "core",
  "llm-app": "core",
  rag: "core",
  agent: "core",
  ml: "core",
  mlops: "core",
  research: "core",
};

function node(id: string, prerequisites: string[] = []): OccurrenceMetadata {
  const [phaseSlug = "00-setup-and-tooling", lessonSlug = id] = id.split("/");
  return {
    occurrenceId: id,
    canonicalLessonKey: id,
    phaseSlug,
    lessonSlug,
    title: lessonSlug.replace(/-/g, " "),
    difficulty: "beginner",
    estimatedMinutes: 60,
    estimateSource: "upstream",
    skillTags: [],
    projectRelevant: false,
    importance: { ...IMPORTANCE },
    prerequisites,
    recommendedBefore: [],
    isAlias: false,
  };
}

describe("roadmap prerequisite graph", () => {
  it("topologically sorts the configured curriculum graph", () => {
    const order = topologicalSort(buildGraph());
    expect(order).toHaveLength(occurrences.length);
    const position = new Map(order.map((id, index) => [id, index]));
    for (const occurrence of occurrences) {
      for (const prerequisite of occurrence.prerequisites) {
        expect(position.get(prerequisite)!).toBeLessThan(position.get(occurrence.occurrenceId)!);
      }
    }
  });

  it("returns every node exactly once and is deterministic", () => {
    const first = topologicalSort(buildGraph());
    const second = topologicalSort(buildGraph());
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
  });

  it("detects a cycle and identifies the exact nodes", () => {
    const graph = buildGraph([
      node("a/b"),
      node("a/c", ["a/b"]),
      node("a/d", ["a/c"]),
      node("a/b", ["a/d"]),
    ]);
    const cycle = findCycle(graph);
    expect(cycle).not.toBeNull();
    expect(new Set(cycle)).toEqual(new Set(["a/b", "a/c", "a/d"]));
    expect(cyclicNodes(graph).sort()).toEqual(["a/b", "a/c", "a/d"]);
    const report = validateGraph(graph);
    expect(report.ok).toBe(false);
    expect(report.cycles).toHaveLength(1);
    expect(() => topologicalSort(graph)).toThrow(/acyclic/i);
  });

  it("reports missing prerequisites instead of silently dropping them", () => {
    const graph = buildGraph([node("a/one", ["missing/lesson"])]);
    const report = validateGraph(graph);
    expect(report.ok).toBe(false);
    expect(report.missingPrerequisites).toEqual([
      { occurrenceId: "a/one", missing: ["missing/lesson"] },
    ]);
  });

  it("validates the configured graph with no cycles or missing prerequisites", () => {
    const report = validateGraph();
    expect(report.ok).toBe(true);
    expect(report.cycles).toHaveLength(0);
    expect(report.missingPrerequisites).toHaveLength(0);
    expect(report.duplicateOccurrences).toHaveLength(0);
  });

  it("calculates reachable prerequisites transitively", () => {
    const graph = buildGraph([node("a/one"), node("a/two", ["a/one"]), node("a/three", ["a/two"])]);
    expect([...reachableFrom(graph, "a/three")].sort()).toEqual(["a/one", "a/two"]);
    expect(isPrerequisiteOf(graph, "a/one", "a/three")).toBe(true);
    expect(isPrerequisiteOf(graph, "a/three", "a/one")).toBe(false);
  });

  it("detects prerequisites that are not completed yet", () => {
    const graph = buildGraph([
      node("a/one"),
      node("a/two", ["a/one"]),
      node("a/three", ["a/two"]),
    ]);
    expect(missingPrerequisites(graph, "a/three", new Set())).toEqual(["a/two"]);
    expect(missingPrerequisites(graph, "a/three", new Set(["a/one"]))).toEqual(["a/two"]);
    expect(missingPrerequisites(graph, "a/three", new Set(["a/one", "a/two"]))).toEqual([]);
  });

  it("keeps both Vision Transformer curriculum occurrences as distinct nodes", () => {
    const graph = buildGraph();
    expect(graph.nodes.has("04-computer-vision/14-vision-transformers")).toBe(true);
    expect(graph.nodes.has("07-transformers-deep-dive/09-vision-transformers")).toBe(true);
    expect(
      canonicalOccurrences.get("07-transformers-deep-dive/09-vision-transformers")
    ).toHaveLength(1);
    const lesson = occurrenceById.get("04-computer-vision/14-vision-transformers");
    expect(lesson?.canonicalLessonKey).toBe("04-computer-vision/14-vision-transformers");
    expect(lesson?.prerequisites).toEqual(["04-computer-vision/13-3d-vision-nerf"]);
  });
});
