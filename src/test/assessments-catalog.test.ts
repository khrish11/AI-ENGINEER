import { describe, it, expect } from "vitest";
import { assessmentCatalog, getCheckpoints, getCheckpointForPhase, getAssessmentById } from "@/lib/assessments/catalog";

describe("assessment catalog (5 real checkpoints)", () => {
  it("loads 5 checkpoints with unique ids", () => {
    expect(assessmentCatalog).toHaveLength(5);
    expect(new Set(assessmentCatalog.map((a) => a.id)).size).toBe(5);
  });

  it("every entry is an active phase checkpoint", () => {
    expect(getCheckpoints()).toEqual(assessmentCatalog);
    for (const assessment of assessmentCatalog) {
      expect(assessment.kind).toBe("phase_checkpoint");
      expect(assessment.status).toBe("active");
      expect(assessment.questions.length).toBeGreaterThan(0);
    }
  });

  it("exposes lookups by id and phase", () => {
    const first = getCheckpoints()[0];
    expect(getAssessmentById(first.id)?.id).toBe(first.id);
    expect(getCheckpointForPhase(first.phaseSlug)?.id).toBe(first.id);
    expect(getAssessmentById("missing")).toBeUndefined();
  });

  it("maps every question to at least one skill", () => {
    for (const assessment of assessmentCatalog) {
      for (const question of assessment.questions) {
        expect(question.skills.length).toBeGreaterThan(0);
      }
    }
  });
});
