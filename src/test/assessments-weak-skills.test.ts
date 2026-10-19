import { describe, it, expect } from "vitest";
import {
  weakSkillIds,
  buildSkillEvidence,
  reviewRecommendations,
  WEAK_AVERAGE_THRESHOLD,
  REPEAT_INCORRECT_THRESHOLD,
  type AttemptLike,
} from "@/lib/assessments/weak-skills";
import type { Assessment } from "@/lib/assessments/schema";

/** Simpler builder: each question is single_choice with answer key 0. */
function assessmentWithSkills(id: string, skillsPerQuestion: string[][]): Assessment {
  return {
    id,
    title: id,
    kind: "phase_checkpoint",
    phaseSlug: "unit-phase",
    description: "",
    passThreshold: 0.7,
    status: "active",
    questions: skillsPerQuestion.map((skills, i) => ({
      id: `${id}-q${i}`,
      type: "single_choice" as const,
      prompt: `Q${i}`,
      options: ["A", "B"],
      correctOptionIndex: 0,
      explanation: "A.",
      lessonRefs: [],
      skills,
      points: 1,
    })),
  } as unknown as Assessment;
}

function attempt(
  assessmentId: string,
  answers: Record<string, number>,
  percentage: number,
  submittedAt: string
): AttemptLike {
  return {
    assessmentId,
    percentage,
    submittedAt,
    answers,
  };
}

describe("weak-skill rules", () => {
  const a1 = assessmentWithSkills("a1", [["rag"], ["observability"]]);
  const catalog = new Map<string, Assessment>([
    ["a1", a1],
  ]);

  it("requires at least two valid attempts averaging below the threshold", () => {
    const attempts = [
      attempt("a1", { "a1-q0": 1, "a1-q1": 0 }, 50, "2026-10-01T00:00:00Z"),
    ];
    expect(weakSkillIds(catalog, attempts)).toEqual([]);
  });

  it("flags a skill after a weak average across the recent window", () => {
    const attempts = [
      attempt("a1", { "a1-q0": 1, "a1-q1": 0 }, 50, "2026-10-01T00:00:00Z"),
      attempt("a1", { "a1-q0": 0, "a1-q1": 0 }, 55, "2026-10-02T00:00:00Z"),
    ];
    expect(WEAK_AVERAGE_THRESHOLD).toBe(70);
    expect(weakSkillIds(catalog, attempts)).toContain("rag");
    expect(weakSkillIds(catalog, attempts)).toContain("observability");
  });

  it("flags repeated incorrect answers even with an okay average", () => {
    const attempts = [
      attempt("a1", { "a1-q0": 1, "a1-q1": 0 }, 95, "2026-10-01T00:00:00Z"),
      attempt("a1", { "a1-q0": 1, "a1-q1": 0 }, 95, "2026-10-02T00:00:00Z"),
    ];
    expect(REPEAT_INCORRECT_THRESHOLD).toBe(2);
    // rag was answered wrongly in both attempts; observability was correct both times.
    expect(weakSkillIds(catalog, attempts)).toEqual(["rag"]);
  });

  it("never flags a single isolated mistake", () => {
    const attempts = [
      attempt("a1", { "a1-q0": 1, "a1-q1": 0 }, 100, "2026-10-01T00:00:00Z"),
    ];
    expect(weakSkillIds(catalog, attempts)).toEqual([]);
  });

  it("ignores invalid (never submitted) attempts entirely", () => {
    const attempts = [
      attempt("a1", { "a1-q0": 1, "a1-q1": 0 }, 0, "2026-10-01T00:00:00Z"),
      attempt("a1", { "a1-q0": 0, "a1-q1": 0 }, 100, "2026-10-02T00:00:00Z"),
    ];
    const stale = attempts.map((a) => ({ ...a, submittedAt: null, percentage: null }));
    expect(weakSkillIds(catalog, stale)).toEqual([]);
    expect(buildSkillEvidence(catalog, stale).get("rag")?.validAttempts).toBe(0);
  });

  it("caps review recommendations at 5", () => {
    const multi = assessmentWithSkills("a2", [
      ["s1"], ["s2"], ["s3"], ["s4"], ["s5"], ["s6"],
    ]);
    const catalogMulti = new Map<string, Assessment>([["a2", multi]]);
    const attempts = [];
    for (let i = 0; i < 2; i += 1) {
      attempts.push(
        attempt(
          "a2",
          Object.fromEntries(multi.questions.map((q) => [q.id, 1])),
          50,
          `2026-10-0${i + 1}T00:00:00Z`
        )
      );
    }
    const weak = ["s1", "s2", "s3", "s4", "s5", "s6"];
    const recommendations = reviewRecommendations(catalogMulti, attempts, weak, new Map());
    expect(recommendations.length).toBeLessThanOrEqual(5);
    expect(recommendations.every((r) => ["weak_average", "repeated_incorrect", "stale"].includes(r.reason))).toBe(true);
  });
});
