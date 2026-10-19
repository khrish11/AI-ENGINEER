import type { AnswerMap, AnswerValue, Assessment, Question } from "./schema";

export interface QuestionScore {
  questionId: string;
  type: Question["type"];
  earned: number;
  possible: number;
  /** false when the answer shape was invalid (never crashes, never rewards). */
  invalid: boolean;
  /** For short_answer, the self-check is learner-reported — surfaced to the UI. */
  selfAssessed: boolean;
}

export interface ScoredAssessment {
  questionScores: QuestionScore[];
  earned: number;
  max: number;
  percentage: number | null;
  passed: boolean;
}

function indicesEqual(a: number[] | undefined, b: number[] | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((value, index) => value === sortedB[index]);
}

export function scoreAnswer(question: Question, value: AnswerValue | undefined): QuestionScore {
  const base: QuestionScore = {
    questionId: question.id,
    type: question.type,
    earned: 0,
    possible: question.points,
    invalid: false,
    selfAssessed: false,
  };
  if (value === undefined) return { ...base, invalid: true };

  switch (question.type) {
    case "single_choice": {
      if (typeof value !== "number") return { ...base, invalid: true };
      return { ...base, earned: value === question.correctOptionIndex ? question.points : 0 };
    }
    case "true_false": {
      if (typeof value !== "number" && typeof value !== "boolean") return { ...base, invalid: true };
      const given = typeof value === "number" ? value === 0 : value;
      return { ...base, earned: given === question.correctBoolean ? question.points : 0 };
    }
    case "multiple_choice": {
      if (!Array.isArray(value)) return { ...base, invalid: true };
      return { ...base, earned: indicesEqual(value, question.correctOptionIndices) ? question.points : 0 };
    }
    case "ordering": {
      if (!Array.isArray(value)) return { ...base, invalid: true };
      const exact = value.length === question.correctOrder?.length && value.every((v, i) => v === question.correctOrder![i]);
      return { ...base, earned: exact ? question.points : 0 };
    }
    case "short_answer": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return { ...base, invalid: true };
      }
      const record = value as { text: string; criteriaMet: number; criteriaTotal: number };
      const rubric = question.selfCheck!;
      const total = record.criteriaTotal ?? rubric.criteria.length;
      const met = record.criteriaMet ?? 0;
      const allMet = met >= total && met > 0;
      return {
        ...base,
        earned: allMet ? rubric.fullPoints : rubric.partialPoints,
        selfAssessed: true,
      };
    }
    default:
      return { ...base, invalid: true };
  }
}

export function scoreAssessment(assessment: Assessment, answers: AnswerMap): ScoredAssessment {
  const questionScores = assessment.questions.map((question) =>
    scoreAnswer(question, answers[question.id])
  );
  const earned = questionScores.reduce((sum, q) => sum + q.earned, 0);
  const max = questionScores.reduce((sum, q) => sum + q.possible, 0);
  const invalids = questionScores.filter((q) => q.invalid).length;
  const percentage = invalids === 0 && max > 0 ? Math.round((earned / max) * 100) : null;
  return {
    questionScores,
    earned,
    max,
    percentage,
    // An invalid submission never passes; unsubmitted roles score 0 and fail.
    passed: percentage !== null && percentage >= assessment.passThreshold * 100,
  };
}
