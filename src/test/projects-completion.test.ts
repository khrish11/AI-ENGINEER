import { describe, it, expect } from "vitest";
import {
  computeProjectStatus,
  blockingMilestones,
  auditPrerequisites,
  rubricTotal,
  type MilestoneState,
} from "@/lib/projects/completion";
import { makeProject, evidenceOf, makeRubric } from "./projects-test-utils";

function states(entries: Array<[string, boolean]>): MilestoneState[] {
  return entries.map(([milestoneId, completed]) => ({
    milestoneId,
    completed,
    evidenceUrl: null,
  }));
}

describe("computeProjectStatus", () => {
  it("is not_started when nothing was touched", () => {
    const project = makeProject();
    const result = computeProjectStatus(project, {
      milestoneStates: [],
      evidence: [],
      selfAssessment: null,
    });
    expect(result.status).toBe("not_started");
  });

  it("moves to in_progress after one milestone completes", () => {
    const project = makeProject();
    const result = computeProjectStatus(project, {
      milestoneStates: states([["ingestion", true]]),
      evidence: [evidenceOf("github_repo_url")],
      selfAssessment: null,
    });
    expect(result.status).toBe("in_progress");
  });

  it("blocks submitted when a required milestone lacks its evidence kind", () => {
    const project = makeProject();
    const result = computeProjectStatus(project, {
      milestoneStates: states([
        ["ingestion", true],
        ["evaluation", true],
      ]),
      evidence: [],
      selfAssessment: null,
    });
    expect(result.requiredMilestonesComplete).toBe(false);
    // Milestone work alone keeps the project in_progress, never submitted.
    expect(result.status).toBe("in_progress");
  });

  it("becomes submitted only when milestones, evidence, and self-assessment exist", () => {
    const project = makeProject();
    const result = computeProjectStatus(project, {
      milestoneStates: states([
        ["ingestion", true],
        ["evaluation", true],
      ]),
      evidence: [evidenceOf("github_repo_url")],
      selfAssessment: { scores: { correctness: 15, tests: 15, docs: 15 }, updatedAt: null },
    });
    expect(result.requiredMilestonesComplete).toBe(true);
    expect(result.requiredEvidenceProvided).toBe(true);
    expect(result.minimumSelfAssessmentCompleted).toBe(true);
    expect(result.status).toBe("submitted");
  });

  it("raises to completed when the rubric total clears completionThreshold", () => {
    const project = makeProject({ level: "intermediate" });
    const result = computeProjectStatus(project, {
      milestoneStates: states([
        ["ingestion", true],
        ["evaluation", true],
      ]),
      evidence: [evidenceOf("github_repo_url")],
      // 60/100 total clears completionThreshold 60 but not masteryThreshold 75.
      selfAssessment: { scores: { correctness: 30, tests: 15, docs: 15 }, updatedAt: null },
    });
    expect(result.status).toBe("completed");
  });

  it("stays submitted when the rubric total is below the completion threshold", () => {
    const project = makeProject();
    const result = computeProjectStatus(project, {
      milestoneStates: states([
        ["ingestion", true],
        ["evaluation", true],
      ]),
      evidence: [evidenceOf("github_repo_url")],
      selfAssessment: { scores: { correctness: 10, tests: 10, docs: 10 }, updatedAt: null },
    });
    expect(result.status).toBe("submitted");
  });

  it("reaches mastered only with mastery-threshold rubric and reflection evidence (advanced)", () => {
    const project = makeProject({ level: "advanced" });
    const completed = {
      milestoneStates: states([
        ["ingestion", true],
        ["evaluation", true],
      ]),
      evidence: [evidenceOf("github_repo_url")],
      selfAssessment: { scores: { correctness: 40, tests: 30, docs: 30 }, updatedAt: null },
    };
    const withoutReflection = computeProjectStatus(project, completed);
    // advanced requires markdown_reflection evidence for mastery
    expect(withoutReflection.status).toBe("completed");

    const withReflection = computeProjectStatus(project, {
      ...completed,
      evidence: completed.evidence.concat(evidenceOf("markdown_reflection")),
    });
    expect(withReflection.status).toBe("mastered");
  });

  it("never moves without any milestones done, evidence, or assessment (opened page only)", () => {
    const project = makeProject();
    const result = computeProjectStatus(project, {
      milestoneStates: [],
      evidence: [],
      selfAssessment: null,
    });
    expect(result.status).toBe("not_started");
  });
});

describe("rubricTotal", () => {
  it("requires every category to be assessed", () => {
    const rubric = makeRubric();
    const partial = rubricTotal(rubric, { correctness: 40, tests: 30 });
    expect(partial?.assessed).toBe(false);
    const full = rubricTotal(rubric, { correctness: 40, tests: 30, docs: 0 });
    expect(full?.assessed).toBe(true);
    expect(full?.total).toBe(70);
    expect(full?.max).toBe(100);
  });

  it("ignores out-of-range scores", () => {
    const rubric = makeRubric();
    const result = rubricTotal(rubric, { correctness: 99, tests: 30, docs: 30 });
    // correctness=99 is invalid (weight 40) → not counted as assessed
    expect(result?.assessed).toBe(false);
  });
});

describe("blockingMilestones", () => {
  it("lists only required incomplete milestones", () => {
    const project = makeProject();
    expect(blockingMilestones(project, { milestoneStates: [], evidence: [], selfAssessment: null })).toEqual([
      "Document ingestion",
      "Evaluation",
    ]);
  });
});

describe("auditPrerequisites", () => {
  it("splits completed vs missing prerequisite ids", () => {
    const project = makeProject({
      prerequisites: ["proj-a", "proj-b"],
    });
    const audit = auditPrerequisites(project, new Set(["proj-a"]));
    expect(audit.completed).toEqual(["proj-a"]);
    expect(audit.missing).toEqual(["proj-b"]);
  });
});
