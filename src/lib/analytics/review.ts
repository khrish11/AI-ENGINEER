import { weakSkillIds, buildSkillEvidence, type AttemptLike, WEAK_AVERAGE_THRESHOLD } from "@/lib/assessments/weak-skills";
import { assessmentCatalog } from "@/lib/assessments/catalog";
import { occurrences } from "@/lib/roadmap/config";
import { REVIEW_INTERVALS_DAYS } from "./types";

/**
 * §13/§14 — deterministic review queue + spaced schedule.
 *
 * Priority (documented, applied in this order):
 *  1. prerequisite importance (how many lessons depend on the skill via shared occurrences)
 *  2. repeated assessment weakness (incorrect-attempt count)
 *  3. roadmap relevance (occurrences referencing the skill in the roadmap plan)
 *  4. review overdue (spaced interval passed)
 *  5. project dependency (projects tagged with the skill that are in progress)
 *  6. learner manually flagged review (persisted flag)
 *
 * Output is a small queue (max 8) — never hundreds of warnings.
 */
export const REVIEW_QUEUE_MAX = 8;

export interface ReviewItem {
  skillId: string;
  score: number;
  reasons: string[];
  whyNow: string;
  dueInDays: number | null;
  overdue: boolean;
}

export interface ReviewInputs {
  attempts: AttemptLike[];
  projectSkillAssociations: Map<string, { inProgress: boolean; projectTitles: string[] }>;
  reviewHistory: Map<string, string>;
  manuallyFlagged: Set<string>;
  roadmapSkillOccurrences: Map<string, number>;
}

const REASON_LABELS = {
  weak_average: (avg: string) => `Latest attempts average ${avg}% (below the ${WEAK_AVERAGE_THRESHOLD}% review threshold).`,
  repeated_incorrect: (count: number) => `Answered incorrect in ${count} separate attempts.`,
  overdue_review: (days: string) => `Spaced review overdue by ${days} days.`,
  manual_flag: () => "You flagged this topic for review.",
  project_dependency: (titles: string[]) => `Required by your active project${titles.length > 1 ? "s" : ""}: ${titles.join(", ")}.`,
  prerequisite_load: (count: number) => `${count} planned lesson${count === 1 ? " depends" : "s depend"} on this skill.`,
};

/** Next spaced interval per deterministic ladder (days). */
export function nextReviewInDays(reviewCount: number): number {
  const index = Math.min(reviewCount, REVIEW_INTERVALS_DAYS.length - 1);
  return REVIEW_INTERVALS_DAYS[index];
}

export function daysSince(iso: string, now: Date): number {
  const diff = now.getTime() - Date.parse(iso);
  if (!Number.isFinite(diff)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

export function buildReviewQueue(inputs: ReviewInputs, now: Date = new Date()): ReviewItem[] {
  const assessmentsById = new Map(assessmentCatalog.map((assessment) => [assessment.id, assessment]));
  const evidence = buildSkillEvidence(assessmentsById, inputs.attempts);
  const weak = weakSkillIds(assessmentsById, inputs.attempts);
  const weakSet = new Set(weak);

  const items: ReviewItem[] = [];
  const candidateSkills = new Set<string>([
    ...evidence.keys(),
    ...inputs.manuallyFlagged,
    ...inputs.reviewHistory.keys(),
  ]);

  for (const skillId of candidateSkills) {
    const stat = evidence.get(skillId);
    const attemptsOnSkill = stat?.incorrectAttempts ?? 0;
    const reasons: string[] = [];
    let score = 0;

    const isWeak = weakSet.has(skillId);
    if (isWeak) {
      if (stat && stat.averagePercentage !== null && stat.averagePercentage < WEAK_AVERAGE_THRESHOLD) {
        reasons.push(REASON_LABELS.weak_average(String(stat.averagePercentage)));
      } else {
        reasons.push(REASON_LABELS.repeated_incorrect(attemptsOnSkill));
      }
      score += 50;
    }

    const roadOccurrences = inputs.roadmapSkillOccurrences.get(skillId) ?? 0;
    if (roadOccurrences > 0 && isWeak) {
      reasons.push(REASON_LABELS.prerequisite_load(roadOccurrences));
      score += roadOccurrences;
    }

    const association = inputs.projectSkillAssociations.get(skillId);
    if (association?.inProgress) {
      reasons.push(REASON_LABELS.project_dependency(association.projectTitles));
      score += 20;
    }

    // Overdue spaced review (any recorded review history counts).
    const lastReviewed = inputs.reviewHistory.get(skillId);
    let overdue = false;
    if (lastReviewed) {
      const since = daysSince(lastReviewed, now);
      const interval = nextReviewInDays(evidence.get(skillId)?.validAttempts ?? 0);
      if (since >= interval) {
        reasons.push(REASON_LABELS.overdue_review(String(since - interval)));
        overdue = true;
        score += 10;
      }
    }

    if (inputs.manuallyFlagged.has(skillId)) {
      reasons.push(REASON_LABELS.manual_flag());
      score += 15;
    }

    if (reasons.length === 0) continue;
    items.push({
      skillId,
      score,
      reasons,
      whyNow: reasons.join(" "),
      dueInDays: overdue ? 0 : isWeak ? nextReviewInDays(0) : null,
      overdue,
    });
  }

  // Deterministic ordering: score desc, then skill id.
  items.sort((a, b) => b.score - a.score || a.skillId.localeCompare(b.skillId));
  return items.slice(0, REVIEW_QUEUE_MAX);
}

/** Total roadmap occurrences per skill (base for prerequisite importance). */
export function roadmapSkillOccurrences(): Map<string, number> {
  const map = new Map<string, number>();
  for (const occurrence of occurrences) {
    for (const skillId of occurrence.skillTags) {
      map.set(skillId, (map.get(skillId) ?? 0) + 1);
    }
  }
  return map;
}
