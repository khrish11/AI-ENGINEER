import type { AnswerMap, Assessment, Question } from "./schema";
import { scoreAnswer } from "./scoring";

export interface AttemptLike {
  /** Assessment id the attempt belongs to. */
  assessmentId: string;
  /** Null = started but never validly submitted. */
  percentage: number | null;
  submittedAt: string | null;
  answers: AnswerMap;
}

export interface SkillAttemptEvidence {
  skillId: string;
  /** Valid (submitted, scored) attempts that touched this skill. */
  validAttempts: number;
  /** Attempts where every question touching this skill was answered incorrectly. */
  incorrectAttempts: number;
  /** Average percentage over valid attempts touching this skill. */
  averagePercentage: number | null;
  lastSeenAt: string | null;
}

export const WEAK_ATTEMPT_WINDOW = 3;
export const WEAK_AVERAGE_THRESHOLD = 70;
export const REPEAT_INCORRECT_THRESHOLD = 2;

/**
 * §28 — deterministic weak-skill rules:
 *  - weak when the latest `WEAK_ATTEMPT_WINDOW` valid attempts touching the skill
 *    average below `WEAK_AVERAGE_THRESHOLD`, OR
 *  - when the same skill was answered incorrectly in `REPEAT_INCORRECT_THRESHOLD`
 *    or more distinct attempts.
 * One isolated mistake is never enough on its own.
 */
export function weakSkillIds(
  assessmentsById: Map<string, Assessment>,
  attempts: AttemptLike[]
): string[] {
  const evidence = buildSkillEvidence(assessmentsById, attempts);
  const weak: string[] = [];
  for (const [skillId, stat] of evidence) {
    const recent = recentValidAttempts(assessmentsById, attempts, skillId, WEAK_ATTEMPT_WINDOW);
    if (recent.length >= 2) {
      const avg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
      if (avg < WEAK_AVERAGE_THRESHOLD) {
        weak.push(skillId);
        continue;
      }
    }
    if (stat.incorrectAttempts >= REPEAT_INCORRECT_THRESHOLD) {
      weak.push(skillId);
    }
  }
  return weak.sort();
}

/** Scores per valid attempt that touched a skill, newest first. */
function recentValidAttempts(
  assessmentsById: Map<string, Assessment>,
  attempts: AttemptLike[],
  skillId: string,
  window: number
): number[] {
  const percentages: Array<{ submittedAt: string; percentage: number }> = [];
  for (const attempt of attempts) {
    if (attempt.percentage === null || !attempt.submittedAt) continue;
    const assessment = assessmentsById.get(attempt.assessmentId);
    if (!assessment) continue;
    const touched = assessment.questions.some((question) => question.skills.includes(skillId));
    if (!touched) continue;
    percentages.push({ submittedAt: attempt.submittedAt, percentage: attempt.percentage });
  }
  percentages.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return percentages.slice(0, window).map((entry) => entry.percentage);
}

/** §25 — skill evidence from real attempts; one wrong answer is not mastery data. */
export function buildSkillEvidence(
  assessmentsById: Map<string, Assessment>,
  attempts: AttemptLike[]
): Map<string, SkillAttemptEvidence> {
  const map = new Map<string, SkillAttemptEvidence>();
  const touch = (skillId: string) => {
    let stat = map.get(skillId);
    if (!stat) {
      stat = {
        skillId,
        validAttempts: 0,
        incorrectAttempts: 0,
        averagePercentage: null,
        lastSeenAt: null,
      };
      map.set(skillId, stat);
    }
    return stat;
  };

  for (const attempt of attempts) {
    const assessment = assessmentsById.get(attempt.assessmentId);
    if (!assessment) continue;
    const touchedSkills = new Set<string>();
    for (const question of assessment.questions as Question[]) {
      for (const skillId of question.skills) touchedSkills.add(skillId);
    }
    if (touchedSkills.size === 0) continue;
    const valid = attempt.percentage !== null && attempt.submittedAt !== null;
    // Per-question correctness: a skill counts as incorrect in this attempt only
    // when a question touching it was actually answered wrongly.
    const incorrectSkillsThisAttempt = new Set<string>();
    if (valid) {
      for (const question of assessment.questions as Question[]) {
        const score = scoreAnswer(question, attempt.answers[question.id]);
        if (!score.invalid && score.earned < score.possible) {
          for (const skillId of question.skills) incorrectSkillsThisAttempt.add(skillId);
        }
      }
    }
    for (const skillId of touchedSkills) {
      const stat = touch(skillId);
      if (valid) {
        stat.validAttempts += 1;
        if (incorrectSkillsThisAttempt.has(skillId)) stat.incorrectAttempts += 1;
      }
      if (attempt.submittedAt && (!stat.lastSeenAt || attempt.submittedAt > stat.lastSeenAt)) {
        stat.lastSeenAt = attempt.submittedAt;
      }
    }
  }
  for (const stat of map.values()) {
    const recent = recentValidAttempts(assessmentsById, attempts, stat.skillId, 10);
    stat.averagePercentage = recent.length
      ? Math.round((recent.reduce((sum, p) => sum + p, 0) / recent.length) * 10) / 10
      : null;
  }
  return map;
}

/** §29 — a small, actionable review list (max 5) ordered by priority. */
export interface ReviewRecommendation {
  skillId: string;
  reason: "weak_average" | "repeated_incorrect" | "stale";
  detail: string;
}

export function reviewRecommendations(
  assessmentsById: Map<string, Assessment>,
  attempts: AttemptLike[],
  weak: string[],
  lastReviewedAtBySkill: Map<string, string> | null
): ReviewRecommendation[] {
  const evidence = buildSkillEvidence(assessmentsById, attempts);
  const recommendations: ReviewRecommendation[] = [];
  for (const skillId of weak) {
    const stat = evidence.get(skillId);
    if (!stat) continue;
    const recent = recentValidAttempts(assessmentsById, attempts, skillId, WEAK_ATTEMPT_WINDOW);
    if (recent.length >= 2 && recent.reduce((s, p) => s + p, 0) / recent.length < WEAK_AVERAGE_THRESHOLD) {
      recommendations.push({
        skillId,
        reason: "weak_average",
        detail: `Latest ${recent.length} valid attempts average ${Math.round(recent.reduce((s, p) => s + p, 0) / recent.length)}%.`,
      });
    } else {
      recommendations.push({
        skillId,
        reason: "repeated_incorrect",
        detail: `Answered incorrectly in ${stat.incorrectAttempts} separate attempts.`,
      });
    }
  }
  if (lastReviewedAtBySkill && recommendations.length < 5) {
    for (const [skillId, lastReviewedAt] of lastReviewedAtBySkill) {
      if (evidence.has(skillId) || weak.includes(skillId)) continue;
      const stale = Date.now() - new Date(lastReviewedAt).getTime() > 45 * 24 * 60 * 60 * 1000;
      if (stale) {
        recommendations.push({
          skillId,
          reason: "stale",
          detail: `Last assessed more than 45 days ago.`,
        });
      }
      if (recommendations.length >= 5) break;
    }
  }
  return recommendations.slice(0, 5);
}
