import {
  getOccurrence,
  getSkill,
  occurrenceById,
  trackById,
  phaseOrder,
} from "./config";
import { roadmapGraph, allDependents, prerequisiteChain } from "./graph";
import type { Importance, TrackId } from "./types";

export interface ItemExplanation {
  occurrenceId: string;
  title: string;
  importance: Importance;
  summary: string;
  reasons: string[];
}

const IMPORTANCE_LABEL: Record<Importance, string> = {
  core: "Core",
  important: "Important",
  optional: "Optional",
  skip: "Not required",
};

/**
 * Answers "why am I learning this?" using only deterministic data: track
 * importance, prerequisite edges, skill tags, and project relevance.
 */
export function explainItem(occurrenceId: string, trackId: TrackId): ItemExplanation {
  const occurrence = getOccurrence(occurrenceId);
  const track = trackById[trackId];
  const importance = occurrence.importance[trackId] ?? "skip";
  const reasons: string[] = [];

  const skillNames = occurrence.skillTags
    .filter((skill) => track.coreSkills.includes(skill))
    .map((skill) => getSkill(skill).name);
  const allSkillNames = occurrence.skillTags.map((skill) => getSkill(skill).name);

  if (importance === "core") {
    reasons.push(
      skillNames.length > 0
        ? `Core skill for ${track.name}: ${skillNames.join(", ")}.`
        : `Core lesson for ${track.name}.`
    );
  } else if (importance === "important") {
    reasons.push(
      allSkillNames.length > 0
        ? `Strongly recommended for ${track.name}; it builds ${allSkillNames.slice(0, 3).join(", ")}.`
        : `Strongly recommended for ${track.name}.`
    );
  } else if (importance === "optional") {
    reasons.push(`Optional depth for ${track.name}.`);
  } else {
    reasons.push(`Not required for ${track.name}; included only because you asked for it.`);
  }

  const prerequisites = prerequisiteChain(roadmapGraph, occurrenceId, 2)
    .map((id) => occurrenceById.get(id))
    .filter(Boolean);
  if (prerequisites.length > 0) {
    reasons.push(
      `Comes after ${prerequisites.map((item) => item!.title).join(" and ")}.`
    );
  }

  const dependents = [...allDependents(roadmapGraph, occurrenceId)]
    .map((id) => occurrenceById.get(id))
    .filter((node) => node && (node.importance[trackId] ?? "skip") !== "skip")
    .slice(0, 2);
  if (dependents.length > 0) {
    reasons.push(
      `Needed before ${dependents.map((node) => node!.title).join(" and ")}.`
    );
  }

  if (occurrence.projectRelevant && track.majorProjects.length > 0) {
    reasons.push(`Supports the project work: ${track.majorProjects[0]}.`);
  }

  return {
    occurrenceId,
    title: occurrence.title,
    importance,
    summary: `${IMPORTANCE_LABEL[importance]} for ${track.name}`,
    reasons,
  };
}

export interface SkippedExplanation {
  occurrenceId: string;
  title: string;
  importance: Importance;
  text: string;
  minutesSaved: number;
}

/** Answers "why was this skipped?" with the number of hours it removed. */
export function explainSkipped(occurrenceId: string, trackId: TrackId): SkippedExplanation {
  const occurrence = getOccurrence(occurrenceId);
  const track = trackById[trackId];
  const importance = occurrence.importance[trackId] ?? "skip";
  const minutes = occurrence.estimatedMinutes ?? 0;
  const phaseRationale = track.phaseRationale[occurrence.phaseSlug];
  const optionalText = `Optional depth for the ${track.name} track`;
  const skipText = `Not part of the ${track.name} path`;
  const requiredText = `Required for the ${track.name} track`;
  // Track-curriculum rationales live in track data and do not name the track,
  // so every label is prefixed with the track name for self-contained answers.
  const rationale =
    importance === "skip"
      ? `${skipText}. ${phaseRationale ?? "It is still available in the curriculum if you want to explore it."}`
      : importance === "optional"
        ? (phaseRationale ? `${optionalText}. ${phaseRationale}` : `${optionalText}.`)
        : (phaseRationale ? `${requiredText}. ${phaseRationale}` : `${requiredText}.`);

  const savedMinutes = importance === "skip" || importance === "optional" ? minutes : 0;
  const hours = Math.round((savedMinutes / 60) * 10) / 10;

  return {
    occurrenceId,
    title: occurrence.title,
    importance,
    text:
      hours > 0
        ? `${rationale} Skipping it reduces your workload by approximately ${hours}h.`
        : rationale,
    minutesSaved: savedMinutes,
  };
}

export function phaseName(phaseSlug: string): string {
  const index = phaseOrder.indexOf(phaseSlug);
  return index === -1 ? phaseSlug : `Phase ${String(index).padStart(2, "0")}`;
}

export function explainImportance(importance: Importance): string {
  switch (importance) {
    case "core":
      return "Essential for this role. Skipping it normally blocks later lessons.";
    case "important":
      return "Strongly recommended, but it can be deferred.";
    case "optional":
      return "Useful specialization or depth.";
    default:
      return "Not needed for this career path. The lesson stays in the curriculum.";
  }
}
