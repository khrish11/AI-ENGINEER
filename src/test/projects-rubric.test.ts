import { describe, it, expect } from "vitest";
import { scoreRubric, rubricVerdict, SELF_ASSESSED_LABEL } from "@/lib/projects/rubric";
import { makeRubric } from "./projects-test-utils";

describe("scoreRubric", () => {
  const rubric = makeRubric();

  it("sums valid scores and reports max", () => {
    const result = scoreRubric(rubric, { correctness: 40, tests: 15, docs: 30 });
    expect(result.total).toBe(85);
    expect(result.max).toBe(100);
    expect(result.complete).toBe(true);
    expect(result.percentage).toBe(85);
  });

  it("clamps out-of-range entries out of the total", () => {
    const result = scoreRubric(rubric, { correctness: 99, tests: 15, docs: 5 });
    // correctness entry is invalid (weight 40) → contributes 0
    expect(result.categories[0].valid).toBe(false);
    expect(result.categories[0].score).toBe(0);
    expect(result.total).toBe(20);
    expect(result.complete).toBe(false);
    expect(result.percentage).toBeNull();
  });

  it("treats missing categories as incomplete", () => {
    const result = scoreRubric(rubric, { correctness: 40, tests: 30 });
    expect(result.complete).toBe(false);
  });

  it("handles NaN and non-numeric values defensively", () => {
    const result = scoreRubric(rubric, {
      correctness: Number.NaN,
      tests: ("30" as unknown) as number,
      docs: 30,
    });
    expect(result.complete).toBe(false);
    expect(result.total).toBe(30);
  });
});

describe("rubricVerdict", () => {
  const thresholds = { completion: 60, mastery: 75 };

  it("maps percentages to tiers", () => {
    expect(
      rubricVerdict({ categories: [], total: 0, max: 100, percentage: 40, complete: true }, thresholds)
    ).toBe("below_completion");
    expect(
      rubricVerdict({ categories: [], total: 0, max: 100, percentage: 60, complete: true }, thresholds)
    ).toBe("completed");
    expect(
      rubricVerdict({ categories: [], total: 0, max: 100, percentage: 75, complete: true }, thresholds)
    ).toBe("mastered");
  });

  it("marks incomplete scoring as below completion", () => {
    expect(
      rubricVerdict(
        { categories: [], total: 0, max: 100, percentage: null, complete: false },
        thresholds
      )
    ).toBe("below_completion");
  });
});

describe("SELF_ASSESSED_LABEL", () => {
  it("labels self-assessment explicitly (never external certification)", () => {
    expect(SELF_ASSESSED_LABEL).toBe("Self-assessed");
  });
});
