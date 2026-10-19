import { occurrences, skillsById, taxonomy, trackById } from "./config";
import type { Importance, OccurrenceMetadata, TrackId } from "./types";

export interface SkillProgress {
  skillId: string;
  skillName: string;
  groupId: string;
  groupName: string;
  coreTotal: number;
  coreCompleted: number;
  importantTotal: number;
  importantCompleted: number;
  masteredCount: number;
  status: "not-started" | "learning" | "completed" | "mastered";
  percent: number;
}

export interface SkillGroupProgress {
  groupId: string;
  groupName: string;
  skills: SkillProgress[];
}

function uniqueByCanonical(list: OccurrenceMetadata[]): OccurrenceMetadata[] {
  const seen = new Set<string>();
  const result: OccurrenceMetadata[] = [];
  for (const occurrence of list) {
    if (seen.has(occurrence.canonicalLessonKey)) continue;
    seen.add(occurrence.canonicalLessonKey);
    result.push(occurrence);
  }
  return result;
}

/**
 * Skill progress is derived, never stored. Completion and mastery are reported
 * separately: a lesson can be completed without being mastered.
 */
export function computeSkillProgress(
  trackId: TrackId,
  completedCanonicalKeys: Iterable<string>,
  masteredCanonicalKeys: Iterable<string> = []
): SkillGroupProgress[] {
  const track = trackById[trackId];
  const completed = new Set(completedCanonicalKeys);
  const mastered = new Set(masteredCanonicalKeys);

  const bySkill = new Map<string, OccurrenceMetadata[]>();
  for (const occurrence of occurrences) {
    for (const skill of occurrence.skillTags) {
      if (!skillsById.has(skill)) continue;
      const list = bySkill.get(skill) ?? [];
      list.push(occurrence);
      bySkill.set(skill, list);
    }
  }

  const relevantSkills = new Set<string>(track.coreSkills);
  for (const occurrence of occurrences) {
    const importance = occurrence.importance[trackId] ?? "skip";
    if (importance === "core" || importance === "important") {
      for (const skill of occurrence.skillTags) relevantSkills.add(skill);
    }
  }

  const progress: SkillProgress[] = [...relevantSkills]
    .filter((skill) => skillsById.has(skill))
    .map((skillId) => {
      const skill = skillsById.get(skillId)!;
      const items = uniqueByCanonical(bySkill.get(skillId) ?? []);
      const importanceOf = (occurrence: OccurrenceMetadata): Importance =>
        occurrence.importance[trackId] ?? "skip";

      const coreItems = items.filter((item) => importanceOf(item) === "core");
      const importantItems = items.filter((item) => importanceOf(item) === "important");
      const coreCompleted = coreItems.filter((item) => completed.has(item.canonicalLessonKey));
      const importantCompleted = importantItems.filter((item) =>
        completed.has(item.canonicalLessonKey)
      );
      const masteredCount = items.filter((item) =>
        mastered.has(item.canonicalLessonKey)
      ).length;

      const required = coreItems.length + importantItems.length;
      const done = coreCompleted.length + importantCompleted.length;
      const percent = required === 0 ? 0 : Math.round((done / required) * 100);

      let status: SkillProgress["status"] = "not-started";
      if (masteredCount > 0) status = "mastered";
      if (done === 0) status = "not-started";
      else if (required > 0 && done >= required) status = "completed";
      else status = masteredCount > 0 ? "mastered" : "learning";

      return {
        skillId,
        skillName: skill.name,
        groupId: skill.group,
        groupName: taxonomy.groups.find((group) => group.id === skill.group)?.name ?? skill.group,
        coreTotal: coreItems.length,
        coreCompleted: coreCompleted.length,
        importantTotal: importantItems.length,
        importantCompleted: importantCompleted.length,
        masteredCount,
        status,
        percent,
      };
    })
    .filter((skill) => skill.coreTotal + skill.importantTotal > 0)
    .sort((a, b) => a.skillName.localeCompare(b.skillName));

  return taxonomy.groups
    .map((group) => ({
      groupId: group.id,
      groupName: group.name,
      skills: progress.filter((skill) => skill.groupId === group.id),
    }))
    .filter((group) => group.skills.length > 0);
}

export function skillsGained(
  trackId: TrackId,
  weekOccurrenceIds: string[]
): string[] {
  const skills = new Set<string>();
  for (const occurrenceId of weekOccurrenceIds) {
    const occurrence = occurrences.find((item) => item.occurrenceId === occurrenceId);
    if (!occurrence) continue;
    for (const skill of occurrence.skillTags) {
      const importance = occurrence.importance[trackId] ?? "skip";
      if (importance === "core" || importance === "important") skills.add(skill);
    }
  }
  return [...skills];
}
