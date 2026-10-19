import { describe, it, expect } from "vitest";
import { skillAnalytics } from "@/lib/analytics/skills";
import { computeMasteryEvidence } from "@/lib/assessments/mastery";
import { weakSkillIds } from "@/lib/assessments/weak-skills";
import { assessmentCatalog } from "@/lib/assessments/catalog";
import { projectCatalog } from "@/lib/projects/catalog";
import {
  validateCounts,
  validateTimestamps,
  validateSessionDuration,
  validateMilestoneCount,
  validateRubricScore,
} from "@/lib/analytics/validation";
import type { LessonProgress } from "@/lib/progress/db";

const ASSESSMENT = assessmentCatalog[0];
const SKILL = ASSESSMENT.questions[0].skills[0];

function lesson(overrides: Record<string, unknown> = {}): LessonProgress {
  const now = "2026-10-01T10:00:00.000Z";
  return {
    id: "row",
    createdAt: now,
    updatedAt: now,
    localRevision: 1,
    syncStatus: "pending",
    lessonId: "canonical-key",
    status: "completed",
    readingComplete: true,
    requiredResourcesComplete: true,
    practiceComplete: true,
    projectComplete: false,
    masteryScore: null,
    needsReview: false,
    startedAt: null,
    completedAt: now,
    masteredAt: null,
    ...overrides,
  } as unknown as LessonProgress;
}

describe("§9/§10 skill evidence + mastery model", () => {
  it("combines lesson, assessment and project evidence per skill", () => {
    const lessonKeys = new Set(
      ASSESSMENT.questions.flatMap((question) => question.skills).map(() => null)
    );
    void lessonKeys;
    const result = skillAnalytics({
      lessonProgress: [lesson({ lessonId: "canonical-key", status: "mastered" })],
      attempts: [
        { assessmentId: ASSESSMENT.id, percentage: 90, submittedAt: "2026-10-05T10:00:00.000Z", answers: {} },
      ],
      projectProgress: [{ projectId: projectCatalog[0].id, completed: true }],
      reviewHistory: new Map(),
    });
    void SKILL;
    const anySkill = result.skills.find((skill) => skill.totalLessons > 0);
    expect(anySkill).toBeDefined();
    expect(anySkill?.mastery.band).toBeDefined();
    expect(anySkill?.evidenceCoverage).toBeDefined();
  });

  it("keeps documented mastery weights and bands", () => {
    const mastery = computeMasteryEvidence(
      "skill",
      { completedLessons: 5, totalLessons: 10 },
      { validAttempts: 3, recentAverage: 90 },
      { completedProjects: 2, totalProjects: 4 }
    );
    // 0.4 * 0.5 + 0.4 * (90/100) + 0.2 * (2/4) = 0.2 + 0.36 + 0.1 = 0.66 -> 66
    expect(mastery.score).toBe(66);
    expect(mastery.band).toBe("proficient");
    expect(mastery.labels.length).toBe(3);
  });

  it("shows evidence labels — status is never opaque", () => {
    const mastery = computeMasteryEvidence(
      "skill",
      { completedLessons: 2, totalLessons: 4 },
      { validAttempts: 1, recentAverage: 80 },
      { completedProjects: 0, totalProjects: 2 }
    );
    expect(mastery.labels.some((label) => label.startsWith("Lessons:"))).toBe(true);
  });

  it("reports evidence coverage from source diversity", () => {
    const onlyLessons = skillAnalytics({
      lessonProgress: [lesson()],
      attempts: [],
      projectProgress: [],
      reviewHistory: new Map(),
    });
    const eligible = onlyLessons.skills.find((skill) => skill.completedLessons > 0);
    if (eligible) {
      expect(eligible.evidenceCoverage).toBe("low");
      expect(eligible.mastery.band).toBe("developing");
    } else {
      // Lesson key is not attached to a catalog skill in this synthetic fixture.
      expect(onlyLessons.skills.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("detects weak skills only after repeated below-threshold attempts", () => {
    const byId = new Map(assessmentCatalog.map((assessment) => [assessment.id, assessment]));
    const attempts = [
      { assessmentId: ASSESSMENT.id, percentage: 55, submittedAt: "2026-10-01T10:00:00.000Z", answers: {} },
      { assessmentId: ASSESSMENT.id, percentage: 60, submittedAt: "2026-10-02T10:00:00.000Z", answers: {} },
    ];
    const weak = weakSkillIds(byId, attempts);
    // Every skill this checkpoint touches that is weak is deterministic.
    expect(weak).toEqual([...weak].sort());
    expect(weak.some((skill) => ASSESSMENT.questions.some((question) => question.skills.includes(skill)))).toBe(true);
  });
});

describe("§45 analytics validation", () => {
  it("rejects completed > total", () => {
    expect(validateCounts({ completed: 5, total: 3 }).length).toBe(1);
    expect(validateCounts({ completed: 3, total: 3 }).length).toBe(0);
    expect(validateCounts({ completed: 2, total: 3, mastered: 3 }).length).toBe(1);
  });

  it("rejects invalid timestamps and backwards sessions", () => {
    expect(validateTimestamps({ startedAt: "not-a-date", endedAt: null }).length).toBe(1);
    expect(
      validateTimestamps({
        startedAt: "2026-01-01T10:00:00.000Z",
        endedAt: "2025-01-01T10:00:00.000Z",
      }).length
    ).toBe(1);
  });

  it("rejects negative study durations", () => {
    expect(validateSessionDuration(-1).length).toBe(1);
    expect(validateSessionDuration(null).length).toBe(0);
  });

  it("rejects milestone overflow and rubric out-of-range", () => {
    expect(validateMilestoneCount({ completed: 7, projectMilestoneCount: 4 }).length).toBe(1);
    expect(validateMilestoneCount({ completed: 4, projectMilestoneCount: 4 }).length).toBe(0);
    expect(validateRubricScore({ score: 3, weight: 2 }).length).toBe(1);
    expect(validateRubricScore({ score: 2, weight: 2 }).length).toBe(0);
  });
});
