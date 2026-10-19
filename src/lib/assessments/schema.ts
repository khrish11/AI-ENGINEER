import { z } from "zod";

export const QUESTION_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "ordering",
  "short_answer",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const ASSESSMENT_KINDS = [
  "pre_assessment",
  "lesson_quiz",
  "phase_checkpoint",
  "project_assessment",
  "cumulative_review",
] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

/** §21 — free-text answers are self-checked against a rubric, never AI-graded. */
export const ShortAnswerRubricSchema = z.object({
  criteria: z.array(z.string().min(1)).min(1),
  /** Points awarded when the learner marks all criteria met (self-checked). */
  fullPoints: z.number().int().min(0),
  partialPoints: z.number().int().min(0),
  guidance: z.string().min(1),
});

export const QuestionSchema = z
  .object({
    id: z.string().min(1).regex(/^[a-z0-9-]+$/),
    type: z.enum(QUESTION_TYPES),
    prompt: z.string().min(1),
    /** Choice options in order; used by choice and true_false types. */
    options: z.array(z.string()).optional(),
    /** correct for single_choice: index; multiple_choice: indices; true_false: 0/1 as boolean. */
    correctOptionIndex: z.number().int().min(0).optional(),
    correctOptionIndices: z.array(z.number().int().min(0)).optional(),
    correctBoolean: z.boolean().optional(),
    /** ordering: the correct order expressed as option indices (first is correct order). */
    correctOrder: z.array(z.number().int().min(0)).optional(),
    /** short_answer: self-check rubric with points. */
    selfCheck: ShortAnswerRubricSchema.optional(),
    explanation: z.string().min(1),
    /** Curriculum occurrences the question assesses. */
    lessonRefs: z.array(z.string().min(1)).default([]),
    /** Skill ids from the Phase 5 taxonomy. */
    skills: z.array(z.string().min(1)).default([]),
    points: z.number().int().min(1).default(1),
  })
  .superRefine((question, ctx) => {
    switch (question.type) {
      case "single_choice": {
        if (question.correctOptionIndex === undefined || !question.options?.length) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "single_choice requires options and correctOptionIndex." });
        }
        break;
      }
      case "multiple_choice": {
        if (!question.correctOptionIndices?.length || !question.options?.length) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "multiple_choice requires options and correctOptionIndices." });
        }
        break;
      }
      case "true_false": {
        if (question.correctBoolean === undefined) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "true_false requires correctBoolean." });
        }
        break;
      }
      case "ordering": {
        if (!question.correctOrder?.length || !question.options?.length) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ordering requires options and correctOrder." });
        }
        break;
      }
      case "short_answer": {
        if (!question.selfCheck) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "short_answer requires a self-check rubric." });
        }
        break;
      }
    }
  });
export type Question = z.infer<typeof QuestionSchema>;

export const AssessmentSchema = z
  .object({
    id: z.string().min(1).regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    kind: z.enum(ASSESSMENT_KINDS),
    phaseSlug: z.string().min(1),
    description: z.string().default(""),
    questions: z.array(QuestionSchema).min(1),
    /** Passing threshold (0..1), used for mastery evidence (§24-26). */
    passThreshold: z.number().min(0).max(1).default(0.7),
    status: z.enum(["active", "draft"]).default("active"),
  })
  .superRefine((assessment, ctx) => {
    const ids = new Set<string>();
    for (const question of assessment.questions) {
      if (ids.has(question.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions"],
          message: `Duplicate question id: ${question.id}`,
        });
      }
      ids.add(question.id);
    }
  });
export type Assessment = z.infer<typeof AssessmentSchema>;

/** A learner's raw answers keyed by question id. */
export type AnswerMap = Record<string, AnswerValue>;

export type AnswerValue =
  | number // single choice / true_false(0/1)
  | number[] // multiple choice / ordering
  | { text: string; criteriaMet: number; criteriaTotal: number }; // short_answer
