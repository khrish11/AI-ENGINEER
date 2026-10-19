import { occurrences, phaseNumberFor } from "./config";
import type { Importance, OccurrenceMetadata } from "./types";

const IMPORTANCE_RANK: Record<Importance, number> = {
  core: 0,
  important: 1,
  optional: 2,
  skip: 3,
};

export interface RoadmapGraph {
  nodes: Map<string, OccurrenceMetadata>;
  prerequisites: Map<string, string[]>;
  dependents: Map<string, string[]>;
}

export interface GraphValidation {
  ok: boolean;
  missingPrerequisites: Array<{ occurrenceId: string; missing: string[] }>;
  duplicateOccurrences: string[];
  cycles: string[][];
}

export function buildGraph(source: OccurrenceMetadata[] = occurrences): RoadmapGraph {
  const nodes = new Map<string, OccurrenceMetadata>();
  const prerequisites = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();

  for (const occurrence of source) nodes.set(occurrence.occurrenceId, occurrence);
  for (const occurrence of source) prerequisites.set(occurrence.occurrenceId, []);
  for (const occurrence of source) dependents.set(occurrence.occurrenceId, []);

  for (const occurrence of source) {
    for (const prerequisite of occurrence.prerequisites) {
      if (!nodes.has(prerequisite)) continue;
      prerequisites.get(occurrence.occurrenceId)!.push(prerequisite);
      dependents.get(prerequisite)!.push(occurrence.occurrenceId);
    }
  }

  for (const list of prerequisites.values()) list.sort();
  for (const list of dependents.values()) list.sort();

  return { nodes, prerequisites, dependents };
}

export const roadmapGraph: RoadmapGraph = buildGraph();

/** Returns one concrete cycle path, or null when the graph is acyclic. */
export function findCycle(graph: RoadmapGraph): string[] | null {
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];

  const visit = (node: string): string[] | null => {
    state.set(node, 1);
    stack.push(node);
    for (const next of graph.prerequisites.get(node) ?? []) {
      const nextState = state.get(next) ?? 0;
      if (nextState === 0) {
        const found = visit(next);
        if (found) return found;
      } else if (nextState === 1) {
        const start = stack.indexOf(next);
        return [...stack.slice(start), next];
      }
    }
    stack.pop();
    state.set(node, 2);
    return null;
  };

  for (const node of graph.nodes.keys()) {
    if ((state.get(node) ?? 0) === 0) {
      const cycle = visit(node);
      if (cycle) return cycle;
    }
  }
  return null;
}

/** All nodes that cannot be topologically ordered because they sit in a cycle. */
export function cyclicNodes(graph: RoadmapGraph): string[] {
  const inDegree = new Map<string, number>();
  for (const node of graph.nodes.keys()) inDegree.set(node, 0);
  for (const [node, prerequisites] of graph.prerequisites) {
    inDegree.set(node, prerequisites.length);
  }

  const queue: string[] = [];
  for (const [node, degree] of inDegree) if (degree === 0) queue.push(node);

  const visited = new Set<string>();
  while (queue.length > 0) {
    const node = queue.shift()!;
    visited.add(node);
    for (const dependent of graph.dependents.get(node) ?? []) {
      const next = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, next);
      if (next === 0) queue.push(dependent);
    }
  }

  return [...graph.nodes.keys()].filter((node) => !visited.has(node)).sort();
}

export function validateGraph(graph: RoadmapGraph = roadmapGraph): GraphValidation {
  const missingPrerequisites: GraphValidation["missingPrerequisites"] = [];
  for (const [node, prerequisites] of graph.prerequisites) {
    const missing = (graph.nodes.get(node)?.prerequisites ?? []).filter(
      (prerequisite) => !graph.nodes.has(prerequisite)
    );
    if (missing.length > 0) missingPrerequisites.push({ occurrenceId: node, missing });
  }

  const seen = new Set<string>();
  const duplicateOccurrences: string[] = [];
  for (const node of graph.nodes.keys()) {
    if (seen.has(node)) duplicateOccurrences.push(node);
    seen.add(node);
  }

  const cycles: string[][] = [];
  const cycle = findCycle(graph);
  if (cycle) cycles.push(cycle);

  return {
    ok:
      missingPrerequisites.length === 0 &&
      duplicateOccurrences.length === 0 &&
      cycles.length === 0,
    missingPrerequisites,
    duplicateOccurrences,
    cycles,
  };
}

export function priorityComparator(
  graph: RoadmapGraph,
  importanceOf: (occurrenceId: string) => Importance,
  indexOf: (occurrenceId: string) => number
): (a: string, b: string) => number {
  return (a, b) => {
    const rankA = IMPORTANCE_RANK[importanceOf(a)];
    const rankB = IMPORTANCE_RANK[importanceOf(b)];
    if (rankA !== rankB) return rankA - rankB;
    const nodeA = graph.nodes.get(a);
    const nodeB = graph.nodes.get(b);
    const phaseA = nodeA ? phaseNumberFor(nodeA.phaseSlug) : Number.MAX_SAFE_INTEGER;
    const phaseB = nodeB ? phaseNumberFor(nodeB.phaseSlug) : Number.MAX_SAFE_INTEGER;
    if (phaseA !== phaseB) return phaseA - phaseB;
    return indexOf(a) - indexOf(b);
  };
}

export function topologicalSort(
  graph: RoadmapGraph,
  priority?: (a: string, b: string) => number,
  include?: Set<string>
): string[] {
  const inDegree = new Map<string, number>();
  const nodes = [...graph.nodes.keys()].filter((node) => !include || include.has(node));
  const nodeSet = new Set(nodes);

  for (const node of nodes) {
    const prerequisites = (graph.prerequisites.get(node) ?? []).filter((p) => nodeSet.has(p));
    inDegree.set(node, prerequisites.length);
  }

  const ready = nodes.filter((node) => (inDegree.get(node) ?? 0) === 0);
  const sorted: string[] = [];

  while (ready.length > 0) {
    if (priority) ready.sort(priority);
    const node = ready.shift()!;
    sorted.push(node);
    for (const dependent of graph.dependents.get(node) ?? []) {
      if (!nodeSet.has(dependent)) continue;
      const next = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, next);
      if (next === 0) ready.push(dependent);
    }
  }

  if (sorted.length !== nodes.length) {
    const blocked = nodes.filter((node) => !sorted.includes(node));
    throw new Error(
      `Roadmap graph is not acyclic; cannot schedule ${blocked.slice(0, 5).join(", ")}`
    );
  }

  return sorted;
}

export function reachableFrom(graph: RoadmapGraph, occurrenceId: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...(graph.prerequisites.get(occurrenceId) ?? [])];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (seen.has(node)) continue;
    seen.add(node);
    stack.push(...(graph.prerequisites.get(node) ?? []));
  }
  return seen;
}

export function allDependents(graph: RoadmapGraph, occurrenceId: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...(graph.dependents.get(occurrenceId) ?? [])];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (seen.has(node)) continue;
    seen.add(node);
    stack.push(...(graph.dependents.get(node) ?? []));
  }
  return seen;
}

export function isPrerequisiteOf(
  graph: RoadmapGraph,
  candidate: string,
  occurrenceId: string
): boolean {
  return reachableFrom(graph, occurrenceId).has(candidate);
}

export function prerequisiteChain(
  graph: RoadmapGraph,
  occurrenceId: string,
  limit = 3
): string[] {
  const seen = new Set<string>();
  const queue = [...(graph.prerequisites.get(occurrenceId) ?? [])];
  const ordered: string[] = [];
  while (queue.length > 0 && ordered.length < limit) {
    const node = queue.shift()!;
    if (seen.has(node)) continue;
    seen.add(node);
    ordered.push(node);
    queue.push(...(graph.prerequisites.get(node) ?? []));
  }
  return ordered;
}

/** Prerequisites of `occurrenceId` that have not been completed yet. */
export function missingPrerequisites(
  graph: RoadmapGraph,
  occurrenceId: string,
  completedCanonicalKeys: Set<string>
): string[] {
  return (graph.prerequisites.get(occurrenceId) ?? []).filter((prerequisite) => {
    const node = graph.nodes.get(prerequisite);
    return node ? !completedCanonicalKeys.has(node.canonicalLessonKey) : true;
  });
}

export function wouldViolatePrerequisites(
  graph: RoadmapGraph,
  occurrenceId: string,
  scheduledBeforeInOrder: Set<string>
): string[] {
  return (graph.prerequisites.get(occurrenceId) ?? []).filter(
    (prerequisite) => !scheduledBeforeInOrder.has(prerequisite)
  );
}
