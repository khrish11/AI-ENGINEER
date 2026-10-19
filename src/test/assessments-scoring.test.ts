import { describe, it, expect, beforeEach } from "vitest";
import { scoreAssessment, scoreAnswer } from "@/lib/assessments/scoring";
import {
  recordAssessmentAttempt,
  getAttemptsByAssessment,
  getAllAssessmentAttempts,
} from "@/lib/assessments/attempts";
import { AssessmentSchema, type Assessment, type AnswerMap } from "@/lib/assessments/schema";
import { resetProgressDb } from "./progress-test-utils";

const base = {
  phaseSlug: "unit-test-phase",
  description: "",
  passThreshold: 0.7,
  status: "active",

  kind: "phase_checkpoint" as Assessment["kind"],
  title: "Unit checkpoint",
  questions: [] as Assessment["questions"],
};

function makeAssessmentBrowser(): Record<string, unknown> {
  return {
    ...base,
    id: "unit-checkpoint",
    questions: [
      {
        id: "q-single",
        type: "single_choice",
        prompt: "Which one?",
        options: ["A", "B", "C"],
        correctOptionIndex: 1,
        explanation: "B is right.",
        lessonRefs: [],
        skills: ["rag"],
        points: 2,
      },
      {
        id: "q-multi",
        type: "multiple_choice",
        prompt: "Pick many.",
        options: ["X", "Y", "Z"],
        correctOptionIndices: [0, 2],
        explanation: "X and Z.",
        lessonRefs: [],
        skills: ["rag"],
        points: 2,
      },
      {
        id: "q-bool",
        type: "true_false",
        prompt: "True or false?",
        correctBoolean: true,
        explanation: "It is true.",
        lessonRefs: [],
        skills: ["rag"],
        points: 1,
      },
      {
        id: "q-order",
        type: "ordering",
        prompt: "Order these.",
        options: ["step0", "step1", "step2"],
        correctOrder: [0, 1, 2],
        explanation: "In order.",
        lessonRefs: [],
        skills: ["rag"],
        points: 2,
      },
      {
        id: "q-short",
        type: "short_answer",
        prompt: "Explain briefly.",
        explanation: "Self-checked.",
        lessonRefs: [],
        skills: ["rag"],
        points: 1,
        selfCheck: {
          criteria: ["Mentions X", "Mentions Y"],
          fullPoints: 1,
          partialPoints: 0,
          guidance: "Check yourself honestly.",
        },
      },
    ],
  };
}

function parsedAssessment(): Assessment {
  return AssessmentSchema.parse(makeAssessmentBrowser());
}

describe("scoring engine", () => {
  it("scores single choice exactly", () => {
    const assessment = parsedAssessment();
    const q = assessment.questions[0];
    expect(scoreAnswer(q, 1).earned).toBe(2);
    expect(scoreAnswer(q, 0).earned).toBe(0);
    expect(scoreAnswer(q, "1" as unknown as number).earned).toBe(0);
    expect(scoreAnswer(q, undefined).earned).toBe(0);
  });

  it("supports every Phase 6 question type", () => {
    const types = parsedAssessment().questions.map((q) => q.type);
    expect(types).toContain("single_choice");
    expect(types).toContain("true_false");
    expect(types).toContain("multiple_choice");
    expect(types).toContain("ordering");
    expect(types).toContain("short_answer");
  });

  it("scores multiple choice with order-insensitive set comparison", () => {
    const assessment = parsedAssessment();
    const q = assessment.questions.find((x) => x.id === "q-multi")!;
    expect(scoreAnswer(q, [2, 0]).earned).toBe(2);
    expect(scoreAnswer(q, [0]).earned).toBe(0);
    expect(scoreAnswer(q, 0).earned).toBe(0);
  });

  it("scores ordering as exact permutation only", () => {
    const assessment = parsedAssessment();
    const q = assessment.questions.find((x) => x.id === "q-order")!;
    expect(scoreAnswer(q, [0, 1, 2]).earned).toBe(2);
    expect(scoreAnswer(q, [2, 1, 0]).earned).toBe(0);
  });

  it("scores true/false boolean equality", () => {
    const assessment = parsedAssessment();
    const q = assessment.questions.find((x) => x.id === "q-bool")!;
    expect(scoreAnswer(q, 0).earned).toBe(1);
    expect(q.correctBoolean).toBe(true);
    expect(scoreAnswer(q, true as unknown as number).earned).toBe(1);
    expect(scoreAnswer(q, 1).earned).toBe(0);
  });

  it("marks short_answer as self-assessed with rubric points", () => {
    const assessment = parsedAssessment();
    const q = assessment.questions.find((x) => x.id === "q-short")!;
    const all = scoreAnswer(q, {
      text: "answer",
      criteriaMet: 2,
      criteriaTotal: 2,
    });
    expect(all.earned).toBe(q.selfCheck!.fullPoints);
    expect(all.selfAssessed).toBe(true);
    const partial = scoreAnswer(q, { text: "answer", criteriaMet: 1, criteriaTotal: 2 });
    expect(partial.earned).toBe(q.selfCheck!.partialPoints);
  });

  it("rejects invalid answer shapes instead of crashing", () => {
    const assessment = parsedAssessment();
    const multi = assessment.questions.find((x) => x.id === "q-multi")!;
    // Non-numeric arrays cannot crash the scorer; they simply earn nothing.
    expect(scoreAnswer(multi, ["nope"] as unknown as number[]).invalid).toBe(false);
    expect(scoreAnswer(multi, ["nope"] as unknown as number[]).earned).toBe(0);
    const short = assessment.questions.find((x) => x.id === "q-short")!;
    expect(scoreAnswer(short, "text" as unknown as AnswerMap[string]).invalid).toBe(true);
  });

  it("an invalid or zero-score submission never passes", () => {
    const assessment = parsedAssessment();
    const answers: AnswerMap = {
      "q-single": ["junk"] as unknown as number,
    };
    const scored = scoreAssessment(assessment, answers);
    expect(scored.percentage).toBeNull();
    expect(scored.passed).toBe(false);
  });
});

describe("assessment attempts (immutable registry)", () => {
  beforeEach(async () => {
    await resetProgressDb();
  });

  it("records attempts with monotonic attempt numbers", async () => {
    const assessment = parsedAssessment();
    const answers: AnswerMap = {
      "q-single": 1,
      "q-multi": [0, 2],
      "q-bool": 0,
      "q-order": [0, 1, 2],
      "q-short": { text: "x", criteriaMet: 2, criteriaTotal: 2 },
    };
    const scored = scoreAssessment(assessment, answers);
    const first = await recordAssessmentAttempt({ assessment, answers, scored, startedAt: answers !== undefined ? new Date().toISOString() : "" });
    expect(first.attemptNumber).toBe(1);
    const second = await recordAssessmentAttempt({ assessment, answers, scored, startedAt: new Date().toISOString() });
    expect(second.attemptNumber).toBe(2);
    // First record unchanged: even a second perfect attempt does not mutate it
    const rows = await getAttemptsByAssessment(assessment.id);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe(first.id);
    await expect(getAllAssessmentAttempts()).resolves.toHaveLength(2);
  });
});
