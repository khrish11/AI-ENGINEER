import { describe, it, expect } from "vitest";
import { metadataProjectEvaluator } from "@/lib/projects/evaluator";
import { makeProject, evidenceOf } from "./projects-test-utils";

describe("MetadataProjectEvaluator (safe, §11)", () => {
  const completeSubmission = () => ({
    projectId: "proj-test-evaluated-rag",
    milestoneStates: [
      { milestoneId: "ingestion", completed: true, evidenceUrl: null },
      { milestoneId: "evaluation", completed: true, evidenceUrl: null },
    ],
    evidence: [evidenceOf("github_repo_url")],
    selfAssessment: { scores: { correctness: 40, tests: 30, docs: 30 }, updatedAt: null },
  });

  it("marks a fully evidenced submission as passed via metadata only", async () => {
    const project = makeProject();
    const result = await metadataProjectEvaluator.evaluate(completeSubmission(), project);
    expect(result.evaluator).toBe("metadata");
    expect(result.status).toBe("mastered");
    expect(result.passed).toBe(true);
    expect(result.checks.every((check) => check.passed)).toBe(true);
    expect(result.notes.join(" ")).toContain("no learner code was executed");
  });

  it("fails closed when required evidence is missing", async () => {
    const project = makeProject();
    const result = await metadataProjectEvaluator.evaluate(
      {
        projectId: "proj-test-evaluated-rag",
        milestoneStates: [
          { milestoneId: "ingestion", completed: true, evidenceUrl: null },
          { milestoneId: "evaluation", completed: true, evidenceUrl: null },
        ],
        evidence: [],
        selfAssessment: { scores: { correctness: 40, tests: 30, docs: 30 }, updatedAt: null },
      },
      project
    );
    expect(result.passed).toBe(false);
    const evidenceCheck = result.checks.find((check) => check.id === "evidence")!;
    expect(evidenceCheck.passed).toBe(false);
  });

  it("flags evidence kinds that do not belong to the project scope", async () => {
    const project = makeProject();
    const result = await metadataProjectEvaluator.evaluate(
      {
        projectId: "proj-test-evaluated-rag",
        milestoneStates: [
          { milestoneId: "ingestion", completed: true, evidenceUrl: null },
          { milestoneId: "evaluation", completed: true, evidenceUrl: null },
        ],
        evidence: [
          evidenceOf("github_repo_url"),
          { ...evidenceOf("screenshot"), kind: "screenshot" },
        ],
        selfAssessment: { scores: { correctness: 40, tests: 30, docs: 30 }, updatedAt: null },
      },
      project
    );
    const scopeCheck = result.checks.find((check) => check.id === "evidence-kinds-unknown")!;
    expect(scopeCheck.passed).toBe(false);
    expect(scopeCheck.detail).toContain("screenshot");
  });

  it("never executes anything: the interface carries no code payload", async () => {
    // Structural guard — the contract type has no executable field.
    expect(Object.keys(metadataProjectEvaluator)).toEqual(["kind"]);
    expect(metadataProjectEvaluator.evaluate).toBeTypeOf("function");
  });
});
