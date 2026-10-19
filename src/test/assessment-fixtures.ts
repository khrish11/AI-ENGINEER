import { AssessmentSchema, type Assessment } from "@/lib/assessments/schema";

/**
 * Schema-valid two-question checkpoint fixture for integration tests
 * (single_choice + true_false, one skill each).
 */
export function checkpoint(): Assessment {
  return AssessmentSchema.parse({
    id: "unit-integration-checkpoint",
    title: "Integration checkpoint",
    kind: "phase_checkpoint",
    phaseSlug: "11-llm-engineering",
    description: "Two-question fixture.",
    passThreshold: 0.5,
    status: "active",
    questions: [
      {
        id: "ix-q1",
        type: "single_choice",
        prompt: "Which stage reduces hallucination?",
        options: ["Retrieval", "Guessing"],
        correctOptionIndex: 0,
        explanation: "Grounded context helps.",
        lessonRefs: [],
        skills: ["rag"],
        points: 1,
      },
      {
        id: "ix-q2",
        type: "true_false",
        prompt: "Answer keys never leave the device.",
        correctBoolean: false,
        explanation: "Attempts sync to the cloud account.",
        lessonRefs: [],
        skills: ["observability"],
        points: 1,
      },
    ],
  });
}
