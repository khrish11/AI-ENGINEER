import {
  graphConfig,
  lessonMetadata,
  occurrences,
  phaseOrder,
  skillsById,
  taxonomy,
  tracks,
} from "./config";
import { buildGraph, findCycle } from "./graph";
import { TRACK_IDS as CONFIG_TRACK_IDS, type TrackId } from "./types";

export interface CurriculumReference {
  canonicalSlugs: string[];
  aliasSlugs: string[];
  phaseSlugs: string[];
  activeCommit: string | null;
}

export interface ValidationReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    occurrences: number;
    canonicalLessons: number;
    aliases: number;
    phases: number;
    tracks: number;
    skills: number;
    fallbackEstimates: number;
    duplicateCanonicalKeys: string[];
  };
}

const REQUIRED_TRACKS: Set<TrackId> = new Set(CONFIG_TRACK_IDS);

export function validateRoadmapConfig(curriculum?: CurriculumReference): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const occurrence of occurrences) {
    if (seen.has(occurrence.occurrenceId)) duplicates.push(occurrence.occurrenceId);
    seen.add(occurrence.occurrenceId);
  }
  if (duplicates.length > 0) {
    errors.push(`Duplicate occurrence IDs: ${duplicates.join(", ")}`);
  }

  if (occurrences.length === 0) errors.push("Lesson metadata contains no occurrences.");

  const phaseSet = new Set(phaseOrder);
  if (phaseSet.size !== 20) {
    errors.push(`Expected 20 curriculum phases in metadata, found ${phaseSet.size}.`);
  }

  const graph = buildGraph();
  for (const occurrence of occurrences) {
    if (occurrence.phaseSlug === "" || !phaseSet.has(occurrence.phaseSlug)) {
      errors.push(`Occurrence ${occurrence.occurrenceId} has an unknown phase.`);
    }
    for (const prerequisite of occurrence.prerequisites) {
      if (!graph.nodes.has(prerequisite)) {
        errors.push(
          `Occurrence ${occurrence.occurrenceId} references missing prerequisite ${prerequisite}.`
        );
      }
    }
    for (const recommended of occurrence.recommendedBefore) {
      if (!graph.nodes.has(recommended)) {
        errors.push(
          `Occurrence ${occurrence.occurrenceId} has an unknown recommendedBefore target ${recommended}.`
        );
      }
    }
    for (const skill of occurrence.skillTags) {
      if (!skillsById.has(skill)) {
        errors.push(`Occurrence ${occurrence.occurrenceId} references unknown skill "${skill}".`);
      }
    }
    if (occurrence.estimatedMinutes !== null && occurrence.estimatedMinutes < 5) {
      errors.push(
        `Occurrence ${occurrence.occurrenceId} has an implausible duration (${occurrence.estimatedMinutes}m).`
      );
    }
    for (const trackId of REQUIRED_TRACKS) {
      if (!occurrence.importance[trackId]) {
        errors.push(`Occurrence ${occurrence.occurrenceId} is missing importance for ${trackId}.`);
      }
    }
  }

  const cycle = findCycle(graph);
  if (cycle) {
    errors.push(`Prerequisite cycle detected: ${cycle.join(" → ")}`);
  }

  const canonicalKeys = new Map<string, number>();
  for (const occurrence of occurrences) {
    canonicalKeys.set(
      occurrence.canonicalLessonKey,
      (canonicalKeys.get(occurrence.canonicalLessonKey) ?? 0) + 1
    );
  }
  const duplicateCanonicalKeys = [...canonicalKeys.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
    .sort();
  if (duplicateCanonicalKeys.length > 0) {
    warnings.push(
      `Curriculum occurrences sharing a canonical identity: ${duplicateCanonicalKeys.join(", ")}`
    );
  }

  const fallbackEstimates = occurrences.filter(
    (occurrence) => occurrence.estimateSource === "fallback"
  ).length;
  if (fallbackEstimates > 0) {
    warnings.push(
      `${fallbackEstimates} occurrence${fallbackEstimates === 1 ? "" : "s"} use centralised fallback estimates.`
    );
  }

  for (const track of tracks) {
    const phases = Object.keys(track.phaseImportance);
    for (const phase of phaseSet) {
      if (!phases.includes(phase)) {
        errors.push(`Track ${track.id} has no importance for phase ${phase}.`);
      }
    }
    for (const phase of phases) {
      if (!phaseSet.has(phase)) {
        errors.push(`Track ${track.id} references unknown phase ${phase}.`);
      }
    }
    for (const occurrenceId of Object.keys(track.overrides)) {
      if (!seen.has(occurrenceId)) {
        errors.push(`Track ${track.id} overrides unknown occurrence ${occurrenceId}.`);
      }
    }
    for (const skill of track.coreSkills) {
      if (!skillsById.has(skill)) {
        errors.push(`Track ${track.id} requires unknown skill ${skill}.`);
      }
    }
    const coreCount = occurrences.filter(
      (occurrence) => occurrence.importance[track.id] === "core"
    ).length;
    if (coreCount === 0) {
      errors.push(`Track ${track.id} has no core lessons.`);
    }
  }

  if (tracks.length !== 7) {
    errors.push(`Expected 7 career tracks, found ${tracks.length}.`);
  }
  const trackIds = new Set(tracks.map((track) => track.id));
  for (const id of REQUIRED_TRACKS) {
    if (!trackIds.has(id)) errors.push(`Missing career track ${id}.`);
  }

  for (const skill of taxonomy.skills) {
    if (!taxonomy.groups.some((group) => group.id === skill.group)) {
      errors.push(`Skill ${skill.id} references unknown group ${skill.group}.`);
    }
  }

  for (const occurrence of occurrences) {
    if (occurrence.estimateSource === "upstream" && occurrence.estimatedMinutes === null) {
      errors.push(`Occurrence ${occurrence.occurrenceId} claims an upstream estimate but has none.`);
    }
  }

  if (curriculum) {
    const pendingIdentitySplits = new Map([
      [
        "04-computer-vision/14-vision-transformers",
        "07-transformers-deep-dive/09-vision-transformers",
      ],
    ]);
    const canonicalSlugs = new Set(curriculum.canonicalSlugs);
    const aliasSlugs = new Set(curriculum.aliasSlugs);
    const metadataCanonical = new Set(
      occurrences.filter((occurrence) => !occurrence.isAlias).map((o) => o.occurrenceId)
    );
    const metadataAliases = new Set(
      occurrences.filter((occurrence) => occurrence.isAlias).map((o) => o.occurrenceId)
    );

    for (const slug of canonicalSlugs) {
      if (!metadataCanonical.has(slug) && !pendingIdentitySplits.has(slug)) {
        errors.push(`Curriculum lesson ${slug} is missing from roadmap metadata.`);
      }
    }
    for (const slug of metadataCanonical) {
      if (!canonicalSlugs.has(slug) && !pendingIdentitySplits.has(slug)) {
        errors.push(`Roadmap metadata contains unknown canonical lesson ${slug}.`);
      }
    }
    for (const slug of aliasSlugs) {
      if (!metadataAliases.has(slug) && !pendingIdentitySplits.has(slug)) {
        errors.push(`Curriculum alias ${slug} is missing from roadmap metadata.`);
      }
    }
    for (const slug of metadataAliases) {
      if (!aliasSlugs.has(slug)) {
        errors.push(`Roadmap metadata contains unknown alias ${slug}.`);
      }
    }
    for (const phaseSlug of curriculum.phaseSlugs) {
      if (!phaseSet.has(phaseSlug)) errors.push(`Phase ${phaseSlug} is missing from metadata.`);
    }
    if (curriculum.activeCommit && lessonMetadata.generatedFrom.activeCommit) {
      if (curriculum.activeCommit !== lessonMetadata.generatedFrom.activeCommit) {
        warnings.push(
          `Metadata was generated from commit ${lessonMetadata.generatedFrom.activeCommit} but the active revision is ${curriculum.activeCommit}. Run npm run roadmap:metadata.`
        );
      }
    }
  }

  for (const [target, prerequisites] of Object.entries(graphConfig.extraEdges)) {
    if (!seen.has(target)) errors.push(`Graph edge references unknown occurrence ${target}.`);
    for (const prerequisite of prerequisites) {
      if (!seen.has(prerequisite)) {
        errors.push(`Graph edge ${target} references unknown prerequisite ${prerequisite}.`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      occurrences: occurrences.length,
      canonicalLessons: occurrences.filter((occurrence) => !occurrence.isAlias).length,
      aliases: occurrences.filter((occurrence) => occurrence.isAlias).length,
      phases: phaseSet.size,
      tracks: tracks.length,
      skills: taxonomy.skills.length,
      fallbackEstimates,
      duplicateCanonicalKeys,
    },
  };
}
