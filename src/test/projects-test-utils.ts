import type { ProjectDefinition, Rubric } from "@/lib/projects/schema";

/** Deterministic rubric used across project tests (weights total 100). */
export function makeRubric(overrides: Partial<Rubric> = {}): Rubric {
  return {
    categories: [
      {
        id: "correctness",
        category: "Functional correctness",
        weight: 40,
        criteria: ["Runs end to end"],
        minimumExpectation: "Positive path works",
        excellentExpectation: "Edge cases handled",
      },
      {
        id: "tests",
        category: "Testing",
        weight: 30,
        criteria: ["Automated tests exist"],
        minimumExpectation: "Core flows covered",
        excellentExpectation: "CI enforced",
      },
      {
        id: "docs",
        category: "Documentation",
        weight: 30,
        criteria: ["README present"],
        minimumExpectation: "Setup documented",
        excellentExpectation: "Architecture documented",
      },
    ],
    completionThreshold: 60,
    masteryThreshold: 75,
    ...overrides,
  };
}

/** Synthetic-but-schema-valid project for pure logic tests. */
export function makeProject(overrides: Partial<ProjectDefinition> = {}): ProjectDefinition {
  return {
    id: "proj-test-evaluated-rag",
    slug: "test-evaluated-rag",
    title: "Evaluated RAG application",
    description: "A retrieval-augmented generation application with a real evaluation harness.",
    level: "intermediate",
    source: "platform",
    estimatedHours: 10,
    phaseSlugs: ["11-llm-engineering"],
    associatedOccurrences: ["occ-test-1"],
    associatedCanonicalLessons: [],
    skills: ["rag"],
    prerequisites: [],
    learningObjectives: ["Build retrieval", "Evaluate answers"],
    deliverables: [
      { id: "repo", kind: "github_repo", title: "Repository" },
    ],
    milestones: [
      {
        id: "ingestion",
        title: "Document ingestion",
        objective: "Load documents into the store",
        expectedOutput: "Populated index",
        requiredEvidence: ["e-repo"],
        estimatedMinutes: 90,
        required: true,
      },
      {
        id: "evaluation",
        title: "Evaluation",
        objective: "Build the eval set",
        expectedOutput: "Metrics report",
        requiredEvidence: [],
        estimatedMinutes: 120,
        required: true,
      },
    ],
    rubric: makeRubric(),
    suggestedStack: [],
    referenceResources: [],
    requiredEvidence: [
      {
        id: "e-repo",
        kind: "github_repo_url",
        description: "Public repository with the implementation.",
        required: true,
      },
    ],
    status: "active",
    relevantTracks: [],
    hasStarterTemplate: false,
    ...overrides,
  } as ProjectDefinition;
}

export const BASE = "2026-10-17T10:00:00.000Z";

export function evidenceOf(
  kind: string,
  overrides: Partial<{ id: string; value: string; createdAt: string }> = {}
) {
  return {
    id: overrides.id ?? `ev-${Math.random().toString(36).slice(2)}`,
    projectId: "proj-test-evaluated-rag",
    kind,
    value: overrides.value ?? "https://github.com/u/rag",
    title: null,
    createdAt: overrides.createdAt ?? BASE,
    selfReported: true,
  };
}
