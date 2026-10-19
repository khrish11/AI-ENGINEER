import type { SkillEvidenceSummary } from "@/lib/analytics/skills";
import type { PublicSkill } from "./public-view";

/**
 * §28 — only skills the learner explicitly selected are published. Labels keep
 * the "why" visible (§9) while band wording stays Developing/Proficient/Strong.
 */
export function buildPublicSkills(
  skills: SkillEvidenceSummary[],
  publicSkillIds: string[]
): PublicSkill[] {
  const ids = new Set(publicSkillIds);
  return skills
    .filter((skill) => ids.has(skill.skillId))
    .map((skill) => ({
      skillId: skill.skillId,
      band: skill.mastery.band,
      score: skill.mastery.score,
      evidenceLabels: [...skill.mastery.labels],
    }));
}
